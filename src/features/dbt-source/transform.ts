import { fromDbtProject } from "./fromDbtProject";
import { MANAGED_SQL_HEADER } from "./managedHeader";
import type { ProjectFiles } from "./model";
import { asArray, asRecord, asString, loadYaml } from "./yaml";

export type Problem = {
  severity: "error";
  message: string;
  tableId?: string;
};

export type RelationRef =
  | { ref: string; alias: string; source?: undefined }
  | { source: [string, string]; alias: string; ref?: undefined };

export type TransformJoin = RelationRef & {
  type: "inner" | "left" | "right" | "full";
  on?: string;
};

export type TransformIR = {
  from: RelationRef;
  joins?: TransformJoin[];
  where?: string;
  group_by?: string[];
  having?: string;
  distinct?: boolean;
};

export type TransformColumn = {
  name: string;
  lineage?: Array<{ from: string; expr?: string }>;
};

export type ManagedModel = {
  name: string;
  transform?: TransformIR;
  columns: TransformColumn[];
  schema?: string;
  alias?: string;
  managed?: boolean;
};

export type SourceTable = {
  source: string;
  table: string;
  schema?: string;
  database?: string;
};

export type TransformContext = {
  models: ManagedModel[];
  sources?: SourceTable[];
  defaultSchema?: string;
};

const ALIAS_COL = /\b([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)/g;

function findModel(ctx: TransformContext, name: string): ManagedModel | undefined {
  return ctx.models.find((m) => m.name === name);
}

function aliasesOf(ir: TransformIR): Set<string> {
  const out = new Set<string>([ir.from.alias]);
  for (const j of ir.joins ?? []) out.add(j.alias);
  return out;
}

function usedAliases(text: string | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  ALIAS_COL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ALIAS_COL.exec(text))) {
    if (m[1]) found.push(m[1]);
  }
  return found;
}

function groupBySet(ir: TransformIR): Set<string> {
  return new Set((ir.group_by ?? []).filter(Boolean));
}

function isGroupedExpr(expr: string, grouped: Set<string>, colName: string): boolean {
  return grouped.has(expr) || grouped.has(colName);
}

export function validateTransform(model: TransformContext, modelName: string): Problem[] {
  const node = findModel(model, modelName);
  if (!node) return [{ severity: "error", message: `model inexistente: ${modelName}` }];
  const ir = node.transform;
  const problems: Problem[] = [];
  const known = ir ? aliasesOf(ir) : new Set<string>();

  const checkText = (text: string | undefined, label: string) => {
    for (const alias of usedAliases(text)) {
      if (!known.has(alias)) {
        problems.push({
          severity: "error",
          message: `alias inexistente "${alias}" em ${label}`,
          tableId: modelName,
        });
      }
    }
  };

  if (ir) {
    for (const join of ir.joins ?? []) {
      if (!join.on?.trim()) {
        problems.push({
          severity: "error",
          message: `join sem on (${join.alias})`,
          tableId: modelName,
        });
      }
      checkText(join.on, `join ${join.alias}`);
    }
    checkText(ir.where, "where");
    checkText(ir.having, "having");
    for (const g of ir.group_by ?? []) checkText(g, "group_by");
  }

  const grouped = ir ? groupBySet(ir) : new Set<string>();
  const aggregating = Boolean(ir?.group_by?.length);

  for (const col of node.columns) {
    const lin = col.lineage ?? [];
    if (node.managed && lin.length === 0) {
      problems.push({
        severity: "error",
        message: `coluna sem linhagem: ${col.name}`,
        tableId: modelName,
      });
      continue;
    }
    const withExpr = lin.filter((l) => l.expr?.trim());
    if (lin.length > 1 && withExpr.length === 0) {
      problems.push({
        severity: "error",
        message: `coluna com várias origens precisa de expr: ${col.name}`,
        tableId: modelName,
      });
    }
    for (const l of lin) {
      checkText(l.from, `lineage ${col.name}`);
      checkText(l.expr, `expr ${col.name}`);
    }
    if (aggregating) {
      const expr = withExpr[0]?.expr;
      const from = lin[0]?.from;
      const covered =
        Boolean(expr) || (from ? isGroupedExpr(from, grouped, col.name) : grouped.has(col.name));
      if (!covered) {
        problems.push({
          severity: "error",
          message: `group_by: coluna não agregada sem expr: ${col.name}`,
          tableId: modelName,
        });
      }
    }
  }

  return problems;
}

function jinjaOf(rel: RelationRef): string {
  if ("source" in rel && rel.source) return `{{ source('${rel.source[0]}', '${rel.source[1]}') }}`;
  return `{{ ref('${rel.ref}') }}`;
}

function selectItem(col: TransformColumn): string | undefined {
  const lin = col.lineage ?? [];
  const withExpr = lin.find((l) => l.expr?.trim());
  if (withExpr?.expr) return `${withExpr.expr} as ${col.name}`;
  if (lin[0]?.from) return `${lin[0].from} as ${col.name}`;
  return undefined;
}

function selectList(cols: TransformColumn[]): string {
  const items = cols.map(selectItem).filter((x): x is string => Boolean(x));
  if (!items.length) return "  1 as id";
  return items.map((l) => `  ${l}`).join(",\n");
}

