import type { LineageOrigin } from "./types";

export function nameFallback(
  column: string,
  upstreams: Array<{ tableId: string; columns: string[] }>,
): LineageOrigin | undefined {
  const hits = upstreams.filter((u) => u.columns.includes(column));
  if (hits.length !== 1) return undefined;
  return { relation: hits[0].tableId, column };
}
