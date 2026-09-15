import type { ParsedFieldLineage, ParsedRolename } from "@/features/schema/model/dbmlClean";
import type { ParsedRecords } from "@/features/schema/model/records";
import type { SchemaView } from "@/features/schema/model/views";
import { csvToRows } from "./csv";
import {
  modelNameOf,
  projectFromTags,
  projectTag,
  qualifiedTableId,
  type ProjectFiles,
  type StrataCanvas,
  type StrataColumn,
  type StrataEnum,
  type StrataIndex,
  type StrataModel,
  type StrataRef,
  type StrataTable,
} from "./model";
import { asArray, asRecord, asString, loadYaml } from "./yaml";

const REF_RE = /\{\{\s*ref\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;
const SOURCE_RE = /\{\{\s*source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;
const REF_CALL = /ref\(\s*['"]([^'"]+)['"]\s*\)/;
const SOURCE_CALL = /source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/;

function strataOf(node: Record<string, unknown> | undefined): Record<string, unknown> {
  const config = asRecord(node?.config);
  const meta = asRecord(config?.meta) ?? asRecord(node?.meta);
  return asRecord(asRecord(meta?.strata) ?? meta?.strata) ?? asRecord(meta) ?? {};
}

function tagsOf(node: Record<string, unknown> | undefined): string[] | undefined {
  const config = asRecord(node?.config);
  const tags = config?.tags ?? node?.tags;
  if (!Array.isArray(tags)) return undefined;
  return tags.map((t) => String(t));
}

function splitFrom(from: string): { table: string; column: string } | null {
  const last = from.lastIndexOf(".");
  if (last <= 0) return null;
  return { table: from.slice(0, last), column: from.slice(last + 1) };
}

function testsOf(col: Record<string, unknown>): unknown[] {
  return asArray(col.data_tests ?? col.tests);
}

function isTest(test: unknown, kind: string): boolean {
  if (test === kind) return true;
  const rec = asRecord(test);
  return !!rec && kind in rec;
}

function relationshipOf(test: unknown): { to: string; field: string } | undefined {
  const rec = asRecord(test);
  const rel = asRecord(rec?.relationships);
  if (!rel) return undefined;
  const args = asRecord(rel.arguments) ?? rel;
  const to = asString(args.to);
  const field = asString(args.field);
  if (!to || !field) return undefined;
  return { to, field };
}

function acceptedOf(col: Record<string, unknown>): string[] | undefined {
  for (const test of testsOf(col)) {
    const rec = asRecord(test);
    const av = asRecord(rec?.accepted_values);
    const values = asArray(av?.values).length
      ? asArray(av?.values)
      : asArray(asRecord(av?.arguments)?.values);
    if (values.length) return values.map((v) => String(v));
  }
  return undefined;
}

function parsePositionsMap(raw: unknown): StrataCanvas["positions"] {
  const rec = asRecord(raw);
  if (!rec) return undefined;
  const out: NonNullable<StrataCanvas["positions"]> = {};
  for (const [id, value] of Object.entries(rec)) {
    const p = asRecord(value);
    if (!p) continue;
    const x = Number(p.x);
    const y = Number(p.y);
    if (Number.isFinite(x) && Number.isFinite(y)) out[id] = { x, y };
  }
  return Object.keys(out).length ? out : undefined;
}

function constraintsOf(node: Record<string, unknown> | undefined): Record<string, unknown>[] {
  return asArray(node?.constraints)
    .map((c) => asRecord(c))
    .filter((c): c is Record<string, unknown> => !!c);
}

function parseColumns(
  rawCols: unknown[],
  pks: Set<string>,
  tableUniques: Set<string>,
): StrataColumn[] {
  return rawCols.map((raw) => {
    const col = asRecord(raw) ?? {};
    const name = asString(col.name) ?? "";
    const strata = strataOf(col);
    const tests = testsOf(col);
    const colConstraints = constraintsOf(col);
    const hasUniqueTest =
      tests.some((t) => isTest(t, "unique")) ||
      colConstraints.some((c) => c.type === "unique") ||
      tableUniques.has(name);
    const hasNotNullTest =
      tests.some((t) => isTest(t, "not_null")) || colConstraints.some((c) => c.type === "not_null");
    const notNull = hasNotNullTest;
    const unique = !pks.has(name) && hasUniqueTest;
    const column: StrataColumn = {
      name,
      type: asString(col.data_type) ?? asString(col.dataType) ?? "string",
      pk: pks.has(name),
      notNull,
      note: asString(col.description),
      acceptedValues: acceptedOf(col),
    };
    if (unique) column.unique = true;
    const def = asString(strata.default);
    if (def !== undefined) column.default = def;
    const enumName = asString(strata.enum);
    if (enumName) column.enumName = enumName;
    return column;
  });
}

function pkSet(node: Record<string, unknown>): string[] {
  for (const c of constraintsOf(node)) {
    if (c.type === "primary_key") return asArray(c.columns).map((x) => String(x));
  }
  return [];
}

function uniqueColsOf(node: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const c of constraintsOf(node)) {
    if (c.type !== "unique") continue;
    for (const col of asArray(c.columns)) out.add(String(col));
  }
  return out;
}

function layerFromPath(filePath: string, projeto: string): string | undefined {
  const m = new RegExp(`^models/${projeto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^/]+)/`).exec(
    filePath,
  );
  return m?.[1];
}

function recordsSeedName(tableId: string): string {
  return `records_${tableId.replace(/\W+/g, "_")}`;
}

function indexesOf(strata: Record<string, unknown>): StrataIndex[] | undefined {
  const raw = asArray(strata.indexes);
  if (!raw.length) return undefined;
  const out: StrataIndex[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    const columns = rec ? asArray(rec.columns).map((c) => String(c)) : [];
    if (!columns.length) continue;
    const idx: StrataIndex = { columns };
    const name = rec ? asString(rec.name) : undefined;
    if (name) idx.name = name;
    if (rec?.unique === true) idx.unique = true;
    out.push(idx);
  }
  return out.length ? out : undefined;
}

function tableIdOf(schema: string | undefined, name: string): string {
  return qualifiedTableId(schema, name);
}

function collectSqlRefs(sql: string): {
  refs: string[];
  sources: Array<{ source: string; table: string }>;
} {
  const refs: string[] = [];
  const sources: Array<{ source: string; table: string }> = [];
  for (const m of sql.matchAll(REF_RE)) refs.push(m[1]);
  for (const m of sql.matchAll(SOURCE_RE)) sources.push({ source: m[1], table: m[2] });
  return { refs, sources };
}

function resolveTo(to: string, tables: StrataTable[]): StrataTable | undefined {
  const jinja = to
    .replace(/^\{\{\s*/, "")
    .replace(/\s*\}\}$/, "")
    .trim();
  const refM = REF_CALL.exec(jinja) ?? REF_CALL.exec(to);
  if (refM) return tables.find((t) => modelNameOf(t) === refM[1] || t.name === refM[1]);
  const srcM = SOURCE_CALL.exec(jinja) ?? SOURCE_CALL.exec(to);
  if (srcM) {
    return tables.find(
      (t) => t.kind === "source" && (t.schema ?? "raw") === srcM[1] && t.name === srcM[2],
    );
  }
  return tables.find((t) => t.id === to || t.name === to);
}

function projectOfPath(filePath: string): string | undefined {
  const m = /^(?:models|seeds|\.strata)\/([^/]+)\//.exec(filePath);
  return m?.[1];
}

export function fromDbtProject(files: ProjectFiles, projeto: string): StrataModel {
  const tables: StrataTable[] = [];
  const refs: StrataRef[] = [];
  const lineageFields: ParsedFieldLineage[] = [];
  const rolenames: ParsedRolename[] = [];
  const records: ParsedRecords[] = [];
  const enums: StrataEnum[] = [];
  const layerMembers = new Map<string, string[]>();

  const ymlFiles = Object.entries(files).filter(([p]) => p.endsWith(".yml") || p.endsWith(".yaml"));

  for (const [filePath, content] of ymlFiles) {
    if (!filePath.startsWith(`models/${projeto}/`) && !filePath.startsWith(`models/`)) continue;
    const owner = projectOfPath(filePath);
    if (owner && owner !== projeto) continue;
    const doc = asRecord(loadYaml(content));
    if (!doc) continue;

    const folderLayer = layerFromPath(filePath, projeto);

    for (const src of asArray(doc.sources)) {
      const source = asRecord(src);
      if (!source) continue;
      const sourceName = asString(source.name) ?? "raw";
      const identitySchema = asString(source.schema) ?? sourceName;
      for (const rawTable of asArray(source.tables)) {
        const node = asRecord(rawTable);
        if (!node) continue;
        const name = asString(node.name) ?? "";
        const strata = strataOf(node);
        const pks = pkSet(node);
        const pk = new Set(pks);
        const id = tableIdOf(identitySchema, name);
        const tags = tagsOf(node);
        const layer = folderLayer;
        if (layer) {
          const list = layerMembers.get(layer) ?? [];
          list.push(id);
          layerMembers.set(layer, list);
        }
        const columns = parseColumns(asArray(node.columns), pk, uniqueColsOf(node));
        tables.push({
          id,
          name,
          schema: sourceName,
          project: projectFromTags(tags) ?? projeto,
          kind: "source",
          layer,
          group: asString(strata.group),
          note: asString(node.description),
          columns,
          compositePks: pks.length > 1 ? [pks] : undefined,
          indexes: indexesOf(strata),
          tags,
          resourceType: "source",
        });
        collectColumnExtras(node, id, columns, lineageFields, rolenames, enums);
      }
    }

    for (const rawModel of asArray(doc.models)) {
      const node = asRecord(rawModel);
      if (!node) continue;
      const name = asString(node.name) ?? "";
      const strata = strataOf(node);
      const pks = pkSet(node);
      const pk = new Set(pks);
      const config = asRecord(node.config);
      const schema = asString(config?.schema) ?? folderLayer;
      const id = tableIdOf(schema, name);
      const tags = tagsOf(node);
      const layer = folderLayer;
      if (layer) {
        const list = layerMembers.get(layer) ?? [];
        list.push(id);
        layerMembers.set(layer, list);
      }
      const columns = parseColumns(asArray(node.columns), pk, uniqueColsOf(node));
      tables.push({
        id,
        name,
        schema,
        project: projectFromTags(tags) ?? projeto,
        kind: "model",
        layer,
        group: asString(strata.group),
        note: asString(node.description),
        columns,
        compositePks: pks.length > 1 ? [pks] : undefined,
        indexes: indexesOf(strata),
        tags,
        resourceType: "model",
        materialization: asString(config?.materialized) as StrataTable["materialization"],
      });
      collectColumnExtras(node, id, columns, lineageFields, rolenames, enums);
    }
  }

  // Second pass: relationship tests need all tables present (including later models).
  const localTables = [...tables];
  for (const [filePath, content] of ymlFiles) {
    const owner = projectOfPath(filePath);
    if (owner && owner !== projeto) continue;
    if (!filePath.startsWith("models/")) continue;
    const doc = asRecord(loadYaml(content));
    if (!doc) continue;
    const folderLayer = layerFromPath(filePath, projeto);
    const walk: Array<{ node: Record<string, unknown>; identitySchema?: string }> = [];
    for (const src of asArray(doc.sources)) {
      const source = asRecord(src);
      const sourceName = asString(source?.name) ?? "raw";
      const identitySchema = asString(source?.schema) ?? sourceName;
      for (const raw of asArray(source?.tables)) {
        const node = asRecord(raw);
        if (node) walk.push({ node, identitySchema });
      }
    }
    for (const raw of asArray(doc.models)) {
      const node = asRecord(raw);
      if (node) walk.push({ node });
    }
    for (const { node, identitySchema } of walk) {
      const name = asString(node.name) ?? "";
      const config = asRecord(node.config);
      const schema = identitySchema ?? asString(config?.schema) ?? folderLayer;
      const id = tableIdOf(schema, name);
      for (const c of constraintsOf(node)) {
        if (c.type !== "foreign_key") continue;
        const cols = asArray(c.columns).map((x) => String(x));
        const toCols = asArray(c.to_columns).map((x) => String(x));
        const to = asString(c.to);
        if (!cols[0] || !to || !toCols[0]) continue;
        pushRef(refs, id, cols[0], to, toCols[0], localTables);
      }
      for (const rawCol of asArray(node.columns)) {
        const col = asRecord(rawCol);
        if (!col) continue;
        const colName = asString(col.name) ?? "";
        for (const test of testsOf(col)) {
          const rel = relationshipOf(test);
          if (!rel) continue;
          pushRef(refs, id, colName, rel.to, rel.field, localTables);
        }
      }
    }
  }

  const sqlRefs: string[] = [];
  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.startsWith(`models/${projeto}/`) || !filePath.endsWith(".sql")) continue;
    const found = collectSqlRefs(content);
    sqlRefs.push(...found.refs);
  }

  const catalog = indexDomain(files);
  for (const name of sqlRefs) {
    if (tables.some((t) => modelNameOf(t) === name || t.name === name)) continue;
    const remote = catalog.models.get(name);
    if (remote) {
      if (remote.project === projeto) continue;
      tables.push({
        ...remote.table,
        external: true,
        externalProject: remote.project,
      });
    } else {
      tables.push({
        id: name,
        name,
        project: "unknown",
        kind: "model",
        columns: [],
        external: true,
        externalProject: "unknown",
      });
    }
  }

  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.startsWith(`seeds/${projeto}/`) || !filePath.endsWith(".csv")) continue;
    const base = filePath.slice(filePath.lastIndexOf("/") + 1).replace(/\.csv$/, "");
    // A seed is tied to a table by the generated name (records_<id>) or, as dbt itself does, by
    // being named after the table — accepted only when exactly one table in the project has that name.
    const byName = tables.filter((t) => !t.external && t.name === base);
    const matched =
      tables.find((t) => recordsSeedName(t.id) === base) ??
      (byName.length === 1 ? byName[0] : undefined);
    const tableId = matched?.id ?? base;
    const parsed = csvToRows(content);
    records.push({ table: tableId, columns: parsed.columns, rows: parsed.rows, raw: content });
  }

  let colors: Record<string, string> = {};
  let pins: string[] = [];
  let views: SchemaView[] = [];
  let canvas: StrataCanvas | undefined;
  const canvasPath = `.strata/${projeto}/canvas.yml`;
  const viewsPath = `.strata/${projeto}/views.yml`;
  if (files[canvasPath]) {
    const doc = asRecord(loadYaml(files[canvasPath])) ?? {};
    colors = (asRecord(doc.colors) as Record<string, string> | undefined) ?? {};
    pins = asArray(doc.pins).map((p) => String(p));
    canvas = {
      positions: parsePositionsMap(doc.positions),
      sizes: asRecord(doc.sizes) as StrataCanvas["sizes"],
      collapsedGroups: asArray(doc.collapsedGroups).map((x) => String(x)),
    };
  }
  if (files[viewsPath]) {
    const doc = asRecord(loadYaml(files[viewsPath])) ?? {};
    views = asArray(doc.views) as SchemaView[];
  }

  const layerGroups = [...layerMembers.entries()].map(([name, memberIds]) => ({
    id: name.toLowerCase(),
    name,
    tables: memberIds,
  }));

  return {
    project: projeto,
    tables,
    refs: dedupeRefs(refs),
    records,
    layerGroups,
    lineageFields,
    rolenames,
    colors,
    pins,
    views,
    enums: dedupeEnums(enums),
    canvas,
  };
}

