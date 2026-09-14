import { useEffect, useRef, useState } from "react";

import { parseDbml } from "@/features/schema/model/parse";
import { TUDO_VIEW_ID } from "@/features/schema/model/views";
import { useSchemaStore } from "@/features/schema/store";
import { parseUrlState, serializeUrlState, type UrlState } from "@/features/shell/urlState";

const WRITE_DEBOUNCE_MS = 300;
const VIEWPORT_APPLY_FRAMES = 48;

export type UrlSyncOptions = {
  focusTableWithPan: (tableId: string) => void;
  switchProject?: (id: string) => Promise<void> | void;
};

type FlowViewport = { x: number; y: number; zoom: number };

type RfStore = {
  getState: () => {
    transform?: [number, number, number];
    panZoom?: { setViewport: (v: FlowViewport, opts?: { duration?: number }) => Promise<unknown> };
  };
};

let pendingWrite: (() => void) | null = null;
let storeWriteTimer: ReturnType<typeof setTimeout> | undefined;
let viewportWriteTimer: ReturnType<typeof setTimeout> | undefined;

export function flushUrlSync(): void {
  if (storeWriteTimer !== undefined) {
    clearTimeout(storeWriteTimer);
    storeWriteTimer = undefined;
  }
  if (viewportWriteTimer !== undefined) {
    clearTimeout(viewportWriteTimer);
    viewportWriteTimer = undefined;
  }
  pendingWrite?.();
}

function scheduleDebounced(kind: "store" | "viewport", write: () => void): void {
  pendingWrite = write;
  const current = kind === "store" ? storeWriteTimer : viewportWriteTimer;
  if (current !== undefined) clearTimeout(current);
  const timer = setTimeout(() => {
    if (kind === "store") storeWriteTimer = undefined;
    else viewportWriteTimer = undefined;
    write();
  }, WRITE_DEBOUNCE_MS);
  if (kind === "store") storeWriteTimer = timer;
  else viewportWriteTimer = timer;
}

function isRfStore(value: unknown): value is RfStore {
  if (!value || typeof value !== "object") return false;
  if (typeof (value as { getState?: unknown }).getState !== "function") return false;
  try {
    const state = (value as RfStore).getState();
    return Array.isArray(state?.transform);
  } catch {
    return false;
  }
}

function walkFiberForStore(start: unknown): RfStore | null {
  const seen = new Set<unknown>();
  let fiber: unknown = start;
  let steps = 0;
  while (fiber && typeof fiber === "object" && !seen.has(fiber) && steps < 80) {
    seen.add(fiber);
    steps += 1;
    const rec = fiber as Record<string, unknown>;
    for (const key of ["memoizedProps", "pendingProps"]) {
      const props = rec[key];
      if (props && typeof props === "object") {
        const value = (props as { value?: unknown }).value;
        if (isRfStore(value)) return value;
        if (isRfStore(props)) return props;
      }
    }
    fiber = rec.return;
  }
  return null;
}

function reactFiber(el: Element): unknown {
  const key = Object.keys(el).find(
    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"),
  );
  return key ? (el as unknown as Record<string, unknown>)[key] : null;
}

function findReactFlowStore(): RfStore | null {
  if (typeof document === "undefined") return null;
  const nodes = document.querySelectorAll(".react-flow, [data-testid='rf__wrapper']");
  for (const el of nodes) {
    const store = walkFiberForStore(reactFiber(el));
    if (store) return store;
  }
  return null;
}

function readDomViewport(): FlowViewport | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!el) return null;
  const style = el.style.transform ?? "";
  const scale = /scale\(\s*(-?[\d.]+)\s*\)/.exec(style);
  const translate = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/.exec(style);
  const matrix = /matrix\(\s*([^)]+)\)/.exec(style);
  if (translate && scale) {
    return { x: Number(translate[1]), y: Number(translate[2]), zoom: Number(scale[1]) };
  }
  if (matrix) {
    const parts = matrix[1].split(",").map((p) => Number(p.trim()));
    if (parts.length >= 6 && parts.every((n) => Number.isFinite(n))) {
      return { x: parts[4], y: parts[5], zoom: parts[0] };
    }
  }
  return null;
}

function getFlowViewport(): FlowViewport | null {
  return readDomViewport();
}

function setFlowViewport(viewport: FlowViewport): boolean {
  const panZoom = findReactFlowStore()?.getState().panZoom;
  if (!panZoom?.setViewport) return false;
  void panZoom.setViewport(viewport, { duration: 0 });
  return true;
}

