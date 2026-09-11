import { memo, useState } from "react";
import { NodeResizeControl, useEdges, useStore, type Node, type NodeProps } from "@xyflow/react";
import { MoreHorizontal } from "lucide-react";
import { useCanvasActions, type TableNodeData } from "@/features/canvas/actions";
import { TableColumnList } from "@/features/canvas/components/TableColumnList";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import { resolveLod } from "@/features/canvas/utils/lod";
import { isLineageHandle } from "@/features/canvas/utils/lineageHandles";
import { TABLE_FOOTER_H, TABLE_HEADER_H } from "@/features/canvas/utils/columnHandleGeometry";
import { useSchemaStore } from "@/features/schema/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  if (edge.source === tableId && edge.sourceHandle && !isLineageHandle(edge.sourceHandle)) {
    cols.add(edge.sourceHandle.replace(/^[st]:/, ""));
  }
  if (edge.target === tableId && edge.targetHandle && !isLineageHandle(edge.targetHandle)) {
    cols.add(edge.targetHandle.replace(/^[st]:/, ""));
  }
  return [...cols].filter(Boolean);
}

function TableNodeImpl({ data, selected }: NodeProps<Node<TableNodeData, "table">>) {
  const actions = useCanvasActions();
  const selectedColumn = useSchemaStore((s) =>
    s.selectedColumn && s.selectedColumn.table === data.id ? s.selectedColumn.column : null,
  );
  const lodPin = useSchemaStore((s) => s.nodeLod[data.id]);
  const pinned = useSchemaStore((s) => s.pinnedColumns(data.id));
  const peekedEdgeId = useSchemaStore((s) => s.peekedEdge);
  const edges = useEdges();
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const state = useStore((s) => resolveLod(s.transform[2], { pinned: lodPin, selected }));
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

  return (
    <div className="relative" style={dimPeek ? { opacity: PEEK_OPACITY } : undefined}>
      <NodeResizeControl
        position="bottom-right"
        minWidth={200}
        minHeight={120}
        onResizeEnd={(_, params) => actions.onResizeTable(data.id, params.width, params.height)}
        className="nodrag nopan !border-0 !bg-transparent"
      />
      <div
        className={cn(
          "relative min-w-[200px] overflow-hidden rounded-lg bg-card text-card-foreground shadow-md",
          selected && "shadow-glow ring-1 ring-primary",
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
          className="flex items-center gap-1 bg-surface pl-3 pr-1"
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
            className="col-add nodrag nopan w-full px-2 text-left font-mono text-2xs text-muted-foreground hover:bg-surface-hover"
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
