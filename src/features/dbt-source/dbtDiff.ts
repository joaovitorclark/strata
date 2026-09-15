/** Diff de linhas com números — painel de mudanças D2 (últimas 8 ações). */

export type DiffHunk = { path: string; lines: string[] };

export function lineDiff(
  before: string | null | undefined,
  after: string | null | undefined,
): string[] {
  const a = (before ?? "").split("\n");
  const b = (after ?? "").split("\n");
  if (before == null && after != null) {
    return b.map((line, i) => `${i + 1}+ ${line}`);
  }
  if (after == null && before != null) {
    return a.map((line, i) => `${i + 1}- ${line}`);
  }
  const out: string[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    if (i < a.length && (i >= b.length || a[i] !== b[i])) out.push(`${i + 1}- ${a[i] ?? ""}`);
    if (i < b.length && (i >= a.length || a[i] !== b[i])) out.push(`${i + 1}+ ${b[i] ?? ""}`);
  }
  return out;
}

export function diffFiles(
  previous: Record<string, string | null | undefined>,
  changes: Record<string, string | null>,
): DiffHunk[] {
  return Object.keys(changes)
    .sort()
    .map((path) => ({
      path,
      lines: lineDiff(previous[path], changes[path]),
    }))
    .filter((h) => h.lines.length > 0);
}
