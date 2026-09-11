import type { StateCreator } from "zustand";
import type { SaveState } from "@/features/canvas/utils/statusLabel";
import type { LodSlice } from "@/features/canvas/store/lodSlice";
import { allTablesPage } from "@/features/canvas/utils/pageFilter";
import type { InteractionSlice } from "./interactionSlice";
import type { CanvasPage, ProjectMeta, TableSize } from "@/infrastructure/api";

export type Positions = Record<string, { x: number; y: number }>;
export type Colors = Record<string, string>;
export type Snapshot = { dbml: string; positions: Positions; colors: Colors };

export type DocumentSlice = {
  dbml: string;
  positions: Positions;
  sizes: Record<string, TableSize>;
  colors: Colors;
  collapsedGroups: string[];
  canvasPages: CanvasPage[];
  activePageIds: string[];
  past: Snapshot[];
  future: Snapshot[];
  saveState: SaveState;
  autoSave: boolean;
  currentProjectId: string;
  projects: ProjectMeta[];
  pinnedProjectId: string | null;
  setDbml: (update: string | ((prev: string) => string)) => void;
  setPositions: (update: Positions | ((prev: Positions) => Positions)) => void;
  setSizes: (
    update:
      Record<string, TableSize> | ((prev: Record<string, TableSize>) => Record<string, TableSize>),
  ) => void;
  setColors: (update: Colors | ((prev: Colors) => Colors)) => void;
  setCollapsedGroups: (update: string[] | ((prev: string[]) => string[])) => void;
  setCanvasPages: (update: CanvasPage[] | ((prev: CanvasPage[]) => CanvasPage[])) => void;
  setActivePageIds: (update: string[] | ((prev: string[]) => string[])) => void;
  setSaveState: (update: SaveState | ((prev: SaveState) => SaveState)) => void;
  setAutoSave: (value: boolean | ((prev: boolean) => boolean)) => void;
  setCurrentProjectId: (id: string) => void;
  setProjects: (projects: ProjectMeta[]) => void;
  setPinnedProjectId: (id: string | null) => void;
  hydrateDocument: (next: {
    dbml: string;
    positions: Positions;
    sizes: Record<string, TableSize>;
    colors: Colors;
    collapsedGroups: string[];
    canvasPages: CanvasPage[];
    activePageIds: string[];
    currentProjectId?: string;
    pinnedByTable?: Record<string, string[]>;
  }) => void;
  applySnapshot: (snapshot: Snapshot) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: (baseline: Snapshot) => void;
};

function applyUpdate<T>(prev: T, update: T | ((prev: T) => T)): T {
  return typeof update === "function" ? (update as (prev: T) => T)(prev) : update;
}

function cloneSnapshot(s: Snapshot): Snapshot {
  return { dbml: s.dbml, positions: { ...s.positions }, colors: { ...s.colors } };
}

export const createDocumentSlice: StateCreator<
  InteractionSlice & LodSlice & DocumentSlice,
  [["zustand/immer", never]],
  [],
  DocumentSlice
> = (set) => ({
  dbml: "",
  positions: {},
  sizes: {},
  colors: {},
  collapsedGroups: [],
  canvasPages: [allTablesPage()],
  activePageIds: [],
  past: [],
  future: [],
  saveState: "idle",
  autoSave: false,
  currentProjectId: "",
  projects: [],
  pinnedProjectId: null,
  setDbml: (update) =>
    set((state) => {
      state.dbml = applyUpdate(state.dbml, update);
    }),
  setPositions: (update) =>
    set((state) => {
      state.positions = applyUpdate(state.positions, update);
    }),
  setSizes: (update) =>
    set((state) => {
      state.sizes = applyUpdate(state.sizes, update);
    }),
  setColors: (update) =>
    set((state) => {
      state.colors = applyUpdate(state.colors, update);
    }),
  setCollapsedGroups: (update) =>
    set((state) => {
      state.collapsedGroups = applyUpdate(state.collapsedGroups, update);
    }),
  setCanvasPages: (update) =>
    set((state) => {
      state.canvasPages = applyUpdate(state.canvasPages, update);
    }),
  setActivePageIds: (update) =>
    set((state) => {
      state.activePageIds = applyUpdate(state.activePageIds, update);
    }),
  setSaveState: (update) =>
    set((state) => {
      state.saveState = applyUpdate(state.saveState, update);
    }),
  setAutoSave: (value) =>
    set((state) => {
      state.autoSave = typeof value === "function" ? value(state.autoSave) : value;
    }),
  setCurrentProjectId: (id) =>
    set((state) => {
      state.currentProjectId = id;
    }),
  setProjects: (projects) =>
    set((state) => {
      state.projects = projects;
    }),
  setPinnedProjectId: (id) =>
    set((state) => {
      state.pinnedProjectId = id;
    }),
  hydrateDocument: (next) =>
    set((state) => {
      state.dbml = next.dbml;
      state.positions = { ...next.positions };
      state.sizes = { ...next.sizes };
      state.colors = { ...next.colors };
      state.collapsedGroups = [...next.collapsedGroups];
      state.canvasPages = next.canvasPages;
      state.activePageIds = [...next.activePageIds];
      if (next.currentProjectId !== undefined) state.currentProjectId = next.currentProjectId;
      state.pinnedByTable = Object.fromEntries(
        Object.entries(next.pinnedByTable ?? {}).map(([id, cols]) => [id, [...cols]]),
      );
      state.past = [];
      state.future = [];
    }),
  applySnapshot: (snapshot) =>
    set((state) => {
      state.dbml = snapshot.dbml;
      state.positions = { ...snapshot.positions };
      state.colors = { ...snapshot.colors };
    }),
  undo: () =>
    set((state) => {
      if (!state.past.length) return;
      const prev = state.past[state.past.length - 1];
      state.future.unshift(
        cloneSnapshot({ dbml: state.dbml, positions: state.positions, colors: state.colors }),
      );
      state.past.pop();
      state.dbml = prev.dbml;
      state.positions = { ...prev.positions };
      state.colors = { ...prev.colors };
    }),
  redo: () =>
    set((state) => {
      if (!state.future.length) return;
      const next = state.future[0];
      state.past.push(
        cloneSnapshot({ dbml: state.dbml, positions: state.positions, colors: state.colors }),
      );
      state.future.shift();
      state.dbml = next.dbml;
      state.positions = { ...next.positions };
      state.colors = { ...next.colors };
    }),
  pushHistory: (baseline) =>
    set((state) => {
      state.past.push(cloneSnapshot(baseline));
      if (state.past.length > 100) state.past.shift();
      state.future = [];
    }),
});
