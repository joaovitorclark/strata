import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  ConnectionMode,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TableNode } from "./TableNode";
import { RelationEdge } from "./RelationEdge";
import { LineageEdge } from "./LineageEdge";
import { FieldLineageEdge } from "./FieldLineageEdge";
import { EdgeMarkers } from "./EdgeMarkers";
import { GroupNode } from "./GroupNode";
import { ExternalGroupNode } from "./ExternalGroupNode";
import { SelectionBar } from "@/features/panels/SelectionBar";
import { CanvasDensityContext } from "../hooks/useCanvasDensity";
import {
  aggregateCrossLinks,
  type CrossPageRef,
  type ExternalGroupStub,
} from "../utils/pageFilter";
import { useCanvasEdges } from "../hooks/useCanvasEdges";
import { resolveLod, type LodState } from "../utils/lod";
import {
  useCanvasNodes,
  type NodeExtras,
  type NodeOpts,
  type Positions,
} from "../hooks/useCanvasNodes";
import { useSchemaStore as useInteraction } from "@/features/schema/store";
import type { ParseResult, ParsedFieldLineage } from "@/features/schema/model/parse";
import { tableLineageFrom } from "@/features/schema/model/lineage";
import type { TableSize } from "@/infrastructure/api";
import {
  diagramOverviewBounds,
  focusFieldMappingInView,
  focusTableInView,
} from "../utils/focusTableView";
import {
  MINIMAP_MAX_TABLES,
  SKIP_INITIAL_FIT_TABLES,
  type CanvasDensity,
} from "../utils/scaleLimits";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const isMacOs = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent);

const SHELL_CSS = [
  ".canvas-wrap .react-flow { width: 100%; height: 100%; }",
  ".react-flow__node-group-shell { pointer-events: none !important; }",
  ".canvas-wrap--focus .react-flow__node-table { opacity: 0.45; transition: opacity 0.12s ease; }",
  ".canvas--lineage-mode .react-flow__pane { cursor: default; }",
  ".table-node-shell { position: relative; }",
].join("\n");

const PRIMARY = "hsl(var(--primary))";
const MINIMAP_FALLBACK = "hsl(var(--card))";

/**
 * Regras CSS por id relacionado — evita `setNodes` em hover/seleção (Fase 2 perf).
 * Diferencia a seleção pra não parecer sobreposta: a tabela em foco tem contorno forte
 * (sólido = selecionada; tracejado = tabela da coluna selecionada, #7b); os vizinhos
 * relacionados (FK/linhagem) só ficam sem esmaecer, com um contorno fino secundário.
 */
function CanvasFocusStyles({
  focus,
  related,
  columnFocus,
}: {
  focus: Set<string>;
  related: Set<string> | null;
  columnFocus: boolean;
}) {
  const css = useMemo(() => {
    if (!related?.size) return "";
    const rules: string[] = [];
    for (const id of related) {
      const esc = CSS.escape(id);
      rules.push(`.canvas-wrap--focus .react-flow__node[data-id="${esc}"] { opacity: 1; }`);
      if (!focus.has(id)) {
        // Vizinho relacionado: contorno fino, secundário — não parece "selecionado".
        rules.push(
          `.canvas-wrap--focus .react-flow__node[data-id="${esc}"] {`,
          `  outline: 1px solid ${PRIMARY};`,
          "  outline-offset: 1px;",
          "}",
        );
      }
    }
    for (const id of focus) {
      const esc = CSS.escape(id);
      rules.push(
        `.canvas-wrap--focus .react-flow__node[data-id="${esc}"] {`,
        `  outline: 2px ${columnFocus ? "dashed" : "solid"} ${PRIMARY};`,
        "  outline-offset: 1px;",
        "}",
      );
    }
    return rules.join("\n");
  }, [focus, related, columnFocus]);
  if (!css) return null;
  return <style data-canvas-focus="">{css}</style>;
}

const stripHandle = (h: string | null | undefined) => (h ? h.replace(/^[st]:/, "") : "");

export const nodeTypes = {
  table: TableNode,
  group: GroupNode,
  externalGroup: ExternalGroupNode,
};

export const edgeTypes = {
  relation: RelationEdge,
  lineage: LineageEdge,
  fieldLineage: FieldLineageEdge,
};

export type RefEndpoints = { fromTbl: string; fromCol: string; toTbl: string; toCol: string };

