import type { ProjectFiles, StrataTable } from "../model";
import { fromDbtProject } from "../fromDbtProject";
import { asArray, asRecord, asString, loadYaml } from "../yaml";
import { preprocessJinja } from "./preprocessJinja";
import { dialectsForAdapter, parseSelect } from "./parseSelect";
import { resolveQuery, type CatalogEntry, type ResolvedColumn } from "./resolveColumns";
import { nameFallback } from "./nameFallback";
import { loadDismissed } from "./dismissed";
import {
  lineageKey,
  originRef,
  type InferProblem,
  type InferResult,
  type InferredLineage,
  type LineageOrigin,
} from "./types";

const REF_RE = /\{\{\s*ref\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;
const SOURCE_RE = /\{\{\s*source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;

function detectAdapter(files: ProjectFiles): string | undefined {
  const profiles = files["profiles.yml"] ?? files["config/profiles.yml"];
  if (!profiles) return undefined;
  const m = /\btype:\s*['"]?(\w+)/.exec(profiles);
  return m?.[1];
}

function sqlPathOf(project: string, table: StrataTable): string {
  return `models/${project}/${table.layer ?? "main"}/${table.name}.sql`;
}

function ymlPathOf(project: string, table: StrataTable): string {
  return `models/${project}/${table.layer ?? "main"}/_${table.name}.yml`;
}

function isManaged(files: ProjectFiles, project: string, table: StrataTable): boolean {
  const sql = files[sqlPathOf(project, table)] ?? "";
  if (sql.includes("@generated")) return true;
  const yml = files[ymlPathOf(project, table)];
  if (!yml) return false;
  const doc = asRecord(loadYaml(yml));
  for (const raw of asArray(doc?.models)) {
    const node = asRecord(raw);
    if (asString(node?.name) !== table.name) continue;
    const strata = asRecord(asRecord(asRecord(node?.config)?.meta)?.strata);
    if (strata?.managed === true) return true;
  }
  return false;
}

function catalogOf(tables: StrataTable[]): Map<string, CatalogEntry> {
  const catalog = new Map<string, CatalogEntry>();
  for (const table of tables) {
    const columns = table.columns.map((c) => c.name);
    if (table.kind === "source") {
      const sourceName = table.schema ?? "raw";
      catalog.set(`__src__${sourceName}__${table.name}`, { tableId: table.id, columns });
    } else {
      catalog.set(`__ref__${table.name}`, { tableId: table.id, columns });
    }
  }
  catalog.set("__this__", { tableId: "__this__", columns: [] });
  return catalog;
}

function upstreamsOf(
  sql: string,
  tables: StrataTable[],
): Array<{ tableId: string; columns: string[] }> {
  const out: Array<{ tableId: string; columns: string[] }> = [];
  const seen = new Set<string>();
  const push = (table: StrataTable | undefined) => {
    if (!table || seen.has(table.id)) return;
    seen.add(table.id);
    out.push({ tableId: table.id, columns: table.columns.map((c) => c.name) });
  };
  for (const m of sql.matchAll(REF_RE)) {
    push(tables.find((t) => t.name === m[1] || t.id === m[1]));
  }
  for (const m of sql.matchAll(SOURCE_RE)) {
    push(
      tables.find((t) => t.kind === "source" && (t.schema ?? "raw") === m[1] && t.name === m[2]),
    );
  }
  return out;
}

function declaredByColumn(
  lineageFields: Array<{
    targetTable: string;
    targetColumn: string;
    sourceTable: string;
    sourceColumn: string;
  }>,
  modelId: string,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const l of lineageFields) {
    if (l.targetTable !== modelId) continue;
    const list = map.get(l.targetColumn) ?? [];
    list.push(`${l.sourceTable}.${l.sourceColumn}`);
    map.set(l.targetColumn, list);
  }
  return map;
}

function macrosFromPreprocess(sql: string): Set<string> {
  const macros = new Set<string>();
  for (const m of sql.matchAll(/__jinja_macro_\d+__/g)) macros.add(m[0]);
  return macros;
}

function levelFor(
  col: ResolvedColumn | undefined,
  yamlName: string,
  upstreams: Array<{ tableId: string; columns: string[] }>,
): { level: InferredLineage["level"]; from: LineageOrigin[]; reason?: string } {
  if (col?.dependsOnMacro) {
    return { level: "unknown", from: [], reason: "macro" };
  }
  if (col && !col.unknown && col.origins.length) {
    return { level: "parsed", from: col.origins };
  }
  const fallback = nameFallback(yamlName, upstreams);
  if (fallback) return { level: "name", from: [fallback], reason: "name" };
  return {
    level: "unknown",
    from: [],
    reason: col ? "unresolved" : "yaml_column_absent_from_select",
  };
}

export function inferProject(files: ProjectFiles, project: string): InferResult {
  const model = fromDbtProject(files, project);
  const catalog = catalogOf(model.tables);
  const dismissed = loadDismissed(files, project);
  const dialects = dialectsForAdapter(detectAdapter(files));
  const lineage: InferredLineage[] = [];
  const problems: InferProblem[] = [];

  for (const table of model.tables) {
    if (table.kind !== "model" || table.external) continue;
    if (isManaged(files, project, table)) continue;
    const sql = files[sqlPathOf(project, table)];
    if (sql == null) continue;
    const pre = preprocessJinja(sql);
    const parsed = parseSelect(pre.sql, dialects);
    const yamlCols = table.columns.map((c) => c.name);
    const upstreams = upstreamsOf(sql, model.tables);
    const declared = declaredByColumn(model.lineageFields, table.id);
    if (!parsed.ok) {
      problems.push({ model: table.id, message: `parse: ${parsed.error}` });
    }
    const resolved: ResolvedColumn[] = parsed.ok
      ? resolveQuery(parsed.ast, catalog, macrosFromPreprocess(pre.sql))
      : yamlCols.map((name) => ({
          name,
          origins: [],
          unknown: true,
          dependsOnMacro: false,
        }));
    const byName = new Map(resolved.map((c) => [c.name, c]));
    for (const colName of yamlCols) {
      const col = byName.get(colName);
      const decided = parsed.ok
        ? levelFor(col, colName, upstreams)
        : { level: "unknown" as const, from: [] as LineageOrigin[], reason: "parse" };
      const declaredFrom = declared.get(colName) ?? [];
      if (declaredFrom.length) {
        const inferredRefs = new Set(decided.from.map(originRef));
        for (const from of declaredFrom) {
          if (!inferredRefs.has(from)) {
            problems.push({
              model: table.id,
              column: colName,
              message: "linhagem declarada não encontrada no SQL",
            });
          }
        }
        continue;
      }
      const kept = decided.from.filter(
        (o) => !dismissed.has(lineageKey(table.id, colName, o.relation, o.column)),
      );
      if (decided.level !== "unknown" && kept.length === 0) continue;
      if (decided.level === "unknown") {
        problems.push({
          model: table.id,
          column: colName,
          message: "linhagem não inferida",
        });
      }
      lineage.push({
        target: { model: table.id, column: colName },
        from: decided.level === "unknown" ? [] : kept,
        level: decided.level,
        reason: decided.reason,
      });
    }
  }

  return { lineage, problems };
}

export function inferredToFieldLineage(rows: InferredLineage[]): Array<{
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}> {
  const out: Array<{
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  }> = [];
  for (const row of rows) {
    if (row.level === "unknown") continue;
    for (const origin of row.from) {
      out.push({
        sourceTable: origin.relation,
        sourceColumn: origin.column,
        targetTable: row.target.model,
        targetColumn: row.target.column,
      });
    }
  }
  return out;
}
