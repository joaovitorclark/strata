// Arestas do canvas: rebuild estrutural separado do highlight (Fase 3 perf).
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useStore, type Edge } from "@xyflow/react";
import type { ParseResult, ParsedFieldLineage } from "@/features/schema/model/parse";
import { resolveLod, type LodState } from "@/features/canvas/utils/lod";
import { useSchemaStore } from "@/features/schema/store";
import {
  EXTERNAL_SOURCE_HANDLE,
  EXTERNAL_TARGET_HANDLE,
  externalSourceHandle,
  externalTargetHandle,
  type AggregatedCrossLink,
} from "../utils/pageFilter";
import { edgeClassForTier, edgeFocusTier } from "../utils/edgeFocus";

type RefEndpoints = { fromTbl: string; fromCol: string; toTbl: string; toCol: string };

type FocusFieldMapping = {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
} | null;

type SelectedColumn = { table: string; column: string } | null;

export const AGGREGATED_LINEAGE_PREFIX = "fla:";
/** Table-level anchors for aggregated edges (all LODs). */
export const AGGREGATED_SOURCE_HANDLE = "agg-s";
export const AGGREGATED_TARGET_HANDLE = "agg-t";

let flowZoom = 1;
const flowZoomListeners = new Set<() => void>();

function subscribeFlowZoom(onStoreChange: () => void) {
  flowZoomListeners.add(onStoreChange);
  return () => {
    flowZoomListeners.delete(onStoreChange);
  };
}

function publishFlowZoom(next: number) {
  if (flowZoom === next) return;
  flowZoom = next;
  for (const listener of flowZoomListeners) listener();
}

/**
 * Reads xyflow `transform[2]`. Must run under `<ReactFlow>` (column rows / edges).
 * `useCanvasEdges` lives in the Canvas parent and consumes the bridged value.
 */
export function useFlowZoom(): number {
  const zoom = useStore((s) => s.transform[2]);
  useLayoutEffect(() => {
    publishFlowZoom(zoom);
  }, [zoom]);
  return zoom;
}

function useBridgedFlowZoom(): number {
  return useSyncExternalStore(subscribeFlowZoom, () => flowZoom, () => 1);
}

export type EdgeBuildInput = {
  parsed: ParseResult;
  aggregatedCrossLinks: AggregatedCrossLink[];
  lineageFields: ParsedFieldLineage[];
  /** Ignored when present — LOD is resolved inside the hook from viewport + store. */
  lodByTable?: Record<string, LodState>;
  /** Optional unused: S02 merge may still pass table-level links. */
  lineage?: ReadonlyArray<{ source: string; target: string }>;
  positions: Record<string, { x: number; y: number }>;
  relationsVisible: boolean;
  lineageVisible?: boolean;
  showLineageEdges?: boolean;
  lineageMode: boolean;
  focusTables: string[];
  focusedFieldMapping: FocusFieldMapping;
  selectedColumn: SelectedColumn;
  onRemoveRef: (a: string, ac: string, b: string, bc: string) => void;
  onRemoveFieldLineage: (
    sourceTable: string,
    sourceColumn: string,
    targetTable: string,
    targetColumn: string,
  ) => void;
};

function mergeEdgeState(prev: Edge[], next: Edge[]): Edge[] {
  const prevById = new Map(prev.map((e) => [e.id, e] as const));
  return next.map((e) => {
    const prior = prevById.get(e.id);
    if (!prior) return { ...e, interactionWidth: e.interactionWidth ?? 24 };
    return {
      ...e,
      selected: e.selected ?? prior.selected,
      sourceHandle: prior.sourceHandle ?? e.sourceHandle,
      targetHandle: prior.targetHandle ?? e.targetHandle,
      interactionWidth: e.interactionWidth ?? 24,
    };
  });
}

function fieldEdgeId(m: ParsedFieldLineage): string {
  return `fl:${m.sourceTable}.${m.sourceColumn}->${m.targetTable}.${m.targetColumn}`;
}

function pairKey(sourceTable: string, targetTable: string): string {
  return `${sourceTable}\u0000${targetTable}`;
}

function lodOf(lodByTable: Record<string, LodState>, tableId: string): LodState {
  return lodByTable[tableId] ?? "keys";
}

