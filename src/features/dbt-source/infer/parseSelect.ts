import { Parser } from "node-sql-parser";

export type ParseSelectOk = { ok: true; ast: unknown; dialect: string };
export type ParseSelectFail = { ok: false; error: string };
export type ParseSelectResult = ParseSelectOk | ParseSelectFail;

export const DEFAULT_DIALECTS = ["mysql", "bigquery", "postgresql", "hive"] as const;

export function dialectsForAdapter(adapter: string | undefined): string[] {
  const a = (adapter ?? "").toLowerCase();
  if (a === "spark" || a === "hive" || a === "databricks") {
    return ["hive", "mysql", "bigquery", "postgresql"];
  }
  if (a === "postgres" || a === "postgresql" || a === "redshift") {
    return ["postgresql", "mysql", "bigquery", "hive"];
  }
  return [...DEFAULT_DIALECTS];
}

export function parseSelect(
  sql: string,
  dialects: readonly string[] = DEFAULT_DIALECTS,
): ParseSelectResult {
  const parser = new Parser();
  let lastError = "parse failed";
  for (const database of dialects) {
    try {
      const ast = parser.astify(sql, { database });
      return { ok: true, ast, dialect: database };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { ok: false, error: lastError };
}
