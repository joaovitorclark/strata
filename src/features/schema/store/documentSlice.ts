import type { StateCreator } from "zustand";
import type { SaveState } from "@/features/canvas/utils/statusLabel";
import type { LodSlice } from "@/features/canvas/store/lodSlice";
import { allTablesPage } from "@/features/canvas/utils/pageFilter";
import type { InteractionSlice } from "./interactionSlice";
import type { CanvasPage, ProjectMeta, TableSize } from "@/infrastructure/api";
import { extractRecords, pinnedByTableFromList } from "@/features/schema/model/dbmlClean";
import { migrateCanvasPins } from "@/features/schema/model/edit";
import type { ParseResult } from "@/features/schema/model/parse";
import type { ProjectFiles } from "@/features/dbt-source";
import { fromDbtProject } from "@/features/dbt-source/fromDbtProject";
import { toDisplayDbml } from "@/features/dbt-source/toDisplayDbml";
import { toParseResult } from "@/features/dbt-source/toParseResult";
import { applyDbtAction, type DbtAction } from "@/features/dbt-source/mutations";
import { diffFiles, type DiffHunk } from "@/features/dbt-source/dbtDiff";

export type Positions = Record<string, { x: number; y: number }>;
export type Colors = Record<string, string>;
export type Snapshot = { dbml: string; positions: Positions; colors: Colors };

export type DbtFileSnap = {
  before: Record<string, string | null>;
  after: Record<string, string | null>;
};

export type DbtChangeLogEntry = {
  id: number;
  op: string;
  hunks: DiffHunk[];
};

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
  hydratedProjectId: string | null;
  readOnly: boolean;
  documentFormat: "dbml" | "dbt";
  files: ProjectFiles;
  dbtProject: string;
  dbtParsed: ParseResult | null;
  dbtProblems: string[];
  dbtPast: DbtFileSnap[];
  dbtFuture: DbtFileSnap[];
  lastDbtChanges: Record<string, string | null>;
  dbtPersistGen: number;
  changeLog: DbtChangeLogEntry[];
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
  setHydratedProjectId: (id: string | null) => void;
  setReadOnly: (value: boolean) => void;
  applyDbtOp: (action: DbtAction) => void;
  /** Returns every file change not yet handed to the save queue and clears it. */
  takeDbtChanges: () => Record<string, string | null>;
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
    readOnly?: boolean;
    files?: ProjectFiles;
    documentFormat?: "dbml" | "dbt";
    dbtProject?: string;
    dbtParsed?: ParseResult | null;
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

function syncPinsFromDbml(state: { dbml: string; pinnedByTable: Record<string, string[]> }) {
  state.pinnedByTable = pinnedByTableFromList(extractRecords(state.dbml).pins);
}

type DbtDoc = DocumentSlice & { pinnedByTable: Record<string, string[]> };

function syncDbtDerived(state: DbtDoc): void {
  if (state.documentFormat !== "dbt" || !state.dbtProject) return;
  const model = fromDbtProject(state.files, state.dbtProject);
  state.dbml = toDisplayDbml(model);
  state.positions = { ...(model.canvas?.positions ?? {}) };
  state.sizes = { ...(model.canvas?.sizes ?? {}) };
  state.colors = { ...model.colors };
  state.collapsedGroups = [...(model.canvas?.collapsedGroups ?? [])];
  state.dbtParsed = toParseResult(model);
  state.pinnedByTable = pinnedByTableFromList(model.pins);
}

function applyDbtResult(
  state: DbtDoc,
  result: ReturnType<typeof applyDbtAction>,
  op: string,
): void {
  const paths = Object.keys(result.changes);
  if (!paths.length && !result.problems?.length) return;
  if (paths.length) {
    const before: Record<string, string | null> = {};
    for (const p of paths) before[p] = state.files[p] ?? null;
    state.dbtPast.push({ before, after: result.changes });
    if (state.dbtPast.length > 100) state.dbtPast.shift();
    state.dbtFuture = [];
    state.changeLog = [
      { id: state.dbtPersistGen + 1, op, hunks: diffFiles(before, result.changes) },
      ...state.changeLog,
    ].slice(0, 8);
  }
  state.files = result.files;
  state.lastDbtChanges = { ...state.lastDbtChanges, ...result.changes };
  state.dbtPersistGen += 1;
  state.dbtProblems = result.problems ?? [];
  syncDbtDerived(state);
}

export const createDocumentSlice: StateCreator<
  InteractionSlice & LodSlice & DocumentSlice,
  [["zustand/immer", never]],
  [],
  DocumentSlice
