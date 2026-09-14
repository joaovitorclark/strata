// Bloco customizado `Views {}` — recortes salvos do mesmo modelo (tabelas, posições, detalhe).
// Exportadores ignoram o bloco via cleanDbml (mesmo tratamento de Pins/Colors).

export const TUDO_VIEW_ID = "tudo";

export type ViewDetail = "name" | "keys" | "columns" | "docs";

export type ViewPosition = { x: number; y: number };

export type SchemaView = {
  id: string;
  name: string;
  detail?: ViewDetail;
  tables: string[];
  positions?: Record<string, ViewPosition>;
};

const DETAIL_VALUES = new Set<ViewDetail>(["name", "keys", "columns", "docs"]);

function isViewDetail(value: string): value is ViewDetail {
  return DETAIL_VALUES.has(value as ViewDetail);
}

function stripQuotes(s: string): string {
  return s.replace(/["`]/g, "").trim();
}

function extractViewsInner(src: string): string | null {
  const h = /Views\s*\{/i.exec(src);
  if (!h) return null;
  const start = h.index + h[0].length;
  let depth = 1;
  let i = start;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    i++;
  }
  return src.slice(start, depth === 0 ? i - 1 : src.length);
}

function parsePositions(raw: string): Record<string, ViewPosition> | undefined {
  const positions: Record<string, ViewPosition> = {};
  const re = /([^\s,]+)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    positions[stripQuotes(m[1])] = { x: Number(m[2]), y: Number(m[3]) };
  }
  return Object.keys(positions).length ? positions : undefined;
}

function parseTablesList(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => stripQuotes(t))
    .filter(Boolean);
}

