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
import { attachInferredLineage } from "@/features/dbt-source/infer/attach";
import { inferSliceDefaults, type InferSlice } from "@/features/dbt-source/infer/slice";
import { createDocumentSlice, type DocumentSlice, type Positions } from "./documentSlice";
import { createFocusSlice, type FocusSlice } from "./focusSlice";
import { createInteractionSlice, type InteractionSlice } from "./interactionSlice";
import { createViewSlice, type ViewSlice } from "./viewSlice";

enableMapSet();

export type SchemaStore = InteractionSlice &
  LodSlice &
  DocumentSlice &
  ViewSlice &
  FocusSlice &
  InferSlice;

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
    const rawApplyDbtOp = document.applyDbtOp;
    const rawUndo = document.undo;
    const rawRedo = document.redo;
    const get = a[1] as () => SchemaStore;
    const set = a[0] as SchemaStoreSetter;

    const applyInference = () => {
      const s = get();
      if (s.documentFormat !== "dbt" || !s.dbtProject) {
        set((state) => {
          state.inferredLineage = [];
          state.inferProblems = [];
        });
        return;
      }
      const attached = attachInferredLineage(s.files, s.dbtProject, s.dbtParsed);
      set((state) => {
        state.inferredLineage = attached.inferredLineage;
        state.inferProblems = attached.inferProblems;
        state.dbtParsed = attached.parsed;
        const extra = attached.problemMessages;
        state.dbtProblems = [...new Set([...(state.dbtProblems ?? []), ...extra])];
      });
    };

    return {
      ...interaction,
      ...lod,
      ...document,
      ...view,
      ...focus,
      ...inferSliceDefaults,
      toggleInferredVisible: () =>
        set((state) => {
          state.inferredVisible = !state.inferredVisible;
        }),
      setDbml: (update) => {
        if (get().documentFormat === "dbt") return;
        const prev = get().dbml;
        const next = applyUpdate(prev, update);
        const views = parseViewsBlock(next);
        if (!views.length) {
          rawSetDbml(next);
          return;
        }
        const parsedNext = parseDbml(next);
        // A transient parse error (mid-typing) yields zero tables: pruning then would empty
        // every view permanently. Only prune against a document that actually parsed.
        if (parsedNext.error) {
          rawSetDbml(next);
          return;
        }
        const tableIds = parsedNext.tables.map((t) => t.id);
        const pruned = pruneMissingTablesFromViews(views, tableIds);
        rawSetDbml(viewsPruned(views, pruned) ? replaceViewsBlock(next, pruned) : next);
      },
      setPositions: (update) => {
        if (get().documentFormat === "dbt") {
          const next = applyUpdate(get().positions, update);
          get().applyDbtOp({ op: "setPositions", positions: next });
          return;
        }
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
        if (s.documentFormat === "dbt") return;
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
        if (s.documentFormat === "dbt") return;
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
        applyInference();
      },
      applyDbtOp: (action) => {
        rawApplyDbtOp(action);
        applyInference();
      },
      undo: () => {
        rawUndo();
        applyInference();
      },
      redo: () => {
        rawRedo();
        applyInference();
      },
    };
  }),
);

type SchemaStoreSetter = (
  next: SchemaStore | Partial<SchemaStore> | ((state: SchemaStore) => void),
) => void;