> = (set, get) => ({
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
  hydratedProjectId: null,
  readOnly: false,
  documentFormat: "dbml",
  files: {},
  dbtProject: "",
  dbtParsed: null,
  dbtProblems: [],
  dbtPast: [],
  dbtFuture: [],
  lastDbtChanges: {},
  dbtPersistGen: 0,
  changeLog: [],
  setDbml: (update) =>
    set((state) => {
      state.dbml = applyUpdate(state.dbml, update);
      syncPinsFromDbml(state);
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
  setHydratedProjectId: (id) =>
    set((state) => {
      state.hydratedProjectId = id;
    }),
  setReadOnly: (value) =>
    set((state) => {
      state.readOnly = value;
    }),
  takeDbtChanges: () => {
    const pending = get().lastDbtChanges;
    if (!Object.keys(pending).length) return {};
    set((state) => {
      state.lastDbtChanges = {};
    });
    return { ...pending };
  },
  applyDbtOp: (action) =>
    set((state) => {
      if (state.documentFormat !== "dbt") return;
      const result = applyDbtAction(state.files, state.dbtProject, action);
      applyDbtResult(state, result, action.op);
    }),
  hydrateDocument: (next) =>
    set((state) => {
      state.positions = { ...next.positions };
      state.sizes = { ...next.sizes };
      state.colors = { ...next.colors };
      state.collapsedGroups = [...next.collapsedGroups];
      state.canvasPages = next.canvasPages;
      state.activePageIds = [...next.activePageIds];
      if (next.currentProjectId !== undefined) state.currentProjectId = next.currentProjectId;
      state.dbml = migrateCanvasPins(next.dbml, next.pinnedByTable);
      syncPinsFromDbml(state);
      state.past = [];
      state.future = [];
      state.readOnly = next.readOnly ?? false;
      state.documentFormat = next.documentFormat ?? "dbml";
      state.files = next.files ? { ...next.files } : {};
      state.dbtProject = next.dbtProject ?? "";
      state.dbtParsed = next.dbtParsed ?? null;
      state.dbtProblems = [];
      state.dbtPast = [];
      state.dbtFuture = [];
      state.lastDbtChanges = {};
      state.changeLog = [];
      if (state.documentFormat === "dbt" && state.dbtProject) syncDbtDerived(state);
    }),
  applySnapshot: (snapshot) =>
    set((state) => {
      state.dbml = snapshot.dbml;
      state.positions = { ...snapshot.positions };
      state.colors = { ...snapshot.colors };
      syncPinsFromDbml(state);
    }),
  undo: () =>
    set((state) => {
      if (state.documentFormat === "dbt") {
        if (!state.dbtPast.length) return;
        const prev = state.dbtPast[state.dbtPast.length - 1];
        const currentAfter: Record<string, string | null> = {};
        for (const p of Object.keys(prev.before)) currentAfter[p] = state.files[p] ?? null;
        state.dbtFuture.unshift({ before: currentAfter, after: prev.after });
        state.dbtPast.pop();
        const nextFiles = { ...state.files };
        for (const [p, content] of Object.entries(prev.before)) {
          if (content === null) delete nextFiles[p];
          else nextFiles[p] = content;
        }
        state.files = nextFiles;
        state.lastDbtChanges = { ...state.lastDbtChanges, ...prev.before };
        state.dbtPersistGen += 1;
        state.dbtProblems = [];
        syncDbtDerived(state);
        return;
      }
      if (!state.past.length) return;
      const prev = state.past[state.past.length - 1];
      state.future.unshift(
        cloneSnapshot({ dbml: state.dbml, positions: state.positions, colors: state.colors }),
      );
      state.past.pop();
      state.dbml = prev.dbml;
      state.positions = { ...prev.positions };
      state.colors = { ...prev.colors };
      syncPinsFromDbml(state);
    }),
  redo: () =>
    set((state) => {
      if (state.documentFormat === "dbt") {
        if (!state.dbtFuture.length) return;
        const next = state.dbtFuture[0];
        const currentBefore: Record<string, string | null> = {};
        for (const p of Object.keys(next.after)) currentBefore[p] = state.files[p] ?? null;
        state.dbtPast.push({ before: currentBefore, after: next.after });
        state.dbtFuture.shift();
        const nextFiles = { ...state.files };
        for (const [p, content] of Object.entries(next.after)) {
          if (content === null) delete nextFiles[p];
          else nextFiles[p] = content;
        }
        state.files = nextFiles;
        state.lastDbtChanges = { ...state.lastDbtChanges, ...next.after };
        state.dbtPersistGen += 1;
        syncDbtDerived(state);
        return;
      }
      if (!state.future.length) return;
      const next = state.future[0];
      state.past.push(
        cloneSnapshot({ dbml: state.dbml, positions: state.positions, colors: state.colors }),
      );
      state.future.shift();
      state.dbml = next.dbml;
      state.positions = { ...next.positions };
      state.colors = { ...next.colors };
      syncPinsFromDbml(state);
    }),
  pushHistory: (baseline) =>
    set((state) => {
      if (state.documentFormat === "dbt") return;
      state.past.push(cloneSnapshot(baseline));
      if (state.past.length > 100) state.past.shift();
      state.future = [];
    }),
});