function joinKeyword(type: TransformJoin["type"] | undefined): string {
  switch (type) {
    case "inner":
      return "inner join";
    case "right":
      return "right join";
    case "full":
      return "full join";
    default:
      return "left join";
  }
}

function tailClauses(ir: TransformIR): string {
  const lines: string[] = [];
  if (ir.where?.trim()) lines.push(`where ${ir.where.trim()}`);
  if (ir.group_by?.length) lines.push(`group by ${ir.group_by.join(", ")}`);
  if (ir.having?.trim()) lines.push(`having ${ir.having.trim()}`);
  return lines.length ? `\n${lines.join("\n")}` : "";
}

function relations(ir: TransformIR): RelationRef[] {
  return [ir.from, ...(ir.joins ?? [])];
}

export function toDbtSql(model: TransformContext, modelName: string): string {
  const node = findModel(model, modelName);
  const ir = node?.transform;
  const header = `${MANAGED_SQL_HEADER}\n`;
  if (!node || !ir) return `${header}select 1 as id\n`;
  const rels = relations(ir);
  const ctes = rels.map((r) => `${r.alias} as (\n  select * from ${jinjaOf(r)}\n)`).join(",\n");
  const from = `from ${ir.from.alias}`;
  const joins = (ir.joins ?? [])
    .map((j) => `${joinKeyword(j.type)} ${j.alias}\n  on ${j.on?.trim() || "true"}`)
    .join("\n");
  const selectHead = ir.distinct ? "select distinct\n" : "select\n";
  return `${header}with ${ctes}\n${selectHead}${selectList(node.columns)}\n${joins ? `${from}\n${joins}` : from}${tailClauses(ir)}\n`;
}

function physicalSource(
  ctx: TransformContext,
  rel: Extract<RelationRef, { source: [string, string] }>,
  opts?: { catalog?: string; schema?: string },
): string {
  const src = (ctx.sources ?? []).find(
    (s) => s.source === rel.source[0] && s.table === rel.source[1],
  );
  const parts: string[] = [];
  if (opts?.catalog) parts.push(opts.catalog);
  if (src?.database) parts.push(src.database);
  parts.push(src?.schema || opts?.schema || ctx.defaultSchema || rel.source[0]);
  parts.push(rel.source[1]);
  return parts.join(".");
}

function physicalRef(
  ctx: TransformContext,
  rel: Extract<RelationRef, { ref: string }>,
  opts?: { catalog?: string; schema?: string },
): string {
  const target = findModel(ctx, rel.ref);
  const parts: string[] = [];
  if (opts?.catalog) parts.push(opts.catalog);
  parts.push(target?.schema || opts?.schema || ctx.defaultSchema || "main");
  parts.push(target?.alias || rel.ref);
  return parts.join(".");
}

function physicalOf(
  ctx: TransformContext,
  rel: RelationRef,
  opts?: { catalog?: string; schema?: string },
): string {
  if ("source" in rel && rel.source) return physicalSource(ctx, rel, opts);
  return physicalRef(ctx, rel as Extract<RelationRef, { ref: string }>, opts);
}

export function toSparkSql(
  model: TransformContext,
  modelName: string,
  opts?: { catalog?: string; schema?: string },
): string {
  const node = findModel(model, modelName);
  const ir = node?.transform;
  if (!node || !ir) return "select 1 as id\n";
  const from = `from ${physicalOf(model, ir.from, opts)} as ${ir.from.alias}`;
  const joins = (ir.joins ?? [])
    .map(
      (j) =>
        `${joinKeyword(j.type)} ${physicalOf(model, j, opts)} as ${j.alias}\n  on ${j.on?.trim() || "true"}`,
    )
    .join("\n");
  const distinct = ir.distinct ? "select distinct\n" : "select\n";
  return `${distinct}${selectList(node.columns)}\n${joins ? `${from}\n${joins}` : from}${tailClauses(ir)}\n`;
}

function lineageOf(col: Record<string, unknown>): TransformColumn["lineage"] {
  const config = asRecord(col.config);
  const meta = asRecord(config?.meta);
  const strata = asRecord(meta?.strata) ?? asRecord(asRecord(meta)?.strata);
  const raw = asArray(strata?.lineage);
  if (!raw.length) return undefined;
  return raw.map((item) => {
    const rec = asRecord(item) ?? {};
    const from = asString(rec.from) ?? "";
    const expr = asString(rec.expr);
    return expr ? { from, expr } : { from };
  });
}

function parseRelation(
  raw: Record<string, unknown> | undefined,
  fallbackAlias: string,
): RelationRef | undefined {
  if (!raw) return undefined;
  const alias = asString(raw.alias) ?? fallbackAlias;
  const src = raw.source;
  if (Array.isArray(src) && src.length >= 2) {
    return { source: [String(src[0]), String(src[1])], alias };
  }
  const ref = asString(raw.ref);
  if (ref) return { ref, alias };
  return undefined;
}

