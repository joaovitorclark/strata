import { memo, useEffect, useRef, useState } from "react";
import {
  Handle,
  NodeResizeControl,
  Position,
  useEdges,
  useNodeId,
  useStore,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCanvasActions, type TableNodeData } from "@/features/canvas/actions";
import { TableColumnList } from "@/features/canvas/components/TableColumnList";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import {
  AGGREGATED_SOURCE_HANDLE,
  AGGREGATED_TARGET_HANDLE,
} from "@/features/canvas/hooks/useCanvasEdges";
import { resolveLod, type LodState } from "@/features/canvas/utils/lod";
import { TABLE_FOOTER_H, TABLE_HEADER_H } from "@/features/canvas/utils/columnHandleGeometry";
import { useSchemaStore } from "@/features/schema/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function layerEdgeClass(layerId: string | undefined): string {
  switch ((layerId ?? "").toLowerCase()) {
    case "bronze":
      return "bg-layer-bronze";
    case "silver":
    case "prata":
      return "bg-layer-silver";
    case "gold":
    case "ouro":
      return "bg-layer-gold";
    default:
      return "bg-layer-raw";
  }
}

const PEEK_OPACITY = 0.34;

type PeekEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: {
    endpoints?: { fromTbl: string; fromCol: string; toTbl: string; toCol: string };
    mapping?: {
      sourceTable: string;
      sourceColumn: string;
      targetTable: string;
      targetColumn: string;
    };
  };
};

function participatingColumns(tableId: string, edge: PeekEdge): string[] | undefined {
  if (edge.source !== tableId && edge.target !== tableId) return undefined;
  const cols = new Set<string>();
  const endpoints = edge.data?.endpoints;
  if (endpoints) {
    if (endpoints.fromTbl === tableId) cols.add(endpoints.fromCol);
    if (endpoints.toTbl === tableId) cols.add(endpoints.toCol);
  }
  const mapping = edge.data?.mapping;
  if (mapping) {
    if (mapping.sourceTable === tableId) cols.add(mapping.sourceColumn);
    if (mapping.targetTable === tableId) cols.add(mapping.targetColumn);
  }
  if (edge.source === tableId && edge.sourceHandle) {
    if (
      edge.sourceHandle !== AGGREGATED_SOURCE_HANDLE &&
      edge.sourceHandle !== AGGREGATED_TARGET_HANDLE
    ) {
      cols.add(edge.sourceHandle.replace(/^(?:fl:)?[st]:/, ""));
    }
  }
  if (edge.target === tableId && edge.targetHandle) {
    if (
      edge.targetHandle !== AGGREGATED_SOURCE_HANDLE &&
      edge.targetHandle !== AGGREGATED_TARGET_HANDLE
    ) {
      cols.add(edge.targetHandle.replace(/^(?:fl:)?[st]:/, ""));
    }
  }
  return [...cols].filter(Boolean);
}

