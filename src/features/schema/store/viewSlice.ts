import type { StateCreator } from "zustand";
import { parseDbml } from "@/features/schema/model/parse";
import {
  parseViewsBlock,
  pruneMissingTablesFromViews,
  replaceViewsBlock,
  resolveViewTables,
  TUDO_VIEW_ID,
} from "@/features/schema/model/views";
import type { DetailLevel } from "@/features/canvas/utils/lod";
import type { Positions } from "./documentSlice";

export { TUDO_VIEW_ID };

export type ViewSlice = {
  activeViewId: string;
  hiddenTableIds: string[];
  hiddenByView: Record<string, string[]>;
  detailByView: Record<string, DetailLevel>;
  tudoPositions: Positions;
  toggleTableHidden: (id: string) => void;
  setHiddenTables: (ids: string[]) => void;
  showAllTables: () => void;
  setActiveView: (id: string) => void;
  addTableToActiveView: (id: string) => void;
};

type ViewDoc = ViewSlice & {
  dbml: string;
  positions: Positions;
  detailLevel: DetailLevel;
  setDbml: (update: string | ((prev: string) => string)) => void;
};

function asDoc<T>(state: T): ViewDoc {
  return state as unknown as ViewDoc;
}

function allTableIds(dbml: string): string[] {
  return parseDbml(dbml).tables.map((t) => t.id);
}

function inViewIds(dbml: string, viewId: string, tableIds: readonly string[]): Set<string> {
  if (viewId === TUDO_VIEW_ID) return new Set(tableIds);
  const view = parseViewsBlock(dbml).find((v) => v.id === viewId);
  if (!view) return new Set(tableIds);
  return new Set(resolveViewTables(view, tableIds));
}

function userHiddenIds(state: ViewDoc, viewId: string): string[] {
  const tableIds = allTableIds(state.dbml);
  if (viewId === TUDO_VIEW_ID) return [...state.hiddenTableIds];
  const inView = inViewIds(state.dbml, viewId, tableIds);
  return state.hiddenTableIds.filter((id) => inView.has(id));
}

function hiddenForView(state: ViewDoc, viewId: string): string[] {
  const tableIds = allTableIds(state.dbml);
  const user = state.hiddenByView[viewId] ?? [];
  if (viewId === TUDO_VIEW_ID) return [...user];
  const inView = inViewIds(state.dbml, viewId, tableIds);
  const outside = tableIds.filter((id) => !inView.has(id));
  return [...outside, ...user.filter((id) => inView.has(id))];
}

export const createViewSlice: StateCreator<ViewSlice, [["zustand/immer", never]], [], ViewSlice> = (
  set,
  get,
) => ({
  activeViewId: TUDO_VIEW_ID,
  hiddenTableIds: [],
  hiddenByView: {},
  detailByView: {},
  tudoPositions: {},
  toggleTableHidden: (id) =>
    set((state) => {
      const i = state.hiddenTableIds.indexOf(id);
      if (i >= 0) state.hiddenTableIds.splice(i, 1);
      else state.hiddenTableIds.push(id);
      const doc = asDoc(state);
      state.hiddenByView[state.activeViewId] = userHiddenIds(doc, state.activeViewId);
    }),
  setHiddenTables: (ids) =>
    set((state) => {
      const doc = asDoc(state);
      if (state.activeViewId === TUDO_VIEW_ID) {
        state.hiddenTableIds = [...ids];
        state.hiddenByView[TUDO_VIEW_ID] = [...ids];
        return;
      }
      const tableIds = allTableIds(doc.dbml);
      const inView = inViewIds(doc.dbml, state.activeViewId, tableIds);
      const outside = tableIds.filter((tid) => !inView.has(tid));
      const userHidden = ids.filter((tid) => inView.has(tid));
      state.hiddenByView[state.activeViewId] = userHidden;
      state.hiddenTableIds = [...outside, ...userHidden];
    }),
  showAllTables: () =>
    set((state) => {
      const doc = asDoc(state);
      if (state.activeViewId === TUDO_VIEW_ID) {
        state.hiddenTableIds = [];
        state.hiddenByView[TUDO_VIEW_ID] = [];
        return;
      }
      const tableIds = allTableIds(doc.dbml);
      const inView = inViewIds(doc.dbml, state.activeViewId, tableIds);
      state.hiddenByView[state.activeViewId] = [];
      state.hiddenTableIds = tableIds.filter((tid) => !inView.has(tid));
    }),
  setActiveView: (id) =>
    set((state) => {
      const doc = asDoc(state);
      const nextId = id || TUDO_VIEW_ID;
      if (nextId === state.activeViewId) return;
      const views = parseViewsBlock(doc.dbml);
      if (nextId !== TUDO_VIEW_ID && !views.some((v) => v.id === nextId)) return;

      state.hiddenByView[state.activeViewId] = userHiddenIds(doc, state.activeViewId);
      state.detailByView[state.activeViewId] = doc.detailLevel;
      if (state.activeViewId === TUDO_VIEW_ID) {
        state.tudoPositions = { ...doc.positions };
      }

      state.activeViewId = nextId;
      state.hiddenTableIds = hiddenForView(asDoc(state), nextId);

      if (nextId === TUDO_VIEW_ID) {
        doc.positions = { ...state.tudoPositions };
        const tudoDetail = state.detailByView[TUDO_VIEW_ID];
        if (tudoDetail) doc.detailLevel = tudoDetail;
        return;
      }

      const view = views.find((v) => v.id === nextId);
      const viewDetail = view?.detail ?? state.detailByView[nextId];
      if (viewDetail) doc.detailLevel = viewDetail;
      if (view?.positions && Object.keys(view.positions).length) {
        doc.positions = { ...state.tudoPositions, ...view.positions };
      }
    }),
  addTableToActiveView: (id) => {
    const s = asDoc(get());
    if (s.activeViewId === TUDO_VIEW_ID) return;
    const views = parseViewsBlock(s.dbml);
    const view = views.find((v) => v.id === s.activeViewId);
    if (!view) return;
    const tableIds = allTableIds(s.dbml);
    const already = resolveViewTables(view, tableIds).includes(id);
    if (!already) {
      view.tables = [...view.tables, id];
      const pos = s.positions[id] ?? s.tudoPositions[id];
      if (pos) view.positions = { ...view.positions, [id]: { x: pos.x, y: pos.y } };
      s.setDbml(replaceViewsBlock(s.dbml, pruneMissingTablesFromViews(views, tableIds)));
    }
    set((state) => {
      const i = state.hiddenTableIds.indexOf(id);
      if (i >= 0) state.hiddenTableIds.splice(i, 1);
      state.hiddenByView[state.activeViewId] = (
        state.hiddenByView[state.activeViewId] ?? []
      ).filter((hid) => hid !== id);
    });
  },
});