/** Parse de `Views { name [detail: keys] { tables: … positions: … } }`. */
export function parseViewsBlock(src: string): SchemaView[] {
  const inner = extractViewsInner(src);
  if (inner == null) return [];
  const views: SchemaView[] = [];
  const header =
    /("?[^"\s[{]+"?)\s*(?:\[\s*detail\s*:\s*([^\]]+?)\s*\])?\s*\{/gi;
  let m: RegExpExecArray | null;
  while ((m = header.exec(inner))) {
    const name = stripQuotes(m[1]);
    const detailRaw = m[2]?.trim();
    const detail = detailRaw && isViewDetail(detailRaw) ? detailRaw : undefined;
    let depth = 1;
    let i = m.index + m[0].length;
    const bodyStart = i;
    while (i < inner.length && depth > 0) {
      const c = inner[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    const body = inner.slice(bodyStart, depth === 0 ? i - 1 : inner.length);
    let tables: string[] = [];
    let positions: Record<string, ViewPosition> | undefined;
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) continue;
      const tablesM = /^tables\s*:\s*(.*)$/i.exec(line);
      if (tablesM) {
        tables = parseTablesList(tablesM[1]);
        continue;
      }
      const posM = /^positions\s*:\s*(.*)$/i.exec(line);
      if (posM) {
        positions = parsePositions(posM[1]);
      }
    }
    views.push({ id: name, name, ...(detail ? { detail } : {}), tables, ...(positions ? { positions } : {}) });
    header.lastIndex = i;
  }
  return views;
}

function formatCoord(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

function formatPositions(positions: Record<string, ViewPosition>): string {
  return Object.entries(positions)
    .map(([id, p]) => `${id} ${formatCoord(p.x)} ${formatCoord(p.y)}`)
    .join(", ");
}

/** Serializa o bloco `Views {}` (sem o wrapper se a lista estiver vazia). */
export function serializeViewsBlock(views: readonly SchemaView[]): string {
  if (!views.length) return "";
  const inner = views
    .map((view) => {
      const header = view.detail ? `${view.name} [detail: ${view.detail}]` : view.name;
      const lines = [`  ${header} {`, `    tables: ${view.tables.join(", ")}`];
      if (view.positions && Object.keys(view.positions).length) {
        lines.push(`    positions: ${formatPositions(view.positions)}`);
      }
      lines.push("  }");
      return lines.join("\n");
    })
    .join("\n");
  return `Views {\n${inner}\n}\n`;
}

function globPrefix(pattern: string): string | null {
  if (pattern.endsWith(".*")) return pattern.slice(0, -2);
  return null;
}

function tableMatchesPattern(tableId: string, pattern: string): boolean {
  if (pattern === tableId) return true;
  const prefix = globPrefix(pattern);
  if (prefix == null) return false;
  return tableId.startsWith(`${prefix}.`);
}

/** Expande `schema.*` e ids literais contra a lista completa de tabelas. */
export function resolveViewTables(view: SchemaView, allTableIds: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of allTableIds) {
    if (view.tables.some((pattern) => tableMatchesPattern(id, pattern))) out.push(id);
  }
  return out;
}

function renameToken(value: string, oldId: string, newId: string): string {
  if (globPrefix(value) != null) return value;
  return value === oldId ? newId : value;
}

export function renameTableInViews(
  views: readonly SchemaView[],
  oldId: string,
  newId: string,
): SchemaView[] {
  if (!oldId || !newId || oldId === newId) return views.map((v) => ({ ...v }));
  return views.map((view) => {
    const tables = view.tables.map((t) => renameToken(t, oldId, newId));
    if (!view.positions) return { ...view, tables };
    const positions: Record<string, ViewPosition> = {};
    for (const [id, pos] of Object.entries(view.positions)) {
      positions[renameToken(id, oldId, newId)] = pos;
    }
    return { ...view, tables, positions };
  });
}

export function removeTableFromViews(views: readonly SchemaView[], tableId: string): SchemaView[] {
  return views.map((view) => {
    const tables = view.tables.filter((t) => t !== tableId);
    if (!view.positions) return { ...view, tables };
    const positions = { ...view.positions };
    delete positions[tableId];
    return {
      ...view,
      tables,
      ...(Object.keys(positions).length ? { positions } : {}),
    };
  });
}

export function nextViewId(existing: readonly string[], prefix = "view"): string {
  const taken = new Set(existing);
  let n = 1;
  while (taken.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
}

export function uniqueViewId(base: string, existing: readonly string[]): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

/** Grava (ou remove, se vazio) o bloco `Views {}` no documento. */
export function replaceViewsBlock(src: string, views: readonly SchemaView[]): string {
  const serialized = serializeViewsBlock(views);
  const blocksHint = /Views\s*\{/i.test(src);
  if (!blocksHint) {
    if (!serialized) return src;
    const sep = src.endsWith("\n") || src === "" ? "" : "\n";
    return `${src.replace(/\n+$/, "")}${sep}\n${serialized}`.replace(/^\n+/, "");
  }
  const h = /Views\s*\{/i.exec(src);
  if (!h) return src;
  let depth = 0;
  let i = h.index;
  let started = false;
  while (i < src.length) {
    const c = src[i];
    if (c === "{") {
      depth++;
      started = true;
    } else if (c === "}") {
      depth--;
      i++;
      if (started && depth === 0) break;
      continue;
    }
    i++;
  }
  const before = src.slice(0, h.index).replace(/\n+$/, "");
  const after = src.slice(i).replace(/^\n+/, "");
  if (!serialized) {
    const joined = [before, after].filter(Boolean).join("\n\n");
    return joined ? `${joined.replace(/\n+$/, "")}\n` : "";
  }
  const mid = serialized.replace(/\n+$/, "");
  return `${before}${before ? "\n\n" : ""}${mid}${after ? `\n\n${after}` : "\n"}`;
}

export function pruneMissingTablesFromViews(
  views: readonly SchemaView[],
  allTableIds: readonly string[],
): SchemaView[] {
  const known = new Set(allTableIds);
  return views.map((view) => {
    const tables = view.tables.filter((t) => globPrefix(t) != null || known.has(t));
    if (!view.positions) return { ...view, tables };
    const positions: Record<string, ViewPosition> = {};
    for (const [id, pos] of Object.entries(view.positions)) {
      if (known.has(id)) positions[id] = pos;
    }
    return {
      ...view,
      tables,
      ...(Object.keys(positions).length ? { positions } : {}),
    };
  });
}
