import { Parser } from "@dbml/core";
import {
  extractRecords,
  type ParsedDbtTable,
  type ParsedFieldLineage,
  type ParsedLayerGroup,
} from "@/features/schema/model/dbmlClean";
import { parseDbml } from "@/features/schema/model/parse";
import { parseViewsBlock } from "@/features/schema/model/views";
import {
  projectFromTags,
  qualifiedTableId,
  type StrataColumn,
  type StrataEnum,
  type StrataIndex,
  type StrataModel,
  type StrataTable,
} from "./model";

type DbmlField = {
  name: string;
  unique?: boolean;
  dbdefault?: { value?: unknown; type?: string };
};

type DbmlIndexColumn = string | { value?: string; name?: string };
type DbmlIndex = {
  pk?: boolean;
  unique?: boolean;
  name?: string;
  columns?: DbmlIndexColumn[];
};

type DbmlTable = {
  name: string;
  fields: DbmlField[];
  indexes?: DbmlIndex[];
};

type DbmlSchema = { name?: string; tables: DbmlTable[] };
type ParsedDbml = { schemas: DbmlSchema[] };

function indexColumns(idx: DbmlIndex): string[] {
  return (idx.columns ?? [])
    .map((c) => (typeof c === "string" ? c : (c.value ?? c.name ?? "")))
    .filter(Boolean);
}

function formatDefault(value: { value?: unknown; type?: string } | undefined): string | undefined {
  if (!value || value.value === undefined || value.value === null) return undefined;
  return String(value.value);
}

