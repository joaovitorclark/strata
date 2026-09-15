import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { autolayoutPositions } from "@/features/canvas/utils/autolayout";
import { lodStateForLevel } from "@/features/canvas/utils/lod";
import { parseDbml } from "@/features/schema/model/parse";
import {
  nextViewId,
  parseViewsBlock,
  replaceViewsBlock,
  resolveViewTables,
  TUDO_VIEW_ID,
  uniqueViewId,
  type SchemaView,
} from "@/features/schema/model/views";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function pickPositions(
  ids: readonly string[],
  positions: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const id of ids) {
    const p = positions[id];
    if (p) out[id] = { x: p.x, y: p.y };
  }
  return out;
}

export function ViewTabs() {
  const { t } = useTranslation();
  const dbml = useSchemaStore((s) => s.dbml);
  const activeViewId = useSchemaStore((s) => s.activeViewId);
  const selectedTableIds = useSchemaStore((s) => s.selectedTableIds);
  const setActiveView = useSchemaStore((s) => s.setActiveView);
  const selectionRef = useRef<string[]>([]);
  const [menuSelection, setMenuSelection] = useState<string[]>([]);
  const views = parseViewsBlock(dbml);
  const active = views.find((v) => v.id === activeViewId);
  const label =
    activeViewId === TUDO_VIEW_ID ? t("canvas.toolbar.viewAll") : (active?.name ?? activeViewId);
  const named = activeViewId !== TUDO_VIEW_ID;

  useEffect(() => {
    if (activeViewId === TUDO_VIEW_ID) return;
    const store = useSchemaStore.getState();
    const current = parseViewsBlock(store.dbml).find((v) => v.id === activeViewId);
    if (!current) return;
    if (current.positions && Object.keys(current.positions).length) return;
    const parsed = parseDbml(store.dbml);
    const ids = new Set(
      resolveViewTables(
        current,
        parsed.tables.map((tbl) => tbl.id),
      ),
    );
    if (!ids.size) return;
    const subset = { ...parsed, tables: parsed.tables.filter((tbl) => ids.has(tbl.id)) };
    const layout = autolayoutPositions(subset, false, "cozy", lodStateForLevel(store.detailLevel));
    store.setPositions((prev) => ({ ...prev, ...layout }));
  }, [activeViewId]);

  const writeViews = (next: SchemaView[]) => {
    const s = useSchemaStore.getState();
    if (s.documentFormat === "dbt") {
      s.applyDbtOp({ op: "setViews", views: next });
      return;
    }
    s.setDbml((d) => replaceViewsBlock(d, next));
  };

  const rememberSelection = () => {
    const ids = useSchemaStore.getState().selectedTableIds;
    if (ids.length) selectionRef.current = [...ids];
  };

  const createFromSelection = () => {
    const store = useSchemaStore.getState();
    const ids = (menuSelection.length ? menuSelection : selectionRef.current).filter(Boolean);
    if (!ids.length) return;
    const current = parseViewsBlock(store.dbml);
    const id = nextViewId(current.map((v) => v.id));
    const positions = pickPositions(ids, store.positions);
    current.push({
      id,
      name: id,
      detail: store.detailLevel,
      tables: ids,
      ...(Object.keys(positions).length ? { positions } : {}),
    });
    writeViews(current);
    store.setActiveView(id);
    store.clearCanvasSelection();
  };

  const createByLayer = () => {
    const store = useSchemaStore.getState();
    const parsed = parseDbml(store.dbml);
    const current = parseViewsBlock(store.dbml);
    const existing = new Set(current.map((v) => v.id));
    for (const layer of parsed.layerGroups) {
      const id = uniqueViewId(layer.id, [...existing]);
      existing.add(id);
      const tables = [...layer.tables];
      const positions = pickPositions(tables, store.positions);
      current.push({
        id,
        name: layer.name || id,
        detail: store.detailLevel,
        tables,
        ...(Object.keys(positions).length ? { positions } : {}),
      });
    }
    writeViews(current);
  };

  const renameActive = () => {
    if (!named || !active) return;
    const next = window.prompt(t("canvas.toolbar.viewRenamePrompt"), active.name)?.trim();
    if (!next || next === active.name) return;
    const current = parseViewsBlock(useSchemaStore.getState().dbml);
    const taken = current.filter((v) => v.id !== active.id).map((v) => v.id);
    const id = uniqueViewId(next.replace(/\s+/g, "_"), taken);
    writeViews(current.map((v) => (v.id === active.id ? { ...v, id, name: next } : v)));
    useSchemaStore.getState().setActiveView(id);
  };

  const duplicateActive = () => {
    if (!named || !active) return;
    const current = parseViewsBlock(useSchemaStore.getState().dbml);
    const id = uniqueViewId(
      `${active.id}_copy`,
      current.map((v) => v.id),
    );
    current.push({
      ...active,
      id,
      name: id,
      tables: [...active.tables],
      positions: active.positions ? { ...active.positions } : undefined,
    });
    writeViews(current);
    useSchemaStore.getState().setActiveView(id);
  };

  const deleteActive = () => {
    if (!named || !active) return;
    if (!window.confirm(t("canvas.toolbar.viewDeleteConfirm", { name: active.name }))) return;
    const current = parseViewsBlock(useSchemaStore.getState().dbml).filter(
      (v) => v.id !== active.id,
    );
    writeViews(current);
    useSchemaStore.getState().setActiveView(TUDO_VIEW_ID);
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          rememberSelection();
          setMenuSelection(selectionRef.current);
          return;
        }
        setMenuSelection([]);
        queueMicrotask(() => {
          selectionRef.current = [];
        });
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="view-tabs"
          aria-label={t("canvas.toolbar.views")}
          className={cn(
            FOCUS,
            "inline-flex h-7 max-w-[10rem] items-center rounded-full px-2 font-mono text-2xs text-foreground hover:bg-accent",
          )}
          onPointerDown={(event) => {
            event.stopPropagation();
            rememberSelection();
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
            rememberSelection();
          }}
        >
          ▦ {label} ▾
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="nodrag nopan min-w-56"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuRadioGroup value={activeViewId} onValueChange={(id) => setActiveView(id)}>
          <DropdownMenuRadioItem data-testid="view-item-tudo" value={TUDO_VIEW_ID}>
            ▦ {t("canvas.toolbar.viewAll")}
          </DropdownMenuRadioItem>
          {views.map((view) => (
            <DropdownMenuRadioItem
              key={view.id}
              data-testid={`view-item-${view.id}`}
              value={view.id}
            >
              {view.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="view-new-from-selection"
          disabled={menuSelection.length === 0 && selectedTableIds.length === 0}
          onPointerDown={() => rememberSelection()}
          onSelect={createFromSelection}
        >
          {t("canvas.toolbar.viewNewFromSelection")}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="view-new-by-layer" onSelect={createByLayer}>
          {t("canvas.toolbar.viewNewByLayer")}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="view-rename" disabled={!named} onSelect={renameActive}>
          {t("canvas.toolbar.viewRename")}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="view-duplicate" disabled={!named} onSelect={duplicateActive}>
          {t("canvas.toolbar.viewDuplicate")}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="view-delete" disabled={!named} onSelect={deleteActive}>
          {t("canvas.toolbar.viewDelete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
