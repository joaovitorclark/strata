import type { ParsedFieldLineage, ParsedRolename } from "@/features/schema/model/dbmlClean";
import { rowsToCsv } from "./csv";
import {
  modelNameOf,
  projectTag,
  sourceNameOf,
  type ProjectFiles,
  type StrataColumn,
  type StrataModel,
  type StrataRef,
  type StrataTable,
} from "./model";
import { dumpYaml } from "./yaml";

const DBT_PROJECT = {
  name: "strata",
  version: "1.0.0",
  "config-version": 2,
  profile: "strata",
  "model-paths": ["models"],
  "seed-paths": ["seeds"],
  "clean-targets": ["target", "dbt_packages"],
};

function layerFolder(table: StrataTable): string {
  return (table.layer ?? table.schema ?? "main").toLowerCase();
}

function findTable(tables: StrataTable[], ident: string): StrataTable | undefined {
  return tables.find((t) => t.id === ident || t.name === ident);
}

function refJinja(table: StrataTable): string {
  if (table.kind === "source" || table.resourceType === "source") {
    const s = sourceNameOf(table);
    return `source('${s.source}', '${s.table}')`;
  }
  return `ref('${modelNameOf(table)}')`;
}

function lineageFor(table: StrataTable, fields: ParsedFieldLineage[]): ParsedFieldLineage[] {
  return fields.filter((l) => l.targetTable === table.id || l.targetTable === table.name);
}

function colLineage(table: StrataTable, col: StrataColumn, fields: ParsedFieldLineage[]) {
  return lineageFor(table, fields)
    .filter((l) => l.targetColumn === col.name)
    .map((l) => ({
      from: `${l.sourceTable}.${l.sourceColumn}`,
      ...(l.note ? { expr: l.note } : {}),
    }));
}

function pkNames(table: StrataTable): string[] {
  if (table.compositePks?.[0]?.length) return [...table.compositePks[0]];
  return table.columns.filter((c) => c.pk).map((c) => c.name);
}

function outgoingRefs(table: StrataTable, refs: StrataRef[]): StrataRef[] {
  return refs.filter((r) => r.source === table.id);
}

function columnStrata(
  table: StrataTable,
  col: StrataColumn,
  fields: ParsedFieldLineage[],
  rolenames: ParsedRolename[],
): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  const lin = colLineage(table, col, fields);
  if (lin.length) meta.lineage = lin;
  if (col.enumName) meta.enum = col.enumName;
  if (col.default !== undefined) meta.default = col.default;
  const role = rolenames.find((r) => r.child.table === table.id && r.child.column === col.name);
  if (role) meta.rolename = `${role.parent.table}.${role.parent.column}`;
  return Object.keys(meta).length ? meta : undefined;
}

function tableStrata(table: StrataTable): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  if (table.group) meta.group = table.group;
  if (table.indexes?.length) {
    meta.indexes = table.indexes.map((idx) => ({
      columns: [...idx.columns],
      ...(idx.name ? { name: idx.name } : {}),
      ...(idx.unique ? { unique: true } : {}),
    }));
  }
  return Object.keys(meta).length ? meta : undefined;
}

function columnTests(
  table: StrataTable,
  col: StrataColumn,
  refs: StrataRef[],
  tables: StrataTable[],
): unknown[] {
  const tests: unknown[] = [];
  if (col.unique) tests.push("unique");
  if (col.notNull) tests.push("not_null");
  if (col.acceptedValues?.length)
    tests.push({ accepted_values: { arguments: { values: col.acceptedValues } } });
  for (const r of outgoingRefs(table, refs)) {
    if (r.fromCol !== col.name) continue;
    const target = findTable(tables, r.target);
    if (!target) continue;
    tests.push({ relationships: { arguments: { to: refJinja(target), field: r.toCol } } });
  }
  return tests;
}

function modelConstraints(table: StrataTable, refs: StrataRef[], tables: StrataTable[]): unknown[] {
  const out: unknown[] = [];
  const pks = pkNames(table);
  if (pks.length) out.push({ type: "primary_key", columns: pks, warn_unsupported: false });
  for (const col of table.columns) {
    if (col.unique && !col.pk)
      out.push({ type: "unique", columns: [col.name], warn_unsupported: false });
  }
  for (const r of outgoingRefs(table, refs)) {
    const target = findTable(tables, r.target);
    if (!target) continue;
    out.push({
      type: "foreign_key",
      columns: [r.fromCol],
      to: refJinja(target),
      to_columns: [r.toCol],
      warn_unsupported: false,
    });
  }
  return out;
}

function columnEntry(
  table: StrataTable,
  col: StrataColumn,
  model: StrataModel,
  tables: StrataTable[],
  asSource: boolean,
): Record<string, unknown> {
  const entry: Record<string, unknown> = { name: col.name };
  if (col.type) entry.data_type = col.type;
  if (col.note) entry.description = col.note;
  const meta = columnStrata(table, col, model.lineageFields, model.rolenames);
  const config: Record<string, unknown> = {};
  if (meta) config.meta = { strata: meta };
  if (Object.keys(config).length) entry.config = config;
  if (asSource) {
    const tests = columnTests(table, col, model.refs, tables);
    if (tests.length) entry.data_tests = tests;
  } else {
    const constraints: unknown[] = [];
    if (col.notNull) constraints.push({ type: "not_null", warn_unsupported: false });
    if (constraints.length) entry.constraints = constraints;
    if (col.acceptedValues?.length) {
      entry.data_tests = [{ accepted_values: { arguments: { values: col.acceptedValues } } }];
    }
  }
  return entry;
}