function collectColumnExtras(
  node: Record<string, unknown>,
  tableId: string,
  columns: StrataColumn[],
  lineageFields: ParsedFieldLineage[],
  rolenames: ParsedRolename[],
  enums: StrataEnum[],
): void {
  for (const rawCol of asArray(node.columns)) {
    const col = asRecord(rawCol);
    if (!col) continue;
    const name = asString(col.name) ?? "";
    const strata = strataOf(col);
    for (const lin of asArray(strata.lineage)) {
      const rec = asRecord(lin);
      const from = asString(rec?.from);
      const split = from ? splitFrom(from) : null;
      if (!split) continue;
      lineageFields.push({
        targetTable: tableId,
        targetColumn: name,
        sourceTable: split.table,
        sourceColumn: split.column,
        note: asString(rec?.expr),
      });
    }
    const role = asString(strata.rolename);
    if (role) {
      const split = splitFrom(role);
      if (split) {
        rolenames.push({ child: { table: tableId, column: name }, parent: split });
      }
    }
    const enumName = asString(strata.enum);
    const accepted = columns.find((c) => c.name === name)?.acceptedValues;
    if (enumName && accepted?.length && !enums.some((e) => e.name === enumName)) {
      enums.push({ name: enumName, values: accepted });
    }
  }
}