function fieldEdgeVisible(
  m: ParsedFieldLineage,
  lineageMode: boolean,
  focusSet: Set<string>,
  focusedEdgeId: string | null,
  selectedColumn: SelectedColumn,
): boolean {
  if (lineageMode) return true;
  if (selectedColumn) {
    return m.targetTable === selectedColumn.table || m.sourceTable === selectedColumn.table;
  }
  return focusSet.has(m.targetTable) || focusSet.has(m.sourceTable) || fieldEdgeId(m) === focusedEdgeId;
}

/** Pure builder: field edges when neither end is `sigil`, else one aggregated edge per pair. */
export function buildLineageCanvasEdges(
  lineageFields: ParsedFieldLineage[],
  lodByTable: Record<string, LodState>,
  opts: {
    lineageVisible: boolean;
    lineageMode: boolean;
    focusTables: string[];
    focusedFieldMapping: FocusFieldMapping;
    selectedColumn: SelectedColumn;
    onRemoveFieldLineage: EdgeBuildInput["onRemoveFieldLineage"];
  },
): Edge[] {
  if (!opts.lineageVisible) return [];

  const groups = new Map<string, ParsedFieldLineage[]>();
  for (const m of lineageFields) {
    const key = pairKey(m.sourceTable, m.targetTable);
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }

  const focusSet = new Set(opts.focusTables);
  const focusedEdgeId = opts.focusedFieldMapping
    ? `fl:${opts.focusedFieldMapping.sourceTable}.${opts.focusedFieldMapping.sourceColumn}->${opts.focusedFieldMapping.targetTable}.${opts.focusedFieldMapping.targetColumn}`
    : null;

  const out: Edge[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    const bothField =
      lodOf(lodByTable, first.sourceTable) !== "sigil" &&
      lodOf(lodByTable, first.targetTable) !== "sigil";

    if (bothField) {
      for (const m of group) {
        if (
          !fieldEdgeVisible(m, opts.lineageMode, focusSet, focusedEdgeId, opts.selectedColumn)
        ) {
          continue;
        }
        const id = fieldEdgeId(m);
        // `fl:` handles exist only in lineage mode (G18). At full LOD the FK
        // `s:`/`t:` handles are always mounted, so field edges can still attach.
        const sourceHandle = opts.lineageMode
          ? `fl:s:${m.sourceColumn}`
          : `s:${m.sourceColumn}`;
        const targetHandle = opts.lineageMode
          ? `fl:t:${m.targetColumn}`
          : `t:${m.targetColumn}`;
        out.push({
          id,
          source: m.sourceTable,
          target: m.targetTable,
          sourceHandle,
          targetHandle,
          type: "fieldLineage",
          selected: id === focusedEdgeId,
          interactionWidth: 24,
          reconnectable: false,
          data: {
            label: `${m.sourceColumn}→${m.targetColumn}`,
            mapping: {
              sourceTable: m.sourceTable,
              sourceColumn: m.sourceColumn,
              targetTable: m.targetTable,
              targetColumn: m.targetColumn,
            },
            onRemove: () =>
              opts.onRemoveFieldLineage(
                m.sourceTable,
                m.sourceColumn,
                m.targetTable,
                m.targetColumn,
              ),
          },
        });
      }
      continue;
    }

    if (first.sourceTable === first.targetTable) continue;

    out.push({
      id: `${AGGREGATED_LINEAGE_PREFIX}${first.sourceTable}->${first.targetTable}`,
      source: first.sourceTable,
      target: first.targetTable,
      sourceHandle: AGGREGATED_SOURCE_HANDLE,
      targetHandle: AGGREGATED_TARGET_HANDLE,
      type: "lineage",
      interactionWidth: 24,
      reconnectable: false,
      data: {
        count: group.length,
        mappings: group.map((m) => ({
          sourceTable: m.sourceTable,
          sourceColumn: m.sourceColumn,
          targetTable: m.targetTable,
          targetColumn: m.targetColumn,
        })),
      },
    });
  }
  return out;
}

