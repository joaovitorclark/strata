import type { StateCreator } from "zustand";
import type { LodSlice } from "@/features/canvas/store/lodSlice";
import type { DocumentSlice } from "./documentSlice";

export type SelectedColumn = { table: string; column: string } | null;

export type FieldMappingFocus = {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
};

export type InteractionSlice = {
  hoveredTableId: string | null;
  setHovered: (id: string | null) => void;
  selectedColumn: SelectedColumn;
  selectColumn: (sel: SelectedColumn) => void;
  selectedTable: string | null;
  selectedTableIds: string[];
  selectTable: (id: string | null) => void;
  setSelectedTableIds: (ids: string[]) => void;
  selectedGroup: string | null;
  selectGroup: (id: string | null) => void;
  clearCanvasSelection: () => void;

  hiddenLayers: Set<string>;
  toggleLayer: (id: string) => void;
  layerDimMode: boolean;
  toggleDimMode: () => void;

  lineageVisible: boolean;
  toggleLineageVisible: () => void;
  lineageMode: boolean;
  toggleLineageMode: () => void;

  relationsVisible: boolean;
  toggleRelationsVisible: () => void;

  fieldLineageVisible: boolean;
  toggleFieldLineageVisible: () => void;
  focusedFieldMapping: FieldMappingFocus | null;
  setFocusedFieldMapping: (m: InteractionSlice["focusedFieldMapping"]) => void;
  fieldMappingFocusNonce: number;
  focusFieldMapping: (m: FieldMappingFocus) => void;
  selectFieldLineageMapping: (m: FieldMappingFocus) => void;
  mappingPanelOpen: boolean;
  toggleMappingPanel: () => void;
};

export const createInteractionSlice: StateCreator<
  InteractionSlice & LodSlice & DocumentSlice,
  [["zustand/immer", never]],
  [],
  InteractionSlice
> = (set) => ({
  hoveredTableId: null,
  setHovered: (id) =>
    set((state) => {
      state.hoveredTableId = id;
    }),
  selectedColumn: null,
  selectColumn: (sel) =>
    set((state) => {
      state.selectedColumn = sel;
      if (sel) {
        state.selectedTable = sel.table;
        state.selectedTableIds = [sel.table];
        state.selectedGroup = null;
      }
    }),
  selectedTable: null,
  selectedTableIds: [],
  selectTable: (id) =>
    set((state) => {
      state.selectedTable = id;
      state.selectedTableIds = id ? [id] : [];
      state.selectedGroup = null;
      state.selectedColumn = null;
    }),
  setSelectedTableIds: (ids) =>
    set((state) => {
      state.selectedTableIds = ids;
      state.selectedTable = ids[0] ?? null;
      state.selectedGroup = null;
    }),
  selectedGroup: null,
  selectGroup: (id) =>
    set((state) => {
      state.selectedGroup = id;
      state.selectedTable = null;
      state.selectedTableIds = [];
      state.selectedColumn = null;
    }),
  clearCanvasSelection: () =>
    set((state) => {
      state.selectedTable = null;
      state.selectedTableIds = [];
      state.selectedGroup = null;
      state.focusedFieldMapping = null;
    }),

  hiddenLayers: new Set<string>(),
  toggleLayer: (id) =>
    set((state) => {
      if (state.hiddenLayers.has(id)) state.hiddenLayers.delete(id);
      else state.hiddenLayers.add(id);
    }),
  layerDimMode: true,
  toggleDimMode: () =>
    set((state) => {
      state.layerDimMode = !state.layerDimMode;
    }),

  lineageVisible: false,
  toggleLineageVisible: () =>
    set((state) => {
      state.lineageVisible = !state.lineageVisible;
    }),
  lineageMode: false,
  toggleLineageMode: () =>
    set((state) => {
      const next = !state.lineageMode;
      state.lineageMode = next;
      state.relationsVisible = next ? false : state.relationsVisible;
    }),

  relationsVisible: true,
  toggleRelationsVisible: () =>
    set((state) => {
      state.relationsVisible = !state.relationsVisible;
    }),

  fieldLineageVisible: false,
  toggleFieldLineageVisible: () =>
    set((state) => {
      state.fieldLineageVisible = !state.fieldLineageVisible;
    }),
  focusedFieldMapping: null,
  setFocusedFieldMapping: (m) =>
    set((state) => {
      state.focusedFieldMapping = m;
    }),
  fieldMappingFocusNonce: 0,
  focusFieldMapping: (m) =>
    set((state) => {
      state.focusedFieldMapping = m;
      state.fieldLineageVisible = true;
      state.fieldMappingFocusNonce = state.fieldMappingFocusNonce + 1;
    }),
  selectFieldLineageMapping: (m) =>
    set((state) => {
      state.selectedTable = m.targetTable;
      state.selectedTableIds = [m.targetTable];
      state.selectedColumn = { table: m.targetTable, column: m.targetColumn };
      state.selectedGroup = null;
      state.focusedFieldMapping = m;
      state.fieldLineageVisible = true;
      state.fieldMappingFocusNonce = state.fieldMappingFocusNonce + 1;
      state.mappingPanelOpen = true;
    }),
  mappingPanelOpen: false,
  toggleMappingPanel: () =>
    set((state) => {
      state.mappingPanelOpen = !state.mappingPanelOpen;
    }),
});