function TableNodeImpl({ data, selected }: NodeProps<Node<TableNodeData, "table">>) {
  const { t } = useTranslation();
  const actions = useCanvasActions();
  const selectedColumn = useSchemaStore((s) =>
    s.selectedColumn && s.selectedColumn.table === data.id ? s.selectedColumn.column : null,
  );
  const lodPin = useSchemaStore((s) => s.nodeLod[data.id]);
  const detailLevel = useSchemaStore((s) => s.detailLevel);
  const pinned = useSchemaStore((s) => s.pinnedColumns(data.id));
  const peekedEdgeId = useSchemaStore((s) => s.peekedEdge);
  const lineageMode = useSchemaStore((s) => s.lineageMode);
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useEdges();
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [settling, setSettling] = useState(false);

  const zoom = useStore((s) => s.transform[2]);
  const { state, simplified } = resolveLod(zoom, {
    level: detailLevel,
    pinned: lodPin,
    selected,
  });
  const prevState = useRef(state);
  useEffect(() => {
    if (prevState.current === state) return;
    prevState.current = state;
    setSettling(true);
    const timer = window.setTimeout(() => setSettling(false), 180);
    return () => window.clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    if (!nodeId) return;
    updateNodeInternals(nodeId);
  }, [nodeId, updateNodeInternals, lineageMode, state]);
  const peeked = peekedEdgeId ? edges.find((e) => e.id === peekedEdgeId) : undefined;
  const peekCols = peeked ? participatingColumns(data.id, peeked) : undefined;
  const dimPeek = peekedEdgeId != null && peekCols === undefined;

  const layerId = actions.layerOf(data.id);
  const layer = actions.layers.find((l) => l.id === layerId);
  const rel = (data.meta.fks?.length ?? 0) + (data.meta.refsIn?.length ?? 0);

  const commitEdit = (oldName: string) => {
    const v = draft.trim();
    if (v && v !== oldName) actions.onRenameColumn(data.id, oldName, v);
    setEditing(null);
  };

  const pinLevel = (lod: LodState) => {
    useSchemaStore.getState().setNodeLod(data.id, lod);
  };
  const followGlobal = () => {
    const current = useSchemaStore.getState().nodeLod;
    if (!(data.id in current)) return;
    const next = { ...current };
    delete next[data.id];
    useSchemaStore.setState({ nodeLod: next });
  };

  return (
    <div
      className={cn("relative table-node-shell", lineageMode && "table-node-shell--lineage")}
      style={dimPeek ? { opacity: PEEK_OPACITY } : undefined}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={AGGREGATED_TARGET_HANDLE}
        isConnectable={false}
        className="pointer-events-none !h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        id={AGGREGATED_SOURCE_HANDLE}
        isConnectable={false}
        className="pointer-events-none !h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0"
      />
      <NodeResizeControl
        position="bottom-right"
        minWidth={200}
        minHeight={120}
        onResizeEnd={(_, params) => actions.onResizeTable(data.id, params.width, params.height)}
        className="nodrag nopan !border-0 !bg-transparent"
      />
      <div
        className={cn(
          "relative flex min-w-[200px] flex-col overflow-hidden rounded-lg bg-card text-card-foreground shadow-md",
          selected && "shadow-glow ring-1 ring-primary",
          settling && "animate-node-settle",
        )}
        title={layer?.name ?? "raw"}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-lg",
            layerEdgeClass(layerId),
          )}
        />
        <div
          className="box-border flex shrink-0 items-center gap-1 overflow-hidden bg-surface pl-3 pr-1"
          style={{ height: TABLE_HEADER_H }}
        >
          <span
            className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
            title="Duplo-clique para renomear a tabela"
            onDoubleClick={(e) => {
              e.stopPropagation();
              const nv = prompt("Novo nome da tabela (schema.tabela):", data.id);
              if (nv && nv.trim()) actions.onRenameTable(data.id, nv.trim());
            }}
          >
            {data.schema ? <span className="text-muted-foreground">{data.schema}.</span> : null}
            {data.name}
          </span>
          {state === "sigil" ? (
            <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
              {data.columns.length} cols · {rel} rel
            </span>
          ) : null}
          {state === "full" ? (
            <input
              className="nodrag nopan nowheel h-6 w-24 rounded-md border border-input bg-background px-1.5 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="filter"
              aria-label="Filter columns"
            />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="nodrag nopan h-6 w-6 shrink-0 text-foreground"
                aria-label="Table menu"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="nodrag nopan w-52">
              <DropdownMenuItem
                onSelect={() => {
                  const nv = prompt("Novo nome da tabela (schema.tabela):", data.id);
                  if (nv && nv.trim()) actions.onRenameTable(data.id, nv.trim());
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Colour</DropdownMenuLabel>
              <div className="grid grid-cols-6 gap-1 px-2 pb-1">
                {TABLE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="size-4 rounded-sm ring-1 ring-border"
                    style={{ backgroundColor: c }}
                    aria-label={c}
                    onClick={() => actions.onSetColor(data.id, c)}
                  />
                ))}
              </div>
              <DropdownMenuItem onSelect={() => actions.onSetColor(data.id, null)}>
                No colour
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Layer</DropdownMenuLabel>
              {actions.layers.map((l) => (
                <DropdownMenuItem key={l.id} onSelect={() => actions.onSetLayer(data.id, l.id)}>
                  <span
                    className={cn("size-2 shrink-0 rounded-full", layerEdgeClass(l.id))}
                    aria-hidden
                  />
                  {l.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={() => actions.onSetLayer(data.id, null)}>
                No layer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{t("canvas.detail.pinLevel")}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="nodrag nopan">
                  <DropdownMenuItem onSelect={() => pinLevel("sigil")}>
                    {t("canvas.detail.name")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => pinLevel("keys")}>
                    {t("canvas.detail.keys")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => pinLevel("full")}>
                    {t("canvas.detail.columns")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => pinLevel("docs")}>
                    {t("canvas.detail.docs")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={followGlobal}>
                    {t("canvas.detail.followGlobal")}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => {
                  if (confirm(`Apagar tabela ${data.id} e refs relacionadas?`)) {
                    actions.onRemoveTable(data.id);
                  }
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <TableColumnList
          data={data}
          state={state}
          pinned={pinned}
          peekColumns={peekCols && peekCols.length > 0 ? peekCols : undefined}
          simplified={simplified}
          filter={state === "full" ? filter : ""}
          selectedColumn={selectedColumn}
          editing={editing}
          draft={draft}
          onSelect={(column, altKey, metaKey) => {
            if (metaKey) {
              const store = useSchemaStore.getState();
              if (store.pinnedColumns(data.id).includes(column)) {
                store.unpinColumn(data.id, column);
              } else {
                store.pinColumn(data.id, column);
              }
              return;
            }
            if (altKey && actions.onGoToColumn) {
              actions.onGoToColumn(data.id, column);
              return;
            }
            actions.onSelectColumn(data.id, column);
          }}
          onStartEdit={(column) => {
            setEditing(column);
            setDraft(column);
          }}
          onDraftChange={setDraft}
          onCommitEdit={commitEdit}
          onCancelEdit={() => setEditing(null)}
          onShowMore={() => useSchemaStore.getState().setNodeLod(data.id, "full")}
        />
        {state !== "sigil" ? (
          <button
            type="button"
            className="col-add nodrag nopan box-border flex w-full shrink-0 items-center overflow-hidden px-2 text-left font-mono text-2xs leading-none text-muted-foreground hover:bg-surface-hover"
            style={{ height: TABLE_FOOTER_H }}
            onClick={(e) => {
              e.stopPropagation();
              actions.onAddColumn(data.id);
            }}
          >
            + coluna
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const TableNode = memo(TableNodeImpl);