type Props = {
  parsed: ParseResult;
  /** Cor de cabeçalho + metadados pré-computados por tabela (memoização dos nós). */
  nodeExtras: NodeExtras;
  positions: Positions;
  sizes: Record<string, TableSize>;
  onPositionsChange: (p: Positions) => void;
  onCreateRef: (a: string, ac: string, b: string, bc: string) => void;
  onRemoveRef: (a: string, ac: string, b: string, bc: string) => void;
  onRemoveTable: (tableId: string) => void;
  onRemoveTables?: (tableIds: string[]) => void;
  staleWarning?: boolean;
  lineageFields: ParsedFieldLineage[];
  onRemoveFieldLineage: (
    sourceTable: string,
    sourceColumn: string,
    targetTable: string,
    targetColumn: string,
  ) => void;
  onCreateFieldLineage: (
    sourceTable: string,
    sourceColumn: string,
    targetTable: string,
    targetColumn: string,
  ) => void;
  layerOf: (tableId: string) => string | undefined;
  collapsedGroups: string[];
  onToggleGroup: (name: string) => void;
  focusTableId?: string | null;
  /** Incrementa para repetir foco na mesma tabela (ex.: posição recém-atribuída). */
  focusNonce?: number;
  onFocusTableDone?: () => void;
  /** Clique numa tabela (não em coluna) → rola editor DBML + seleciona. */
  onTableClick?: (tableId: string) => void;
  /** Incrementa após Organizar canvas para dar fitView. */
  fitViewTrigger?: number;
  /** Grupos fora da página (stub colapsado). */
  externalStubs?: ExternalGroupStub[];
  /** FKs que cruzam a fronteira da página ativa. */
  crossRefs?: CrossPageRef[];
  /** StatusBar density — cozy 25px / compact 21px row height. */
  density?: CanvasDensity;
};

function fitDiagram(
  getNodes: () => Node[],
  fitBounds: ReturnType<typeof useReactFlow>["fitBounds"],
  duration = 0,
) {
  const bounds = diagramOverviewBounds(getNodes());
  if (!bounds) return false;
  fitBounds(bounds, { padding: 0.14, duration });
  return true;
}

function AutolayoutFitHelper({ trigger }: { trigger?: number }) {
  const { fitBounds, getNodes } = useReactFlow();
  useEffect(() => {
    if (!trigger) return;
    fitDiagram(getNodes, fitBounds, 200);
  }, [trigger, fitBounds, getNodes]);
  return null;
}

function InitialFitHelper({ tableCount }: { tableCount: number }) {
  const { fitBounds, getNodes } = useReactFlow();
  const done = useRef(false);
  const enabled = tableCount > 0 && tableCount <= SKIP_INITIAL_FIT_TABLES;
  useEffect(() => {
    if (!enabled || done.current || tableCount === 0) return;
    let cancelled = false;
    const tryFit = (attempt = 0) => {
      if (cancelled || done.current) return;
      if (fitDiagram(getNodes, fitBounds, 0)) {
        done.current = true;
        return;
      }
      if (attempt < 40) requestAnimationFrame(() => tryFit(attempt + 1));
    };
    requestAnimationFrame(() => tryFit());
    return () => {
      cancelled = true;
    };
  }, [tableCount, fitBounds, getNodes, enabled]);
  return null;
}

function FocusTableHelper({
  tableId,
  focusNonce,
  onDone,
}: {
  tableId: string | null | undefined;
  focusNonce?: number;
  onDone?: () => void;
}) {
  const { setCenter, getNode } = useReactFlow();
  useEffect(() => {
    if (!tableId) return;
    let cancelled = false;
    const tryFocus = (attempt = 0) => {
      if (cancelled) return;
      if (focusTableInView(getNode, setCenter, tableId)) {
        onDone?.();
        return;
      }
      if (attempt < 40) requestAnimationFrame(() => tryFocus(attempt + 1));
      else onDone?.();
    };
    requestAnimationFrame(() => tryFocus());
    return () => {
      cancelled = true;
    };
  }, [tableId, focusNonce, setCenter, getNode, onDone]);
  return null;
}

function FocusFieldMappingHelper() {
  const focused = useInteraction((s) => s.focusedFieldMapping);
  const nonce = useInteraction((s) => s.fieldMappingFocusNonce);
  const { fitBounds, getNode } = useReactFlow();
  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    const tryFocus = (attempt = 0) => {
      if (cancelled) return;
      if (focusFieldMappingInView(getNode, fitBounds, focused.sourceTable, focused.targetTable))
        return;
      if (attempt < 40) requestAnimationFrame(() => tryFocus(attempt + 1));
    };
    requestAnimationFrame(() => tryFocus());
    return () => {
      cancelled = true;
    };
  }, [focused, nonce, fitBounds, getNode]);
  return null;
}

