import { importer } from "@dbml/core";
import { parseDbml } from "@/features/schema/model/parse";

export type PasteFormat = "dbml" | "sql" | "rails" | "unknown";

export type PasteResult =
  { ok: true; dbml: string } | { ok: false; reason: "unsupported" | "invalid" | "empty" };

const DBML_TABLE = /Table\s+\S+\s*\{/;
const SQL_CREATE = /CREATE\s+TABLE/i;
const RAILS_CREATE = /\bcreate_table\b/;
const SQL_FORMATS = ["postgres", "mysql", "mssql"] as const;

export function detectPasteFormat(text: string): PasteFormat {
  if (DBML_TABLE.test(text)) return "dbml";
  if (SQL_CREATE.test(text)) return "sql";
  if (RAILS_CREATE.test(text)) return "rails";
  return "unknown";
}

function importSql(sql: string): string | null {
  for (const format of SQL_FORMATS) {
    try {
      const dbml = importer.import(sql, format);
      const parsed = parseDbml(dbml);
      if (!parsed.error && parsed.tables.length > 0) return dbml;
    } catch {
      /* try the next dialect — do not invent a parser */
    }
  }
  return null;
}

export function pasteToDbml(text: string): PasteResult {
  if (!text.trim()) return { ok: false, reason: "empty" };
  const format = detectPasteFormat(text);
  if (format === "rails") return { ok: false, reason: "unsupported" };
  if (format === "unknown") return { ok: false, reason: "invalid" };
  if (format === "dbml") {
    const parsed = parseDbml(text);
    if (parsed.error || parsed.tables.length === 0) return { ok: false, reason: "invalid" };
    return { ok: true, dbml: text };
  }
  const dbml = importSql(text);
  if (!dbml) return { ok: false, reason: "invalid" };
  return { ok: true, dbml };
}
