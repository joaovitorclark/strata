import type { StateCreator } from "zustand";
import type { FocusDirection, FocusHops } from "@/features/canvas/utils/focusGraph";

export type TableFocusState = {
  kind: "tables";
  seeds: string[];
  hops: FocusHops;
  direction: FocusDirection;
};

export type FieldFocusState = {
  kind: "field";
  table: string;
  column: string;
};

export type FocusState = TableFocusState | FieldFocusState | null;

export type FocusSlice = {
  focus: FocusState;
  focusFitToken: number;
  enterTableFocus: (seeds: string[]) => void;
  enterFieldTrace: (table: string, column: string) => void;
  setFocusHops: (hops: FocusHops) => void;
  setFocusDirection: (direction: FocusDirection) => void;
  exitFocus: () => void;
};

export const createFocusSlice: StateCreator<
  FocusSlice,
  [["zustand/immer", never]],
  [],
  FocusSlice
> = (set) => ({
  focus: null,
  focusFitToken: 0,
  enterTableFocus: (seeds) =>
    set((state) => {
      state.focus = {
        kind: "tables",
        seeds: [...seeds],
        hops: 1,
        direction: "both",
      };
      state.focusFitToken = state.focusFitToken + 1;
    }),
  enterFieldTrace: (table, column) =>
    set((state) => {
      state.focus = { kind: "field", table, column };
    }),
  setFocusHops: (hops) =>
    set((state) => {
      if (state.focus?.kind !== "tables") return;
      state.focus.hops = hops;
    }),
  setFocusDirection: (direction) =>
    set((state) => {
      if (state.focus?.kind !== "tables") return;
      state.focus.direction = direction;
    }),
  exitFocus: () =>
    set((state) => {
      state.focus = null;
    }),
});