function ViewportZoomSync({ onZoom }: { onZoom: (z: number) => void }) {
  const zoom = useStore((s) => s.transform[2]);
  useEffect(() => {
    onZoom(zoom);
  }, [zoom, onZoom]);
  return null;
}

export function Canvas(props: Props) {
  const {
    parsed,
    nodeExtras,
    positions,
    sizes,
    onPositionsChange,
    onCreateRef,
    onRemoveRef,
    onRemoveTable,
    onRemoveTables,
    staleWarning,
    lineageFields,
    onRemoveFieldLineage,
    onCreateFieldLineage,
    layerOf,
    collapsedGroups,
    onToggleGroup,
    focusTableId,
    focusNonce,
    onFocusTableDone,
    onTableClick,
    fitViewTrigger,
    externalStubs = [],
    crossRefs = [],
    density = "cozy",
  } = props;
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const hovered = useInteraction((s) => s.hoveredTableId);
  const selectedTableIds = useInteraction((s) => s.selectedTableIds);
  const setSelectedTableIds = useInteraction((s) => s.setSelectedTableIds);
  const clearCanvasSelection = useInteraction((s) => s.clearCanvasSelection);
  const focusedFieldMapping = useInteraction((s) => s.focusedFieldMapping);
  const selectFieldLineageMapping = useInteraction((s) => s.selectFieldLineageMapping);
  const setFocusedFieldMapping = useInteraction((s) => s.setFocusedFieldMapping);
  const setHovered = useInteraction((s) => s.setHovered);
  const selectColumn = useInteraction((s) => s.selectColumn);
  const selectedColumn = useInteraction((s) => s.selectedColumn);
  const selectGroup = useInteraction((s) => s.selectGroup);
  const hiddenLayers = useInteraction((s) => s.hiddenLayers);
  const layerDimMode = useInteraction((s) => s.layerDimMode);
  const lineageMode = useInteraction((s) => s.lineageMode);
  const lineageVisible = useInteraction((s) => s.lineageVisible);
  const relationsVisible = useInteraction((s) => s.relationsVisible);
  const selectedTable = useInteraction((s) => s.selectedTable);
  const nodeLod = useInteraction((s) => s.nodeLod);
  const [connecting, setConnecting] = useState(false);
  const [zoom, setZoom] = useState(1);

  const derivedLineage = useMemo(
    () =>
      tableLineageFrom(lineageFields).flatMap((entry) =>
        entry.sources.map((source) => ({ source, target: entry.target })),
      ),
    [lineageFields],
  );

  const lodByTable = useMemo(() => {
    const out: Record<string, LodState> = {};
    for (const t of parsed.tables) {
      out[t.id] = resolveLod(zoom, {
        pinned: nodeLod[t.id],
        selected: selectedTableIds.includes(t.id),
      });
    }
    return out;
  }, [parsed.tables, zoom, nodeLod, selectedTableIds]);

  // Esc desseleciona em pilha: 1º só a coluna (tabela continua selecionada),
  // 2º também a tabela. O editor de nome de coluna trata o próprio Escape.
  // Complementa o onPaneClick, que não mexe na coluna.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const s = useInteraction.getState();
      if (s.selectedColumn) {
        // 1º Escape: só coluna. selectColumn(null) preserva selectedTable/Ids
        // (setados pelo último selectColumn({table, column})).
        selectColumn(null);
      } else {
        // 2º Escape: desseleciona a tabela também.
        clearCanvasSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectColumn, clearCanvasSelection]);

  const focusTables = useMemo(() => {
    if (selectedTableIds.length) return selectedTableIds;
    if (selectedColumn) return [selectedColumn.table];
    if (focusedFieldMapping) {
      return focusedFieldMapping.sourceTable === focusedFieldMapping.targetTable
        ? [focusedFieldMapping.sourceTable]
        : [focusedFieldMapping.sourceTable, focusedFieldMapping.targetTable];
    }
    if (lineageVisible && selectedTable) return [selectedTable];
    if (hovered) return [hovered];
    return [];
  }, [
    selectedTableIds,
    selectedColumn,
    focusedFieldMapping,
    lineageVisible,
    selectedTable,
    hovered,
  ]);

  const focusSet = useMemo(() => new Set(focusTables), [focusTables]);

  const aggregatedCrossLinks = useMemo(
    () => aggregateCrossLinks(crossRefs, externalStubs),
    [crossRefs, externalStubs],
  );

  const related = useMemo(() => {
    if (!focusTables.length) return null;
    const set = new Set<string>(focusTables);
    for (const ft of focusTables) {
      if (!lineageMode) {
        for (const r of parsed.refs) {
          if (r.source === ft) set.add(r.target);
          if (r.target === ft) set.add(r.source);
        }
      }
      if (lineageVisible) {
        for (const l of derivedLineage) {
          if (l.source === ft) set.add(l.target);
          if (l.target === ft) set.add(l.source);
        }
        for (const m of lineageFields) {
          if (m.targetTable === ft || m.sourceTable === ft) {
            set.add(m.targetTable);
            set.add(m.sourceTable);
          }
        }
      }
      for (const link of aggregatedCrossLinks) {
        if (link.visibleTable === ft) set.add(link.stubId);
      }
    }
    return set;
  }, [
    focusTables,
    parsed.refs,
    derivedLineage,
    lineageFields,
    lineageMode,
    lineageVisible,
    aggregatedCrossLinks,
  ]);

  // Visibilidade por camada + colapso → hidden/dim.
  const opts = useMemo<NodeOpts>(() => {
    const collapsed = new Set(collapsedGroups);
    const hidden = new Set<string>();
    const dimmed = new Set<string>();
    for (const t of parsed.tables) {
      const groupHidden = t.group ? collapsed.has(t.group) : false;
      const layer = layerOf(t.id);
      const layerOff = !!layer && hiddenLayers.has(layer);
      if (groupHidden || (layerOff && !layerDimMode)) hidden.add(t.id);
      else if (layerOff && layerDimMode) dimmed.add(t.id);
    }
    const groupColors: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.colors))
      if (k.startsWith("@")) groupColors[k.slice(1)] = v;
    return {
      collapsedGroups: collapsed,
      hiddenTables: hidden,
      dimmedTables: dimmed,
      groupColors,
      onToggleGroup,
      density,
    };
  }, [
    parsed.tables,
    parsed.colors,
    collapsedGroups,
    hiddenLayers,
    layerDimMode,
    layerOf,
    onToggleGroup,
    density,
  ]);

  useCanvasNodes(
    parsed,
    positions,
    setNodes,
    opts,
    nodeExtras,
    externalStubs,
    selectedTableIds,
    sizes,
  );

  useCanvasEdges(setEdges, {
    parsed,
    aggregatedCrossLinks,
    lineageFields,
    lodByTable,
    positions,
    relationsVisible,
    lineageVisible,
    lineageMode,
    focusTables,
    focusedFieldMapping,
    selectedColumn,
    onRemoveRef,
    onRemoveFieldLineage,
  });

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      const ids = selNodes.filter((n) => n.type === "table").map((n) => n.id);
      // Só sincroniza se a seleção do ReactFlow realmente divergiu do estado interno.
      // Caso contrário, é só reflexo de useCanvasNodes ter aplicado `selected: true`
      // baseado em selectedTableIds (ex.: focar uma coluna via command palette, ou
      // clicar numa coluna que também seleciona sua tabela). Sem esse guarda,
      // `selectColumn(null)` apaga a coluna destacada que o usuário acabou de escolher.
      const prev = useInteraction.getState().selectedTableIds;
      const sameAsState = ids.length === prev.length && ids.every((id, idx) => id === prev[idx]);
      setSelectedTableIds(ids);
      if (ids.length && !sameAsState) selectColumn(null);

      const rel = selEdges.find((e) => e.selected && e.type === "relation");
      const ep = (rel?.data as { endpoints?: RefEndpoints } | undefined)?.endpoints;
      useInteraction.getState().setSelectedRef(ep ?? null);

      if (!lineageMode) return;

      const fieldEdge = selEdges.find((e) => e.type === "fieldLineage");
      const mapping = (fieldEdge?.data as { mapping?: typeof focusedFieldMapping })?.mapping;
      if (fieldEdge?.selected && mapping) {
        selectFieldLineageMapping(mapping);
        return;
      }
      if (ids.length === 1 && !fieldEdge?.selected) {
        setFocusedFieldMapping(null);
      }
    },
    [
      lineageMode,
      setSelectedTableIds,
      selectColumn,
      selectFieldLineageMapping,
      setFocusedFieldMapping,
    ],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (c) => {
      if (!c.source || !c.target || c.source === c.target) return false;
      if (lineageMode) {
        return !!c.sourceHandle?.startsWith("fl:s:") && !!c.targetHandle?.startsWith("fl:t:");
      }
      return !!c.sourceHandle?.startsWith("s:") && !!c.targetHandle?.startsWith("t:");
    },
    [lineageMode],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      if (lineageMode) {
        if (c.sourceHandle?.startsWith("fl:s:") && c.targetHandle?.startsWith("fl:t:")) {
          onCreateFieldLineage(
            c.source,
            c.sourceHandle.slice(5),
            c.target,
            c.targetHandle.slice(5),
          );
        }
        return;
      }
      onCreateRef(c.source, stripHandle(c.sourceHandle), c.target, stripHandle(c.targetHandle));
    },
    [lineageMode, onCreateFieldLineage, onCreateRef],
  );

  // Mover grupo inteiro: aplica o delta às tabelas-membro.
  const groupDrag = useRef<{ name: string; last: { x: number; y: number } } | null>(null);
  const onNodeDragStart = useCallback((_: unknown, node: Node) => {
    if (node.type === "group") groupDrag.current = { name: node.id.slice(6), last: node.position };
  }, []);
  const onNodeDrag = useCallback(
    (_: unknown, node: Node) => {
      if (node.type !== "group" || !groupDrag.current) return;
      const dx = node.position.x - groupDrag.current.last.x;
      const dy = node.position.y - groupDrag.current.last.y;
      if (dx === 0 && dy === 0) return;
      const name = groupDrag.current.name;
      setNodes((nds) =>
        nds.map((n) =>
          n.type === "table" && (n.data as { group?: string }).group === name
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n,
        ),
      );
      groupDrag.current.last = node.position;
    },
    [setNodes],
  );
  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      if (node.type === "group") {
        const name = node.id.slice(6);
        const updated = { ...positions };
        for (const n of nodes)
          if (n.type === "table" && (n.data as { group?: string }).group === name)
            updated[n.id] = n.position;
        onPositionsChange(updated);
        groupDrag.current = null;
        return;
      }
      if (node.type !== "table" && node.type !== "externalGroup") return;
      const selectedIds = new Set(
        nodes.filter((n) => n.selected && n.type === "table").map((n) => n.id),
      );
      if (selectedIds.size > 1) {
        const updated = { ...positions };
        for (const n of nodes) {
          if (n.type === "table" && selectedIds.has(n.id)) updated[n.id] = n.position;
        }
        onPositionsChange(updated);
      } else {
        onPositionsChange({ ...positions, [node.id]: node.position });
      }
    },
    [nodes, positions, onPositionsChange],
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const tableIds = deleted.filter((n) => n.type === "table").map((n) => n.id);
      if (!tableIds.length) return;
      if (tableIds.length === 1) onRemoveTable(tableIds[0]);
      else onRemoveTables?.(tableIds);
    },
    [onRemoveTable, onRemoveTables],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const e of deleted) {
        if (e.type === "fieldLineage") (e.data as { onRemove?: () => void })?.onRemove?.();
        else if (e.type !== "lineage") {
          const ep = (e.data as { endpoints?: RefEndpoints } | undefined)?.endpoints;
          if (ep) onRemoveRef(ep.fromTbl, ep.fromCol, ep.toTbl, ep.toCol);
        }
      }
    },
    [onRemoveRef],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, c: Connection) => {
      if (lineageMode || oldEdge.type !== "relation") return;
      const ep = (oldEdge.data as { endpoints?: RefEndpoints } | undefined)?.endpoints;
      if (!ep || !c.source || !c.target) return;
      const fromCol = stripHandle(c.sourceHandle);
      const toCol = stripHandle(c.targetHandle);
      if (!fromCol || !toCol) return;
      onRemoveRef(ep.fromTbl, ep.fromCol, ep.toTbl, ep.toCol);
      onCreateRef(c.source, fromCol, c.target, toCol);
    },
    [lineageMode, onRemoveRef, onCreateRef],
  );

  const tableCount = parsed.tables.length;
  const miniMapLite = tableCount > MINIMAP_MAX_TABLES;

  return (
    <CanvasDensityContext.Provider value={density}>
      <div
        className={cn(
          "canvas-wrap relative h-full w-full",
          related?.size ? "canvas-wrap--focus" : undefined,
        )}
        style={{ "--row-h": `var(--row-${density})` } as CSSProperties}
      >
        <style data-canvas-shell="">{SHELL_CSS}</style>
        <CanvasFocusStyles focus={focusSet} related={related} columnFocus={!!selectedColumn} />
        {staleWarning && (
          <div
            className="absolute left-2 right-2 top-2 z-10 ml-auto max-w-[420px] rounded-md border border-warning bg-card px-3 py-2 text-xs text-foreground shadow-md"
            role="status"
          >
            Canvas mostra último modelo válido — corrija o DBML no editor
          </div>
        )}
        <SelectionBar onRemoveTables={onRemoveTables} />
        <EdgeMarkers />
        <TooltipProvider delayDuration={300}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodesDelete={onNodesDelete}
            onEdgesChange={onEdgesChange}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onConnectStart={lineageMode ? () => setConnecting(true) : undefined}
            onConnectEnd={() => setConnecting(false)}
            isValidConnection={isValidConnection}
            connectionMode={lineageMode ? ConnectionMode.Loose : ConnectionMode.Strict}
            connectionRadius={lineageMode ? 56 : 24}
            nodesConnectable
            connectOnClick={false}
            edgesReconnectable={!lineageMode}
            className={cn(
              "strata-canvas",
              lineageMode && "canvas--lineage-mode",
              lineageMode && connecting && "canvas--lineage-connecting",
            )}
            onEdgesDelete={onEdgesDelete}
            onReconnect={onReconnect}
            deleteKeyCode={["Delete", "Backspace"]}
            onNodeMouseEnter={(_, n) => {
              if (n.type === "table") setHovered(n.id);
            }}
            onNodeMouseLeave={() => setHovered(null)}
            onEdgeMouseEnter={(_, e) => useInteraction.getState().peekEdge(e.id)}
            onEdgeMouseLeave={() => useInteraction.getState().peekEdge(null)}
            onNodeClick={(event, n) => {
              if (n.type === "group") selectGroup(n.id.replace(/^group:/, ""));
              else if (n.type === "table") {
                // Cliques originados em uma linha de coluna (.col-row) NÃO devem disparar
                // onTableClick (pan/foco da tabela). O TableColumnList usa onPointerUp
                // com stopPropagation, mas o d3-drag do React Flow escuta em DOM direto
                // e dispara onNodeClick mesmo assim. Guard aqui evita pan espúrio ao
                // selecionar coluna (regressão introduzida pelo DBML scroll-to-column).
                const target = event.target as HTMLElement | null;
                if (target?.closest?.(".col-row")) return;
                onTableClick?.(n.id);
              }
            }}
            // Clique/arrasto no pane NÃO desseleciona a coluna: o usuário pode arrastar o
            // canvas para seguir uma ligação. A coluna sai com Esc, outra coluna ou outra seleção.
            onPaneClick={() => {
              clearCanvasSelection();
            }}
            onSelectionChange={onSelectionChange}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode={isMacOs() ? "Meta" : "Control"}
            elementsSelectable
            edgesFocusable
            // Tolerância de jitter do mouse (Windows): até 4px de movimento ainda é clique
            // de coluna, não drag do nó — sem isso o onClick da coluna nunca dispara.
            nodeDragThreshold={4}
            minZoom={0.25}
            onlyRenderVisibleElements
          >
            <InitialFitHelper tableCount={tableCount} />
            <AutolayoutFitHelper trigger={fitViewTrigger} />
            <FocusTableHelper
              tableId={focusTableId}
              focusNonce={focusNonce}
              onDone={onFocusTableDone}
            />
            <FocusFieldMappingHelper />
            <ViewportZoomSync onZoom={setZoom} />
            <Controls />
            <MiniMap
              className={miniMapLite ? "minimap--lite" : undefined}
              pannable
              zoomable
              nodeStrokeWidth={0}
              bgColor="hsl(var(--card))"
              maskColor="hsl(var(--background) / 0.65)"
              nodeColor={
                miniMapLite
                  ? () => MINIMAP_FALLBACK
                  : (n) =>
                      n.type === "group"
                        ? "transparent"
                        : ((n.data as { headerColor?: string })?.headerColor ?? MINIMAP_FALLBACK)
              }
            />
          </ReactFlow>
        </TooltipProvider>
      </div>
    </CanvasDensityContext.Provider>
  );
}
