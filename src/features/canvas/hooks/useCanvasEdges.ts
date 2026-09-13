// Arestas do canvas: rebuild estrutural separado do highlight (Fase 3 perf).
import { useEffect, useLayoutEffect, useRef } from "react";
import type { Edge } from "@xyflow/react";
import type { ParseResult, ParsedFieldLineage } from "@/features/schema/model/parse";
import type { LodState } from "@/features/canvas/utils/lod";
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

export type EdgeBuildInput = {
  parsed: ParseResult;
  aggregatedCrossLinks: AggregatedCrossLink[];
  lineageFields: ParsedFieldLineage[];
  lodByTable: Record<string, LodState>;
  positions: Record<string, { x: number; y: number }>;
  relationsVisible: boolean;
  lineageVisible: boolean;
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

/** Pure builder: field edges when both ends are `full`, else one aggregated edge per pair. */
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
    const bothFull =
      lodOf(lodByTable, first.sourceTable) === "full" && lodOf(lodByTable, first.targetTable) === "full";

    if (bothFull) {
      for (const m of group) {
        if (
          !fieldEdgeVisible(m, opts.lineageMode, focusSet, focusedEdgeId, opts.selectedColumn)
        ) {
          continue;
        }
        const id = fieldEdgeId(m);
        out.push({
          id,
          source: m.sourceTable,
          target: m.targetTable,
          sourceHandle: `fl:s:${m.sourceColumn}`,
          targetHandle: `fl:t:${m.targetColumn}`,
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
  const { parsed, aggregatedCrossLinks, lineageFields, lodByTable, relationsVisible } = input;

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
    lineageVisible: input.lineageVisible,
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
  const inputRef = useRef(input);
  useLayoutEffect(() => {
    inputRef.current = input;
  });

  const fieldFocusKey = input.lineageVisible
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

  const structureKey = [
    input.parsed.refs,
    input.aggregatedCrossLinks,
    input.parsed.tables,
    input.lineageFields,
    input.lodByTable,
    input.relationsVisible,
    input.lineageVisible,
    input.lineageMode,
    input.positions,
    fieldFocusKey,
  ].join("\u0001");

  useEffect(() => {
    const cur = inputRef.current;
    setEdges((prev) => {
      const built = mergeEdgeState(
        prev,
        buildStructuralEdges(cur, cur.onRemoveRef, cur.onRemoveFieldLineage),
      );
      return built;
    });
  }, [structureKey, setEdges]);

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