function tagsOf(table: StrataTable, projeto: string): string[] {
  const tags = new Set((table.tags ?? []).filter((t) => t !== projectTag(projeto)));
  tags.add(projectTag(projeto));
  return [...tags];
}

function tableConfig(table: StrataTable, projeto: string): Record<string, unknown> {
  const config: Record<string, unknown> = {
    tags: tagsOf(table, projeto),
  };
  const strata = tableStrata(table);
  if (strata) config.meta = { strata };
  if (table.kind !== "source") {
    if (table.schema) config.schema = table.schema;
    if (table.materialization) config.materialized = table.materialization;
    config.contract = { enforced: true };
  }
  return config;
}

function modelSql(table: StrataTable, fields: ParsedFieldLineage[], tables: StrataTable[]): string {
  const upstreams = new Set<string>();
  for (const l of lineageFor(table, fields)) upstreams.add(l.sourceTable);
  for (const r of tables[0] ? [] : []) void r;
  const from = [...upstreams]
    .map((id) => findTable(tables, id))
    .filter((t): t is StrataTable => !!t);
  if (!from.length) {
    // Cross-project FK still needs a ref() so fromDbtProject can recover the external table.
    return "select 1 as id\n";
  }
  const lines = [`select * from {{ ${refJinja(from[0])} }}`];
  for (const t of from.slice(1)) lines.push(`-- depends_on: {{ ${refJinja(t)} }}`);
  return `${lines.join("\n")}\n`;
}

function seedName(table: StrataTable): string {
  return `records_${table.id.replace(/\W+/g, "_")}`;
}

function visualColors(model: StrataModel, local: StrataTable[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, color] of Object.entries(model.colors)) {
    if (local.some((t) => key === t.id || key.startsWith(`${t.id}.`))) out[key] = color;
  }
  return out;
}

export function toDbtProject(model: StrataModel, projeto: string): ProjectFiles {
  const files: ProjectFiles = {};
  const local = model.tables.filter((t) => t.project === projeto && !t.external);
  const all = model.tables;
  files["dbt_project.yml"] = dumpYaml(DBT_PROJECT);
  files[`.strata/${projeto}/project.yml`] = dumpYaml({ format_version: 1, name: projeto });

  const canvas: Record<string, unknown> = {};
  if (model.canvas?.positions && Object.keys(model.canvas.positions).length) {
    canvas.positions = model.canvas.positions;
  }
  if (model.canvas?.sizes && Object.keys(model.canvas.sizes).length)
    canvas.sizes = model.canvas.sizes;
  if (model.canvas?.collapsedGroups?.length) canvas.collapsedGroups = model.canvas.collapsedGroups;
  const colors = visualColors(model, local);
  if (Object.keys(colors).length) canvas.colors = colors;
  const pins = model.pins.filter((p) => local.some((t) => p.startsWith(`${t.id}.`)));
  if (pins.length) canvas.pins = pins;
  files[`.strata/${projeto}/canvas.yml`] = dumpYaml(canvas);
  files[`.strata/${projeto}/views.yml`] = dumpYaml({ views: model.views });

  const sourcesByFile = new Map<string, Map<string, StrataTable[]>>();
  for (const t of local.filter((x) => x.kind === "source")) {
    const file = `models/${projeto}/${layerFolder(t)}/_sources.yml`;
    const src = sourceNameOf(t).source;
    let bySource = sourcesByFile.get(file);
    if (!bySource) {
      bySource = new Map();
      sourcesByFile.set(file, bySource);
    }
    const list = bySource.get(src) ?? [];
    list.push(t);
    bySource.set(src, list);
  }
  for (const [file, bySource] of sourcesByFile) {
    const sources = [...bySource.entries()].map(([name, tables]) => ({
      name,
      schema: name,
      tables: tables.map((t) => {
        const pks = pkNames(t);
        return {
          name: t.name,
          ...(t.note ? { description: t.note } : {}),
          config: tableConfig(t, projeto),
          ...(pks.length
            ? {
                constraints: [{ type: "primary_key", columns: pks, warn_unsupported: false }],
              }
            : {}),
          columns: t.columns.map((c) => columnEntry(t, c, model, all, true)),
        };
      }),
    }));
    files[file] = dumpYaml({ version: 2, sources });
  }

  for (const t of local.filter((x) => x.kind === "model")) {
    const dir = `models/${projeto}/${layerFolder(t)}`;
    const name = modelNameOf(t);
    let sql = modelSql(t, model.lineageFields, all);
    for (const r of outgoingRefs(t, model.refs)) {
      const target = findTable(all, r.target);
      if (
        target &&
        (target.external || target.project !== projeto) &&
        !sql.includes(`ref('${modelNameOf(target)}')`)
      ) {
        sql += `-- depends_on: {{ ${refJinja(target)} }}\n`;
      }
    }
    files[`${dir}/${name}.sql`] = sql;
    files[`${dir}/_${name}.yml`] = dumpYaml({
      version: 2,
      models: [
        {
          name,
          ...(t.note ? { description: t.note } : {}),
          config: tableConfig(t, projeto),
          constraints: modelConstraints(t, model.refs, all),
          columns: t.columns.map((c) => columnEntry(t, c, model, all, false)),
        },
      ],
    });
  }

  for (const rec of model.records) {
    const table = local.find((t) => t.id === rec.table || t.name === rec.table);
    if (!table) continue;
    const name = seedName(table);
    files[`seeds/${projeto}/${name}.csv`] = rowsToCsv(rec.columns, rec.rows);
    files[`seeds/${projeto}/_${name}.yml`] = dumpYaml({
      version: 2,
      seeds: [{ name }],
    });
  }

  return files;
}
