import {
  COLUMN_VIRTUAL_ROW_H,
  COLUMN_VIRTUAL_VIEW_ROWS,
} from "@/features/canvas/utils/scaleLimits";
import type { TableNodeData } from "@/features/canvas/actions";
import { TABLE_HEADER_H, TABLE_FOOTER_H } from "@/features/canvas/utils/columnHandleGeometry";

export type LodState = "sigil" | "keys" | "full";

export const LOD_SIGIL_BELOW = 0.55;
export const LOD_FULL_ABOVE = 1.1;

/** Height of the sigil card — header only, no column body. */
export const SIGIL_H = 34;

export function resolveLod(
  zoom: number,
  opts: { pinned?: LodState; selected?: boolean },
): LodState {
  if (opts.pinned) return opts.pinned;
  if (zoom < LOD_SIGIL_BELOW) return "sigil";
  if (opts.selected) return "full";
  return zoom > LOD_FULL_ABOVE ? "full" : "keys";
}

/**
 * Columns the Keys state shows: primary keys, every foreign key, then any the
 * user pinned.
 *
 * Pins arrive as a parameter rather than a field on the column, because pinning
 * is user state that lives in the store (Task 17), not in the parsed model. This
 * function must stay pure — `lodHeight` calls it, and `autolayout` calls that.
 * Task 17 passes real pins; until then callers pass none.
 */
export function keyColumns(
  data: TableNodeData,
  pinned: readonly string[] = [],
): TableNodeData["columns"] {
  const keep = new Set<string>([
    ...(data.meta.pks ?? []),
    ...(data.compositePks?.flat() ?? []),
    ...(data.meta.fks ?? []).map((f) => f.column),
    ...pinned,
  ]);
  return data.columns.filter((c) => keep.has(c.name));
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
): number {
  if (state === "sigil") return SIGIL_H;
  const shown = state === "keys" ? keyColumns(data, pinned).length : data.columns.length;
  const rows =
    state === "keys"
      ? shown + (data.columns.length > shown ? 1 : 0) // +1 for the "+N more" control
      : Math.min(data.columns.length, COLUMN_VIRTUAL_VIEW_ROWS);
  return TABLE_HEADER_H + rows * rowH + TABLE_FOOTER_H;
}
