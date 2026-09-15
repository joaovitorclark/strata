/** Sugestões de tipo; o typeahead aceita qualquer string livre (ex.: struct<a:int>). */
export const DIALECT_TYPES = [
  "string",
  "text",
  "varchar",
  "bigint",
  "int",
  "smallint",
  "decimal",
  "numeric",
  "float",
  "double",
  "boolean",
  "date",
  "timestamp",
  "timestamptz",
  "json",
  "jsonb",
] as const;

export function filterDialectTypes(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...DIALECT_TYPES];
  return DIALECT_TYPES.filter((t) => t.includes(q));
}