function pushRef(
  refs: StrataRef[],
  source: string,
  fromCol: string,
  toExpr: string,
  toCol: string,
  tables: StrataTable[],
): void {
  const targetTable = resolveTo(toExpr, tables);
  const target = targetTable?.id ?? toExpr;
  const id = `${source}.${fromCol}->${target}.${toCol}`;
  if (refs.some((r) => r.id === id)) return;
  refs.push({
    id,
    source,
    target,
    fromCol,
    toCol,
    fromRel: "*",
    toRel: "1",
  });
}

function dedupeRefs(refs: StrataRef[]): StrataRef[] {
  const seen = new Set<string>();
  const out: StrataRef[] = [];
  for (const r of refs) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function dedupeEnums(enums: StrataEnum[]): StrataEnum[] {
  const seen = new Set<string>();
  return enums.filter((e) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });
}

function indexDomain(files: ProjectFiles): {
  models: Map<string, { project: string; table: StrataTable }>;
} {
  const models = new Map<string, { project: string; table: StrataTable }>();
  for (const [filePath, content] of Object.entries(files)) {
    if (
      !filePath.startsWith("models/") ||
      !(filePath.endsWith(".yml") || filePath.endsWith(".yaml"))
    )
      continue;
    const project = projectOfPath(filePath);
    if (!project) continue;
    const doc = asRecord(loadYaml(content));
    if (!doc) continue;
    for (const raw of asArray(doc.models)) {
      const node = asRecord(raw);
      if (!node) continue;
      const name = asString(node.name) ?? "";
      const strata = strataOf(node);
      const pks = pkSet(node);
      const config = asRecord(node.config);
      const folderLayer = layerFromPath(filePath, project);
      const schema = asString(config?.schema) ?? folderLayer;
      const id = tableIdOf(schema, name);
      const tags = tagsOf(node);
      models.set(name, {
        project,
        table: {
          id,
          name,
          schema,
          project,
          kind: "model",
          layer: folderLayer,
          group: asString(strata.group),
          note: asString(node.description),
          columns: parseColumns(asArray(node.columns), new Set(pks), uniqueColsOf(node)),
          compositePks: pks.length > 1 ? [pks] : undefined,
          tags,
          resourceType: "model",
        },
      });
    }
  }
  return { models };
}

export { projectTag };
