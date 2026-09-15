import { findDuplicateColumnName } from "@/features/schema/model/parse";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type ColumnNameError = "empty" | "invalid" | "duplicate";

export function columnNameError(
  name: string,
  existing: string[],
  self?: string,
): ColumnNameError | null {
  const trimmed = name.trim();
  if (!trimmed) return "empty";
  if (!IDENT.test(trimmed)) return "invalid";
  const others = self ? existing.filter((n) => n !== self) : existing;
  if (findDuplicateColumnName(trimmed, others)) return "duplicate";
  return null;
}

export function isValidColumnName(name: string): boolean {
  return IDENT.test(name.trim());
}
