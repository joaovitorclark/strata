import { enableMapSet } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { parseDbml } from "@/features/schema/model/parse";
import {
  parseViewsBlock,
  pruneMissingTablesFromViews,
  replaceViewsBlock,
  resolveViewTables,
  TUDO_VIEW_ID,
  type SchemaView,
} from "@/features/schema/model/views";
import { createLodSlice, type LodSlice } from "@/features/canvas/store/lodSlice";
import { createDocumentSlice, type DocumentSlice, type Positions } from "./documentSlice";
import { createFocusSlice, type FocusSlice } from "./focusSlice";
import { createInteractionSlice, type InteractionSlice } from "./interactionSlice";
import { createViewSlice, type ViewSlice } from "./viewSlice";

enableMapSet();

export type SchemaStore = InteractionSlice & LodSlice & DocumentSlice & ViewSlice & FocusSlice;

function applyUpdate<T>(prev: T, update: T | ((prev: T) => T)): T {
  return typeof update === "function" ? (update as (prev: T) => T)(prev) : update;
}

function viewsPruned(prev: SchemaView[], next: SchemaView[]): boolean {
  return next.some((view, i) => {
    const before = prev[i];
    return (
      !before ||
      before.tables.length !== view.tables.length ||
      before.tables.some((id, idx) => id !== view.tables[idx]) ||
      Object.keys(before.positions ?? {}).length !== Object.keys(view.positions ?? {}).length
    );
  });
}

function viewTableIds(dbml: string, viewId: string): string[] {
  const view = parseViewsBlock(dbml).find((v) => v.id === viewId);
  if (!view) return [];
  return resolveViewTables(
    view,
    parseDbml(dbml).tables.map((t) => t.id),
  );
}

export const useSchemaStore = create<SchemaStore>()(
  immer((...a) => {
    const interaction = createInteractionSlice(...(a as Parameters<typeof createInteractionSlice>));
    const lod = createLodSlice(...(a as Parameters<typeof createLodSlice>));
    const document = createDocumentSlice(...(a as Parameters<typeof createDocumentSlice>));
    const view = createViewSlice(...(a as unknown as Parameters<typeof createViewSlice>));
    const focus = createFocusSlice(...(a as unknown as Parameters<typeof createFocusSlice>));
    const rawSetPositions = document.setPositions;
    const rawSetDbml = document.setDbml;
    const rawSetDetailLevel = interaction.setDetailLevel;
    const rawHydrate = document.hydrateDocument;
    const get = a[1] as () => SchemaStore;
    const set = a[0] as SchemaStoreSetter;

    return {
      ...interaction,
      ...lod,
      ...document,
      ...view,
      ...focus,
      setDbml: (update) => {
        const prev = get().dbml;
        const next = applyUpdate(prev, update);
        const views = parseViewsBlock(next);
        if (!views.length) {
          rawSetDbml(next);
          return;
        }
        const tableIds = parseDbml(next).tables.map((t) => t.id);
        const pruned = pruneMissingTablesFromViews(views, tableIds);
        rawSetDbml(viewsPruned(views, pruned) ? replaceViewsBlock(next, pruned) : next);
      },
      setPositions: (update) => {
        rawSetPositions(update);
        const s = get();
        if (s.activeViewId === TUDO_VIEW_ID) {
          set((state) => {
            state.tudoPositions = { ...state.positions };
          });
          return;
        }
        const views = parseViewsBlock(s.dbml);
        const current = views.find((v) => v.id === s.activeViewId);
        if (!current) return;
        const nextPos: Positions = { ...(current.positions ?? {}) };
        let changed = false;
        for (const id of viewTableIds(s.dbml, s.activeViewId)) {
          const p = s.positions[id];
          if (!p) continue;
          const prev = nextPos[id];
          if (!prev || prev.x !== p.x || prev.y !== p.y) {
            nextPos[id] = { x: p.x, y: p.y };
            changed = true;
          }
        }
        if (!changed) return;
        current.positions = nextPos;
        const nextDbml = replaceViewsBlock(s.dbml, views);
        if (nextDbml !== s.dbml) s.setDbml(nextDbml);
      },
      setDetailLevel: (level) => {
        rawSetDetailLevel(level);
        const s = get();
        set((state) => {
          state.detailByView[state.activeViewId] = level;
        });
        if (s.activeViewId === TUDO_VIEW_ID) return;
        const views = parseViewsBlock(s.dbml);
        const current = views.find((v) => v.id === s.activeViewId);
        if (!current || current.detail === level) return;
        current.detail = level;
        const nextDbml = replaceViewsBlock(s.dbml, views);
        if (nextDbml !== s.dbml) get().setDbml(nextDbml);
      },
      hydrateDocument: (next) => {
        rawHydrate(next);
        set((state) => {
          state.activeViewId = TUDO_VIEW_ID;
          state.hiddenByView = {};
          state.detailByView = {};
          state.tudoPositions = { ...next.positions };
          state.hiddenTableIds = [];
        });
      },
    };
  }),
);

type SchemaStoreSetter = (
  next: SchemaStore | Partial<SchemaStore> | ((state: SchemaStore) => void),
) => void;
