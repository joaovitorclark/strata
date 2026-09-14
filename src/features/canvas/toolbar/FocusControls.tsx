import { useCallback, useEffect, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { CircleDot, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isTypingTarget } from "@/features/command-palette/gestures";
import {
  bumpFocusHops,
  columnHasLineage,
  FOCUS_REST_OPACITY,
  type FocusDirection,
  type FocusHops,
  resolveFocusedTables,
  traceField,
} from "@/features/canvas/utils/focusGraph";
import { focusTableInView } from "@/features/canvas/utils/focusTableView";
import { parseDbml } from "@/features/schema/model/parse";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const PILL_FALLBACK_H = 36;
const PILL_GAP = 12;
const FIT_MS = 250;

/** Path-only animation + --rel-active stroke. Resting lineage stays with S09 defaults. */
const FOCUS_PATH_EDGE_CSS = `
.react-flow__edge.edge--rel-active .react-flow__edge-path,
.react-flow__edge.lineage-flow .react-flow__edge-path {
  stroke: hsl(var(--rel-active));
  stroke-width: 2px;
}
.react-flow__edge.lineage-flow .react-flow__edge-path {
  animation: lineage-flow 1.1s linear infinite;
}
`;

function hopsLabelKey(hops: FocusHops): "hops1" | "hops2" | "hops3" | "hopsAll" {
  if (hops === 1) return "hops1";
  if (hops === 2) return "hops2";
  if (hops === 3) return "hops3";
  return "hopsAll";
}

function directionKey(direction: FocusDirection): "upstream" | "downstream" | "both" {
  if (direction === "up") return "upstream";
  if (direction === "down") return "downstream";
  return "both";
}

type CtxMenu = { x: number; y: number; table: string; column: string };

export function FocusControls() {
  const { t } = useTranslation();
  const { fitView, getNodes, getNode, setCenter } = useReactFlow();
  const focus = useSchemaStore((s) => s.focus);
  const focusFitToken = useSchemaStore((s) => s.focusFitToken);
  const enterTableFocus = useSchemaStore((s) => s.enterTableFocus);
  const enterFieldTrace = useSchemaStore((s) => s.enterFieldTrace);
  const setFocusHops = useSchemaStore((s) => s.setFocusHops);
  const setFocusDirection = useSchemaStore((s) => s.setFocusDirection);
  const dbml = useSchemaStore((s) => s.dbml);
  const relationsVisible = useSchemaStore((s) => s.relationsVisible);
  const lineageVisible = useSchemaStore((s) => s.lineageVisible);
  const hiddenTableIds = useSchemaStore((s) => s.hiddenTableIds);
  const [ctx, setCtx] = useState<CtxMenu | null>(null);

  const endFocus = useCallback(() => {
    const store = useSchemaStore.getState();
    store.exitFocus();
    store.setHovered(null);
    store.clearCanvasSelection();
  }, []);

  const parsed = useMemo(() => (focus ? parseDbml(dbml) : null), [dbml, focus]);

  const focusedIds = useMemo(() => {
    if (!focus || !parsed) return null;
    return resolveFocusedTables(focus, {
      refs: parsed.refs,
      lineageFields: parsed.lineageFields,
      relationsVisible,
      lineageVisible,
      hidden: new Set(hiddenTableIds),
    });
  }, [focus, parsed, relationsVisible, lineageVisible, hiddenTableIds]);

  const tableFocusCss = useMemo(() => {
    if (!focusedIds) return "";
    const rest =
      `.react-flow__node.react-flow__node-table{opacity:${FOCUS_REST_OPACITY}` +
      "!important;pointer-events:none!important}";
    const keep = [...focusedIds]
      .map(
        (id) =>
          `.react-flow__node.react-flow__node-table[data-id="${CSS.escape(id)}"]` +
          "{opacity:1!important;pointer-events:all!important}",
      )
      .join("");
    return rest + keep;
  }, [focusedIds]);

  const trace = useMemo(() => {
    if (focus?.kind !== "field") return null;
    return traceField({
      table: focus.table,
      column: focus.column,
      lineageFields: parsed?.lineageFields ?? [],
    });
  }, [focus, parsed]);

  const fitFocused = useCallback(() => {
    let cancelled = false;
    const tryFit = (attempt = 0) => {
      if (cancelled) return;
      const store = useSchemaStore.getState();
      const current = store.focus;
      if (!current || current.kind !== "tables") return;
      const snapshot = parseDbml(store.dbml);
      const ids = resolveFocusedTables(current, {
        refs: snapshot.refs,
        lineageFields: snapshot.lineageFields,
        relationsVisible: store.relationsVisible,
        lineageVisible: store.lineageVisible,
        hidden: new Set(store.hiddenTableIds),
      });
      if (!ids) return;
      const nodes = getNodes().filter((n) => n.type === "table" && ids.has(n.id));
      if (nodes.length) {
        const pill = document.querySelector("[data-testid='canvas-toolbar']");
        const pillH = pill?.getBoundingClientRect().height || PILL_FALLBACK_H;
        void fitView({
          nodes,
          padding: {
            top: "24px",
            left: "24px",
            right: "24px",
            bottom: `${pillH + PILL_GAP}px`,
          },
          duration: FIT_MS,
        });
        return;
      }
      if (attempt < 40) requestAnimationFrame(() => tryFit(attempt + 1));
    };
    requestAnimationFrame(() => tryFit());
    return () => {
      cancelled = true;
    };
  }, [fitView, getNodes]);

  useEffect(() => {
    if (focusFitToken === 0) return;
    return fitFocused();
  }, [focusFitToken, fitFocused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const store = useSchemaStore.getState();

      if (event.key === "Escape") {
        if (store.selectedColumn) return;
        if (!store.focus) return;
        endFocus();
        return;
      }

      if (event.key === "f" || event.key === "F") {
        if (store.focus) {
          event.preventDefault();
          endFocus();
          return;
        }
        const seeds = store.selectedTableIds;
        if (!seeds.length) return;
        event.preventDefault();
        store.enterTableFocus(seeds);
        return;
      }

      if (event.key === "t" || event.key === "T") {
        const sel = store.selectedColumn;
        if (!sel) return;
        const fields = parseDbml(store.dbml).lineageFields;
        if (!columnHasLineage(sel.table, sel.column, fields)) return;
        event.preventDefault();
        store.enterFieldTrace(sel.table, sel.column);
        return;
      }

      if (store.focus?.kind !== "tables") return;
      if (event.key === "]") {
        event.preventDefault();
        store.setFocusHops(bumpFocusHops(store.focus.hops, 1));
        return;
      }
      if (event.key === "[") {
        event.preventDefault();
        store.setFocusHops(bumpFocusHops(store.focus.hops, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [endFocus]);

  useEffect(() => {
    const onCtx = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, .col-edit, .col-action")) return;
      const row = target?.closest(".col-row");
      if (!row) return;
      const node = row.closest(".react-flow__node");
      const table = node?.getAttribute("data-id");
      const label = row.getAttribute("aria-label") ?? "";
      const column = label.split(",")[0]?.trim();
      if (!table || !column) return;
      const fields = parseDbml(useSchemaStore.getState().dbml).lineageFields;
      if (!columnHasLineage(table, column, fields)) return;
      event.preventDefault();
      setCtx({ x: event.clientX, y: event.clientY, table, column });
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const close = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-testid='focus-trace-context']")) return;
      setCtx(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [ctx]);

  const btn =
    FOCUS_RING +
    " inline-flex h-7 items-center gap-1 rounded-full px-2 font-mono text-2xs text-foreground hover:bg-accent";

  const traceCss = useMemo(() => {
    if (!trace) return "";
    const byTable = new Map<string, string[]>();
    for (const col of trace.columns) {
      const list = byTable.get(col.table) ?? [];
      list.push(col.column);
      byTable.set(col.table, list);
    }
    const rules: string[] = [];
    for (const [table, cols] of byTable) {
      const esc = CSS.escape(table);
      rules.push(`.react-flow__node[data-id="${esc}"] .col-row { opacity: 0.35; }`);
      for (const col of cols) {
        const prefix = `${col.replace(/\\/g, "\\\\").replace(/"/g, '\\"')},`;
        rules.push(
          `.react-flow__node[data-id="${esc}"] .col-row[aria-label^="${prefix}"] {`,
          "  opacity: 1;",
          "  background-color: hsl(var(--primary) / 0.15);",
          "}",
        );
      }
    }
    return rules.join("\n");
  }, [trace]);

  const orderedTrace = useMemo(() => {
    if (!trace) return [];
    return [...trace.columns].sort((a, b) => a.depth - b.depth || a.table.localeCompare(b.table));
  }, [trace]);

  return (
    <div className="flex items-center gap-0.5" data-testid="focus-controls">
      <style data-focus-path-edges="">{FOCUS_PATH_EDGE_CSS}</style>
      {tableFocusCss ? <style data-testid="schema-focus-css">{tableFocusCss}</style> : null}
      {traceCss ? <style data-focus-trace-cols="">{traceCss}</style> : null}

      {focus?.kind === "field" && trace ? (
        <div
          className="flex max-w-[28rem] items-center gap-1 font-mono text-2xs text-foreground"
          data-testid="focus-trace"
        >
          <span aria-hidden>⇢</span>
          <span>
            {t("canvas.toolbar.focusTrace", {
              column: focus.column,
              columns: trace.columns.length,
              tables: new Set(trace.columns.map((c) => c.table)).size,
            })}
          </span>
          {trace.cycle ? (
            <span className="text-warning" data-testid="focus-cycle">
              ⚠ {t("canvas.toolbar.focusCycle")}
            </span>
          ) : null}
          <div className="hidden max-h-24 overflow-y-auto xl:block" data-testid="focus-trace-list">
            {orderedTrace.map((col) => (
              <button
                key={`${col.table}.${col.column}:${col.depth}`}
                type="button"
                className={cn(FOCUS_RING, "block truncate px-1 text-left hover:bg-accent")}
                onClick={() => focusTableInView(getNode, setCenter, col.table)}
              >
                {col.table}.{col.column}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="focus-exit"
            aria-label={t("canvas.toolbar.focusExit")}
            className={btn}
            onClick={endFocus}
          >
            <X size={12} strokeWidth={1.5} />
          </button>
        </div>
      ) : focus?.kind === "tables" ? (
        <>
          <span className="inline-flex items-center gap-1 px-1 font-mono text-2xs text-foreground">
            <CircleDot size={12} strokeWidth={1.5} aria-hidden />
            {t("canvas.toolbar.focus")}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="focus-hops"
                aria-label={t("canvas.toolbar.hopsMenu")}
                className={btn}
              >
                {t(`canvas.toolbar.${hopsLabelKey(focus.hops)}`)} ▾
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="nodrag nopan">
              <DropdownMenuRadioGroup
                value={String(focus.hops)}
                onValueChange={(value) => {
                  const next: FocusHops = value === "all" ? "all" : Number(value);
                  if (next === 1 || next === 2 || next === 3 || next === "all") setFocusHops(next);
                }}
              >
                {(["1", "2", "3", "all"] as const).map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {t(`canvas.toolbar.${hopsLabelKey(value === "all" ? "all" : Number(value))}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="focus-direction"
                aria-label={t("canvas.toolbar.directionMenu")}
                className={btn}
              >
                {t(`canvas.toolbar.${directionKey(focus.direction)}`)} ▾
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="nodrag nopan">
              <DropdownMenuRadioGroup
                value={focus.direction}
                onValueChange={(value) => {
                  if (value === "up" || value === "down" || value === "both") {
                    setFocusDirection(value);
                  }
                }}
              >
                <DropdownMenuRadioItem value="up">
                  {t("canvas.toolbar.upstream")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="down">
                  {t("canvas.toolbar.downstream")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="both">
                  {t("canvas.toolbar.both")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            data-testid="focus-exit"
            aria-label={t("canvas.toolbar.focusExit")}
            className={btn}
            onClick={endFocus}
          >
            <X size={12} strokeWidth={1.5} />
          </button>
        </>
      ) : (
        <button
          type="button"
          data-testid="focus-enter"
          aria-label={t("canvas.toolbar.focusEnter")}
          className={btn}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const seeds = useSchemaStore.getState().selectedTableIds;
            if (!seeds.length) return;
            enterTableFocus(seeds);
          }}
        >
          <CircleDot size={12} strokeWidth={1.5} aria-hidden />
          {t("canvas.toolbar.focusEnter")}
        </button>
      )}

      {ctx ? (
        <button
          type="button"
          data-testid="focus-trace-context"
          className="fixed z-50 rounded-md border border-border bg-card px-2 py-1 font-mono text-2xs text-foreground shadow-md"
          style={{ left: ctx.x, top: ctx.y }}
          onClick={() => {
            enterFieldTrace(ctx.table, ctx.column);
            setCtx(null);
          }}
        >
          {t("canvas.toolbar.traceField")}
        </button>
      ) : null}
    </div>
  );
}
