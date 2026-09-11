import type { StateCreator } from "zustand";
import type { LodState } from "@/features/canvas/utils/lod";
import type { InteractionSlice } from "@/features/schema/store/interactionSlice";
import type { DocumentSlice } from "@/features/schema/store/documentSlice";

const EMPTY_PINS: readonly string[] = [];

/** Pins destined for dbt `meta.strata.pinned` (identity.md §7). */
export type StrataMeta = {
  pinned: string[];
};

export type LodSlice = {
  pinnedByTable: Record<string, string[]>;
  pinColumn: (tableId: string, column: string) => void;
  unpinColumn: (tableId: string, column: string) => void;
  pinnedColumns: (tableId: string) => readonly string[];
  nodeLod: Record<string, LodState>;
  setNodeLod: (tableId: string, lod: LodState) => void;
  peekedEdge: string | null;
  peekEdge: (id: string | null) => void;
};

export const createLodSlice: StateCreator<
  InteractionSlice & LodSlice & DocumentSlice,
  [["zustand/immer", never]],
  [],
  LodSlice
> = (set, get) => ({
  pinnedByTable: {},
  pinColumn: (tableId, column) =>
    set((state) => {
      const list = state.pinnedByTable[tableId];
      if (!list) {
        state.pinnedByTable[tableId] = [column];
        return;
      }
      if (!list.includes(column)) list.push(column);
    }),
  unpinColumn: (tableId, column) =>
    set((state) => {
      const list = state.pinnedByTable[tableId];
      if (!list) return;
      state.pinnedByTable[tableId] = list.filter((name) => name !== column);
    }),
  pinnedColumns: (tableId) => get().pinnedByTable[tableId] ?? EMPTY_PINS,
  nodeLod: {},
  setNodeLod: (tableId, lod) =>
    set((state) => {
      state.nodeLod[tableId] = lod;
    }),
  peekedEdge: null,
  peekEdge: (id) =>
    set((state) => {
      state.peekedEdge = id;
    }),
});