function buildStructuralEdges(
  input: EdgeBuildInput,
  onRemoveRef: EdgeBuildInput["onRemoveRef"],
  onRemoveFieldLineage: EdgeBuildInput["onRemoveFieldLineage"],
): Edge[] {
  const { parsed, aggregatedCrossLinks, lineageFields, relationsVisible } = input;
  const lodByTable = input.lodByTable ?? {};

  const relEdges: Edge[] = relationsVisible
    ? [
        ...parsed.refs.map((r) => {
          const endpoints: RefEndpoints = {
            fromTbl: r.source,
            fromCol: r.fromCol,
            toTbl: r.target,
            toCol: r.toCol,
          };
          return {
            id: r.id,
            source: r.source,
            target: r.target,
            sourceHandle: `s:${r.fromCol}`,
            targetHandle: `t:${r.toCol}`,
            type: "relation",
            interactionWidth: 24,
            data: {
              fromRel: r.fromRel,
              toRel: r.toRel,
              endpoints,
              onRemove: () => onRemoveRef(r.source, r.fromCol, r.target, r.toCol),
            },
          };
        }),
        ...aggregatedCrossLinks.map((link) => {
          if (link.direction === "out") {
            return {
              id: link.id,
              source: link.visibleTable,
              target: link.stubId,
              sourceHandle: externalSourceHandle(link.stubId),
              targetHandle: EXTERNAL_TARGET_HANDLE,
              type: "relation",
              className: "edge--external",
              interactionWidth: 12,
              data: {
                fromRel: "1" as const,
                toRel: "1" as const,
                externalSummary: true,
                linkCount: link.count,
                stubLabel: link.stubLabel,
                externalDetails: link.refs.map((r) => r.remoteLabel),
              },
            };
          }
          return {
            id: link.id,
            source: link.stubId,
            target: link.visibleTable,
            sourceHandle: EXTERNAL_SOURCE_HANDLE,
            targetHandle: externalTargetHandle(link.stubId),
            type: "relation",
            className: "edge--external",
            interactionWidth: 12,
            data: {
              fromRel: "1" as const,
              toRel: "1" as const,
              externalSummary: true,
              linkCount: link.count,
              stubLabel: link.stubLabel,
              externalDetails: link.refs.map((r) => r.remoteLabel),
            },
          };
        }),
      ]
    : [];

  const lineageEdges = buildLineageCanvasEdges(lineageFields, lodByTable, {
    lineageVisible: input.lineageVisible ?? input.showLineageEdges ?? false,
    lineageMode: input.lineageMode,
    focusTables: input.focusTables,
    focusedFieldMapping: input.focusedFieldMapping,
    selectedColumn: input.selectedColumn,
    onRemoveFieldLineage,
  });

  return [...relEdges, ...lineageEdges];
}

function edgeTouchesFocus(
  e: Edge,
  focusTables: string[],
  aggregatedCrossLinks: AggregatedCrossLink[],
): boolean {
  if (e.type === "fieldLineage") {
    return !!e.selected || focusTables.includes(e.source) || focusTables.includes(e.target);
  }
  if (e.className?.includes("edge--external")) {
    return (
      focusTables.includes(e.source) ||
      focusTables.includes(e.target) ||
      aggregatedCrossLinks.some(
        (link) =>
          link.id === e.id &&
          (focusTables.includes(link.visibleTable) || focusTables.includes(link.stubId)),
      )
    );
  }
  return focusTables.some((ft) => e.source === ft || e.target === ft);
}

function applyEdgeHighlight(
  e: Edge,
  touches: boolean,
  focusActive: boolean,
  selectedColumn: SelectedColumn,
  lineageMode: boolean,
): Edge {
  if (selectedColumn) {
    const tier = edgeFocusTier(e, selectedColumn);
    const active = e.selected || tier === "primary";
    const highlightCls = edgeClassForTier(e, tier, !!e.selected);
    return {
      ...e,
      animated: false,
      className: highlightCls,
      data: {
        ...e.data,
        highlighted: active,
        dimmed: tier === "dimmed" && !e.selected,
        muted: tier === "secondary" && !e.selected,
        emphasized: tier === "primary" && !e.selected,
      },
    };
  }

  if (lineageMode && e.type === "fieldLineage") {
    const strong = e.selected || touches;
    return {
      ...e,
      animated: false,
      className: strong
        ? "edge--highlight edge--field-lineage"
        : "edge--field-lineage edge--field-lineage-soft",
      data: { ...e.data, highlighted: strong, dimmed: false, muted: false, emphasized: false },
    };
  }

  const active = e.selected || touches;
  const highlightCls =
    e.type === "lineage"
      ? active
        ? "edge--highlight edge--lineage"
        : "edge--dimmed"
      : e.type === "fieldLineage"
        ? active
          ? "edge--highlight edge--field-lineage"
          : "edge--dimmed"
        : active
          ? "edge--highlight"
          : "edge--dimmed";
  return {
    ...e,
    animated: active && e.type !== "fieldLineage" && e.type !== "lineage" && !e.selected,
    className: focusActive || e.selected ? highlightCls : undefined,
    data: {
      ...e.data,
      highlighted: focusActive || e.selected ? active : false,
      dimmed: focusActive || e.selected ? !active : false,
      emphasized: false,
    },
  };
}