function parseTransform(raw: unknown): TransformIR | undefined {
  const rec = asRecord(raw);
  if (!rec) return undefined;
  const from = parseRelation(asRecord(rec.from), "s0");
  if (!from) return undefined;
  const joins: TransformJoin[] = asArray(rec.joins).flatMap((item, i) => {
    const j = asRecord(item);
    const rel = parseRelation(j, `s${i + 1}`);
    if (!rel || !j) return [];
    const typeRaw = asString(j.type) ?? "left";
    const type =
      typeRaw === "inner" || typeRaw === "right" || typeRaw === "full" || typeRaw === "left"
        ? typeRaw
        : "left";
    const on = asString(j.on);
    return [{ ...rel, type, ...(on !== undefined ? { on } : {}) }];
  });
  const group_by = asArray(rec.group_by).map((g) => String(g));
  return {
    from,
    joins,
    where: asString(rec.where),
    group_by,
    having: asString(rec.having),
    distinct: rec.distinct === true,
  };
}

function strataOf(node: Record<string, unknown> | undefined): Record<string, unknown> {
  const config = asRecord(node?.config);
  const meta = asRecord(config?.meta);
  return asRecord(meta?.strata) ?? {};
}

export function contextFromFiles(files: ProjectFiles, project: string): TransformContext {
  const models: ManagedModel[] = [];
  const sources: SourceTable[] = [];
  const prefix = `models/${project}/`;
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(prefix) || !(path.endsWith(".yml") || path.endsWith(".yaml"))) continue;
    const doc = asRecord(loadYaml(content));
    if (!doc) continue;
    for (const raw of asArray(doc.models)) {
      const node = asRecord(raw);
      const name = asString(node?.name);
      if (!name) continue;
      const config = asRecord(node?.config);
      const strata = strataOf(node);
      const columns = asArray(node?.columns).map((c) => {
        const col = asRecord(c) ?? {};
        return { name: asString(col.name) ?? "", lineage: lineageOf(col) };
      });
      models.push({
        name,
        schema: asString(config?.schema),
        alias: asString(config?.alias),
        managed: strata.managed === true,
        transform: parseTransform(strata.transform),
        columns,
      });
    }
    for (const raw of asArray(doc.sources)) {
      const src = asRecord(raw);
      const sourceName = asString(src?.name) ?? "raw";
      const schema = asString(src?.schema);
      const database = asString(src?.database);
      for (const t of asArray(src?.tables)) {
        const table = asRecord(t);
        const tableName = asString(table?.name);
        if (!tableName) continue;
        sources.push({ source: sourceName, table: tableName, schema, database });
      }
    }
  }
  return { models, sources };
}

export function isManagedModel(files: ProjectFiles, project: string, tableId: string): boolean {
  const ctx = contextFromFiles(files, project);
  const name = tableId.includes(".") ? tableId.slice(tableId.lastIndexOf(".") + 1) : tableId;
  const node = ctx.models.find((m) => m.name === name);
  return node?.managed === true;
}

export function modelTransform(
  files: ProjectFiles,
  project: string,
  tableId: string,
): TransformIR | undefined {
  const ctx = contextFromFiles(files, project);
  const name = tableId.includes(".") ? tableId.slice(tableId.lastIndexOf(".") + 1) : tableId;
  return ctx.models.find((m) => m.name === name)?.transform;
}

export function validateAllTransforms(files: ProjectFiles, project: string): Problem[] {
  const ctx = contextFromFiles(files, project);
  const out: Problem[] = [];
  for (const m of ctx.models) {
    if (!m.managed && !m.transform) continue;
    out.push(...validateTransform(ctx, m.name));
  }
  return out;
}

export function suggestTransform(
  files: ProjectFiles,
  project: string,
  tableIds: string[],
): TransformIR {
  const model = fromDbtProject(files, project);
  const tables = tableIds
    .map((id) => model.tables.find((t) => t.id === id || t.name === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const aliasAt = (i: number) => String.fromCharCode(97 + i);
  const asRel = (table: (typeof tables)[number], i: number): RelationRef => {
    const alias = aliasAt(i);
    if (table.kind === "source" || table.resourceType === "source") {
      return { source: [table.schema ?? "raw", table.name], alias };
    }
    return { ref: table.name, alias };
  };
  const first = tables[0];
  if (!first) {
    return { from: { ref: "undefined", alias: "a" }, joins: [] };
  }
  const from = asRel(first, 0);
  const joins: TransformJoin[] = tables.slice(1).map((table, idx) => {
    const rel = asRel(table, idx + 1);
    const left = tables[0];
    const fk = model.refs.find(
      (r) =>
        (r.source === left.id && r.target === table.id) ||
        (r.source === table.id && r.target === left.id),
    );
    let on = "true";
    if (fk) {
      const leftAlias = aliasAt(0);
      const rightAlias = aliasAt(idx + 1);
      if (fk.source === left.id) {
        on = `${leftAlias}.${fk.fromCol} = ${rightAlias}.${fk.toCol}`;
      } else {
        on = `${rightAlias}.${fk.fromCol} = ${leftAlias}.${fk.toCol}`;
      }
    }
    return { ...rel, type: "inner" as const, on };
  });
  return { from, joins };
}
