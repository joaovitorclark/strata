import {
  COLUMN_VIRTUAL_ROW_H,
  COLUMN_VIRTUAL_VIEW_ROWS,
} from "@/features/canvas/utils/scaleLimits";
import type { TableNodeData } from "@/features/canvas/actions";
import { TABLE_HEADER_H, TABLE_FOOTER_H } from "@/features/canvas/utils/columnHandleGeometry";

export type DetailLevel = "name" | "keys" | "columns" | "docs";
export type LodState = "sigil" | "keys" | "full" | "docs";

/** Zoom below this paints column names as 6px bars; content (LOD state) does not change. */
export const LOD_SIMPLIFY_BELOW = 0.35;

/** Height of the sigil card — header only, no column body. */
export const SIGIL_H = 34;

/** Docs note: 11px type, two lines. Must match TableColumnList. */
export const DOCS_NOTE_LINE_H = 11;
export const DOCS_NOTE_MAX_LINES = 2;
export const DOCS_NOTE_BLOCK_H = DOCS_NOTE_LINE_H * DOCS_NOTE_MAX_LINES;

export const DETAIL_LEVELS: readonly DetailLevel[] = ["name", "keys", "columns", "docs"];

const LEVEL_TO_STATE: Record<DetailLevel, LodState> = {
  name: "sigil",
  keys: "keys",
  columns: "full",
  docs: "docs",
};

export function isDetailLevel(value: unknown): value is DetailLevel {
  return value === "name" || value === "keys" || value === "columns" || value === "docs";
}

export function lodStateForLevel(level: DetailLevel): LodState {
  return LEVEL_TO_STATE[level];
}

export function resolveLod(
  zoom: number,
  opts: { level: DetailLevel; pinned?: LodState; selected?: boolean },
): { state: LodState; simplified: boolean } {
  const simplified = zoom < LOD_SIMPLIFY_BELOW;
  if (opts.pinned) return { state: opts.pinned, simplified };
  if (opts.selected && (opts.level === "name" || opts.level === "keys")) {
    return { state: "full", simplified };
  }
  return { state: LEVEL_TO_STATE[opts.level], simplified };
}

/**
 * Columns the Keys state shows: primary keys, every foreign key, then any the
 * user pinned, then columns that participate in field lineage.
 *
 * Pins and lineage arrive as parameters rather than fields on the column,
 * because they are user/document state. This function must stay pure —
 * `lodHeight` calls it, and `autolayout` calls that.
 */
export function keyColumns(
  data: TableNodeData,
  pinned: readonly string[] = [],
  lineageColumns: readonly string[] = [],
): TableNodeData["columns"] {
  const keep = new Set<string>([
    ...(data.meta.pks ?? []),
    ...(data.compositePks?.flat() ?? []),
    ...(data.meta.fks ?? []).map((f) => f.column),
    ...pinned,
    ...lineageColumns,
  ]);
  return data.columns.filter((c) => keep.has(c.name));
}

function docsNotedCount(data: TableNodeData): number {
  return data.columns.filter((c) => Boolean(c.note)).length;
}

function hasTableNote(data: TableNodeData): boolean {
  return Boolean(data.note || data.meta?.note);
}

/**
 * Rendered height per state. `autolayout` positions nodes from this, so it must
 * agree with what TableColumnList actually paints — see Global Constraints.
 */
export function lodHeight(
  data: TableNodeData,
  state: LodState,
  pinned: readonly string[] = [],
  rowH: number = COLUMN_VIRTUAL_ROW_H,
  lineageColumns: readonly string[] = [],
): number {
  if (state === "sigil") return SIGIL_H;
  if (state === "docs") {
    const noted = docsNotedCount(data);
    const tableNote = hasTableNote(data) ? 1 : 0;
    return (
      TABLE_HEADER_H +
      tableNote * DOCS_NOTE_BLOCK_H +
      noted * (rowH + DOCS_NOTE_BLOCK_H) +
      TABLE_FOOTER_H
    );
  }
  const lineage = lineageColumns.length > 0 ? lineageColumns : (data.linkedColumns ?? []);
  const shown = state === "keys" ? keyColumns(data, pinned, lineage).length : data.columns.length;
  const rows =
    state === "keys"
      ? shown + (data.columns.length > shown ? 1 : 0) // +1 for the "+N more" control
      : Math.min(data.columns.length, COLUMN_VIRTUAL_VIEW_ROWS);
  return TABLE_HEADER_H + rows * rowH + TABLE_FOOTER_H;
}