function highlightPatchEqual(a: Edge, b: Edge): boolean {
  return (
    a.className === b.className &&
    a.animated === b.animated &&
    (a.data as { highlighted?: boolean })?.highlighted ===
      (b.data as { highlighted?: boolean })?.highlighted &&
    (a.data as { dimmed?: boolean })?.dimmed === (b.data as { dimmed?: boolean })?.dimmed &&
    (a.data as { muted?: boolean })?.muted === (b.data as { muted?: boolean })?.muted &&
    (a.data as { emphasized?: boolean })?.emphasized ===
      (b.data as { emphasized?: boolean })?.emphasized
  );
}

export function useCanvasEdges(
  setEdges: (updater: (prev: Edge[]) => Edge[]) => void,
  input: EdgeBuildInput,
): void {
  const zoom = useBridgedFlowZoom();
  const nodeLod = useSchemaStore((s) => s.nodeLod);
  const selectedTableIds = useSchemaStore((s) => s.selectedTableIds);
  const detailLevel = useSchemaStore((s) => s.detailLevel);
  const lineageVisible = input.lineageVisible ?? input.showLineageEdges ?? false;

  const lodByTable = useMemo(() => {
    const out: Record<string, LodState> = {};
    const ids = new Set<string>();
    for (const t of input.parsed.tables) ids.add(t.id);
    for (const m of input.lineageFields) {
      ids.add(m.sourceTable);
      ids.add(m.targetTable);
    }
    const selected = new Set(selectedTableIds);
    for (const id of ids) {
      out[id] = resolveLod(zoom, {
        level: detailLevel,
        pinned: nodeLod[id],
        selected: selected.has(id),
      }).state;
    }
    return out;
  }, [input.parsed.tables, input.lineageFields, zoom, nodeLod, selectedTableIds, detailLevel]);

  const inputRef = useRef(input);
  const lodRef = useRef(lodByTable);
  useLayoutEffect(() => {
    inputRef.current = input;
    lodRef.current = lodByTable;
  });

  const fieldFocusKey = lineageVisible
    ? [
        input.focusTables.join("\u0000"),
        input.focusedFieldMapping?.sourceTable ?? "",
        input.focusedFieldMapping?.sourceColumn ?? "",
        input.focusedFieldMapping?.targetTable ?? "",
        input.focusedFieldMapping?.targetColumn ?? "",
        input.selectedColumn?.table ?? "",
        input.selectedColumn?.column ?? "",
      ].join("\u0002")
    : "";

  const lodKey = Object.keys(lodByTable)
    .sort()
    .map((id) => `${id}:${lodByTable[id] ?? ""}`)
    .join("\u0000");

  const structureKey = [
    input.parsed.refs,
    input.aggregatedCrossLinks,
    input.parsed.tables,
    input.lineageFields,
    lodKey,
    input.relationsVisible,
    lineageVisible,
    input.lineageMode,
    input.positions,
    fieldFocusKey,
  ].join("\u0001");

  useEffect(() => {
    const cur = inputRef.current;
    setEdges((prev) => {
      const built = mergeEdgeState(
        prev,
        buildStructuralEdges(
          { ...cur, lodByTable: lodRef.current, lineageVisible },
          cur.onRemoveRef,
          cur.onRemoveFieldLineage,
        ),
      );
      return built;
    });
  }, [structureKey, setEdges, lineageVisible]);

  const highlightKey = [
    input.focusTables.join("\u0000"),
    input.selectedColumn?.table ?? "",
    input.selectedColumn?.column ?? "",
    String(input.lineageMode),
  ].join("\u0001");

  useEffect(() => {
    const cur = inputRef.current;
    const focusActive = cur.focusTables.length > 0;
    setEdges((prev) => {
      let changed = false;
      const next = prev.map((e) => {
        if (e.type !== "relation" && e.type !== "lineage" && e.type !== "fieldLineage") return e;
        const touches = edgeTouchesFocus(e, cur.focusTables, cur.aggregatedCrossLinks);
        const patched = applyEdgeHighlight(
          e,
          touches,
          focusActive,
          cur.selectedColumn,
          cur.lineageMode,
        );
        if (highlightPatchEqual(e, patched)) return e;
        changed = true;
        return patched;
      });
      return changed ? next : prev;
    });
  }, [highlightKey, structureKey, setEdges, input.aggregatedCrossLinks]);
}