function writeUrlFromStore(): void {
  if (typeof window === "undefined") return;
  try {
    const store = useSchemaStore.getState();
    const vp = getFlowViewport();
    const extras = parseUrlState(window.location.search).extra;
    const state: UrlState = {
      project: store.currentProjectId || undefined,
      view: store.activeViewId !== TUDO_VIEW_ID ? store.activeViewId : undefined,
      detail: store.detailLevel,
      focus: store.selectedTable || undefined,
      col: store.selectedColumn?.column,
      hidden:
        store.activeViewId === TUDO_VIEW_ID
          ? store.hiddenTableIds
          : (store.hiddenByView[store.activeViewId] ?? []),
      z: vp?.zoom,
      x: vp?.x,
      y: vp?.y,
      extra: extras,
    };
    const href = serializeUrlState(state, window.location.href);
    const next = new URL(href, window.location.origin);
    const target = `${next.pathname}${next.search}${next.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (target === current) return;
    window.history.replaceState(window.history.state, "", target);
  } catch {
    /* replaceState / viewport read must not take down the app */
  }
}

function applyViewport(incoming: Partial<UrlState>): void {
  if (incoming.focus) return;
  if (incoming.z === undefined && incoming.x === undefined && incoming.y === undefined) return;
  let frames = 0;
  const tick = () => {
    const current = getFlowViewport();
    const target: FlowViewport = {
      x: incoming.x ?? current?.x ?? 0,
      y: incoming.y ?? current?.y ?? 0,
      zoom: incoming.z ?? current?.zoom ?? 1,
    };
    const ok = setFlowViewport(target);
    frames += 1;
    if (!ok && frames < VIEWPORT_APPLY_FRAMES) {
      requestAnimationFrame(tick);
    } else if (ok && frames < 12) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

async function applyIncoming(options: UrlSyncOptions): Promise<void> {
  const incoming = parseUrlState(window.location.search);
  const store = useSchemaStore.getState();
  if (incoming.project && incoming.project !== store.currentProjectId) {
    const known = store.projects.some((p) => p.id === incoming.project);
    if (known && options.switchProject) {
      try {
        await options.switchProject(incoming.project);
      } catch {
        /* invalid / missing project — ignore */
      }
    }
  }

  const after = useSchemaStore.getState();
  if (incoming.view) after.setActiveView(incoming.view);
  if (incoming.detail) after.setDetailLevel(incoming.detail);
  if (incoming.hidden) after.setHiddenTables(incoming.hidden);

  const tables = parseDbml(after.dbml).tables;
  const tableIds = new Set(tables.map((t) => t.id));
  if (incoming.focus && tableIds.has(incoming.focus)) {
    options.focusTableWithPan(incoming.focus);
    if (incoming.col) {
      const table = tables.find((t) => t.id === incoming.focus);
      const colExists = table?.columns.some((c) => c.name === incoming.col) ?? false;
      if (colExists) {
        useSchemaStore.getState().selectColumn({ table: incoming.focus, column: incoming.col });
      }
    }
  } else {
    applyViewport(incoming);
  }
}

export function useUrlSync({ focusTableWithPan, switchProject }: UrlSyncOptions): void {
  const dbml = useSchemaStore((s) => s.dbml);
  const currentProjectId = useSchemaStore((s) => s.currentProjectId);
  const detailLevel = useSchemaStore((s) => s.detailLevel);
  const selectedTable = useSchemaStore((s) => s.selectedTable);
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);
  const hiddenTableIds = useSchemaStore((s) => s.hiddenTableIds);
  const activeViewId = useSchemaStore((s) => s.activeViewId);
  const [live, setLive] = useState(false);
  const appliedRef = useRef(false);
  const applyingRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current || applyingRef.current) return;
    if (!dbml) return;
    applyingRef.current = true;
    void applyIncoming({ focusTableWithPan, switchProject })
      .catch(() => {
        /* ignore invalid URL values */
      })
      .finally(() => {
        appliedRef.current = true;
        applyingRef.current = false;
        setLive(true);
      });
  }, [dbml, currentProjectId, focusTableWithPan, switchProject]);

  useEffect(() => {
    if (!live) return;
    scheduleDebounced("store", writeUrlFromStore);
  }, [
    live,
    currentProjectId,
    detailLevel,
    selectedTable,
    selectedColumn,
    hiddenTableIds,
    activeViewId,
  ]);

  useEffect(() => {
    if (!live || typeof document === "undefined") return;
    let observer: MutationObserver | null = null;
    let raf = 0;
    const attach = () => {
      const el = document.querySelector(".react-flow__viewport");
      if (!el) {
        raf = requestAnimationFrame(attach);
        return;
      }
      observer = new MutationObserver(() => {
        if (useSchemaStore.getState().selectedTable) return;
        scheduleDebounced("viewport", writeUrlFromStore);
      });
      observer.observe(el, { attributes: true, attributeFilter: ["style"] });
    };
    attach();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [live]);

  useEffect(() => {
    return () => {
      if (storeWriteTimer !== undefined) {
        clearTimeout(storeWriteTimer);
        storeWriteTimer = undefined;
      }
      if (viewportWriteTimer !== undefined) {
        clearTimeout(viewportWriteTimer);
        viewportWriteTimer = undefined;
      }
      pendingWrite = null;
    };
  }, []);
}
