import type { StateCreator } from "zustand";

export type ViewSlice = {
  hiddenTableIds: string[];
  toggleTableHidden: (id: string) => void;
  setHiddenTables: (ids: string[]) => void;
  showAllTables: () => void;
};

export const createViewSlice: StateCreator<ViewSlice, [["zustand/immer", never]], [], ViewSlice> = (
  set,
) => ({
  hiddenTableIds: [],
  toggleTableHidden: (id) =>
    set((state) => {
      const i = state.hiddenTableIds.indexOf(id);
      if (i >= 0) state.hiddenTableIds.splice(i, 1);
      else state.hiddenTableIds.push(id);
    }),
  setHiddenTables: (ids) =>
    set((state) => {
      state.hiddenTableIds = [...ids];
    }),
  showAllTables: () =>
    set((state) => {
      state.hiddenTableIds = [];
    }),
});