function parseEnums(dbml: string): StrataEnum[] {
  const out: StrataEnum[] = [];
  const re = /Enum\s+("?[^"\s{]+"?)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dbml))) {
    const name = m[1].replace(/["`]/g, "");
    const values = m[2]
      .split("\n")
      .map((l) => l.trim().replace(/,$/, "").replace(/["']/g, ""))
      .filter((l) => l && !l.startsWith("//"));
    out.push({ name, values });
  }
  return out;
}

function extraFromParser(clean: string): {
  unique: Map<string, Set<string>>;
  defaults: Map<string, Map<string, string>>;
  indexes: Map<string, StrataIndex[]>;
} {
  const unique = new Map<string, Set<string>>();
  const defaults = new Map<string, Map<string, string>>();
  const indexes = new Map<string, StrataIndex[]>();
  let db: ParsedDbml;
  try {
    db = Parser.parse(clean, "dbml") as unknown as ParsedDbml;
  } catch {
    return { unique, defaults, indexes };
  }
  for (const schema of db.schemas) {
    const schemaName = schema.name && schema.name !== "public" ? schema.name : undefined;
    for (const t of schema.tables) {
      const id = qualifiedTableId(schemaName, t.name);
      const u = new Set<string>();
      const d = new Map<string, string>();
      for (const f of t.fields) {
        if (f.unique) u.add(f.name);
        const def = formatDefault(f.dbdefault);
        if (def !== undefined) d.set(f.name, def);
      }
      unique.set(id, u);
      defaults.set(id, d);
      const idxs: StrataIndex[] = [];
      for (const idx of t.indexes ?? []) {
        const cols = indexColumns(idx);
        if (!cols.length || idx.pk) continue;
        idxs.push({ columns: cols, unique: idx.unique || undefined, name: idx.name || undefined });
      }
      if (idxs.length) indexes.set(id, idxs);
    }
  }
  return { unique, defaults, indexes };
}

function layerOf(id: string, groups: ParsedLayerGroup[]): string | undefined {
  return groups.find((g) => g.tables.includes(id))?.name;
}

function dbtFor(id: string, dbtTables: ParsedDbtTable[]): ParsedDbtTable | undefined {
  return dbtTables.find((d) => d.tableName === id || d.tableName === id.split(".").pop());
}

export function fromDbml(dbml: string): StrataModel {
  const parsed = parseDbml(dbml);
  const extracted = extractRecords(dbml);
  const extras = extraFromParser(extracted.clean);
  const enums = parseEnums(dbml);
  const enumNames = new Set(enums.map((e) => e.name));

  const tables: StrataTable[] = parsed.tables.map((t) => {
    const dbt = dbtFor(t.id, extracted.dbtTables);
    const project = projectFromTags(dbt?.tags) ?? "default";
    const u = extras.unique.get(t.id);
    const d = extras.defaults.get(t.id);
    const columns: StrataColumn[] = t.columns.map((c) => {
      const col: StrataColumn = {
        name: c.name,
        type: c.type,
        pk: c.pk,
        notNull: c.notNull,
        note: c.note,
        acceptedValues: c.acceptedValues,
        color: c.color,
      };
      if (u?.has(c.name)) col.unique = true;
      const def = d?.get(c.name);
      if (def !== undefined) col.default = def;
      if (enumNames.has(c.type)) col.enumName = c.type;
      return col;
    });
    const table: StrataTable = {
      id: t.id,
      name: t.name,
      schema: t.schema,
      project,
      kind: dbt?.resourceType === "source" ? "source" : "model",
      layer: layerOf(t.id, parsed.layerGroups),
      group: t.group,
      note: t.note,
      columns,
      compositePks: t.compositePks,
      indexes: extras.indexes.get(t.id),
      tags: dbt?.tags,
      resourceType: dbt?.resourceType,
      materialization: dbt?.materialization,
    };
    return table;
  });

  return {
    project: "*",
    tables,
    refs: parsed.refs.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      fromCol: r.fromCol,
      toCol: r.toCol,
      fromRel: r.fromRel,
      toRel: r.toRel,
    })),
    records: parsed.records,
    layerGroups: parsed.layerGroups,
    lineageFields: parsed.lineageFields,
    rolenames: parsed.rolenames,
    colors: parsed.colors,
    pins: parsed.pins ?? [],
    views: parseViewsBlock(dbml),
    enums,
  };
}

function keepLineage(fields: ParsedFieldLineage[], ids: Set<string>): ParsedFieldLineage[] {
  return fields.filter((l) => ids.has(l.targetTable));
}

export function filterProject(model: StrataModel, projeto: string): StrataModel {
  const local = model.tables.filter((t) => t.project === projeto && !t.external);
  const localIds = new Set(local.map((t) => t.id));
  const outgoing = model.refs.filter((r) => localIds.has(r.source));
  const externals: StrataTable[] = [];
  for (const r of outgoing) {
    if (localIds.has(r.target)) continue;
    if (externals.some((t) => t.id === r.target)) continue;
    const full = model.tables.find((t) => t.id === r.target);
    if (full) {
      externals.push({ ...full, external: true, externalProject: full.project });
    }
  }
  const tables = [...local, ...externals];
  const ids = new Set(tables.map((t) => t.id));
  const usedEnums = new Set(
    tables.flatMap((t) => t.columns.map((c) => c.enumName).filter((n): n is string => !!n)),
  );
  return {
    project: projeto,
    tables,
    refs: outgoing,
    records: model.records.filter(
      (r) => localIds.has(r.table) || local.some((t) => t.name === r.table),
    ),
    layerGroups: model.layerGroups
      .map((g) => ({ ...g, tables: g.tables.filter((id) => localIds.has(id)) }))
      .filter((g) => g.tables.length),
    lineageFields: keepLineage(model.lineageFields, localIds),
    rolenames: model.rolenames.filter((r) => localIds.has(r.child.table)),
    colors: Object.fromEntries(
      Object.entries(model.colors).filter(
        ([key]) => ids.has(key.split(".").slice(0, -1).join(".")) || ids.has(key),
      ),
    ),
    pins: model.pins.filter((p) => {
      const last = p.lastIndexOf(".");
      return last > 0 && localIds.has(p.slice(0, last));
    }),
    views: model.views
      .map((v) => ({
        ...v,
        tables: v.tables.filter((id) => localIds.has(id)),
        positions: v.positions
          ? Object.fromEntries(Object.entries(v.positions).filter(([id]) => localIds.has(id)))
          : undefined,
      }))
      .filter((v) => v.tables.length),
    enums: model.enums.filter((e) => usedEnums.has(e.name)),
    canvas: model.canvas,
  };
}
