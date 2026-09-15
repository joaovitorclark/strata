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
import { toast } from "sonner";
import { useCanvasActions, type TableNodeData } from "@/features/canvas/actions";
import { TableColumnList } from "@/features/canvas/components/TableColumnList";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import {
  AGGREGATED_SOURCE_HANDLE,
  AGGREGATED_TARGET_HANDLE,
} from "@/features/canvas/hooks/useCanvasEdges";
import { resolveLod, type LodState } from "@/features/canvas/utils/lod";
import { TABLE_FOOTER_H, TABLE_HEADER_H } from "@/features/canvas/utils/columnHandleGeometry";
import { TableInfoPopover } from "@/features/panels/TableInfoPopover";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  clearRenameDraft,
  getRenameDraft,
  retainRenamePointerArm,
  setRenameDraft,
} from "@/features/canvas/components/columnRenameSession";
import { ColumnComposer } from "@/features/canvas/components/ColumnComposer";
import {
  ColumnDeleteDialog,
  type ColumnDep,
} from "@/features/canvas/components/ColumnDeleteDialog";
import { columnNameError } from "@/features/dbt-source/columnName";

function headerTint(color: string | undefined): string | undefined {
  if (!color || color.startsWith("hsl(")) return undefined;
  return `color-mix(in srgb, ${color} 10%, hsl(var(--surface)))`;
}

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
  const readOnly = useSchemaStore((s) => s.readOnly);
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useEdges();
  const [filter, setFilter] = useState("");
  const cachedRename = getRenameDraft(data.id);
  const [editing, setEditing] = useState<string | null>(cachedRename?.column ?? null);
  const [draft, setDraft] = useState(cachedRename?.draft ?? "");
  const ignoreNextBlur = useRef(Boolean(cachedRename));
  const [settling, setSettling] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [composing, setComposing] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ column: string; deps: ColumnDep[] } | null>(
    null,
  );
  const isDbt = useSchemaStore((s) => s.documentFormat === "dbt");
  const dbtParsed = useSchemaStore((s) => s.dbtParsed);

  useEffect(() => retainRenamePointerArm(), []);
  useEffect(() => {
    if (editing) {
      setRenameDraft(data.id, {
        column: editing,
        draft,
      });
      return;
    }
    clearRenameDraft(data.id);
  }, [data.id, editing, draft]);
  useEffect(() => {
    if (!editing) return;
    const root = document.querySelector(`[data-testid="rf__node-${data.id}"]`);
    const input = root?.querySelector("input.col-edit");
    if (input instanceof HTMLInputElement) input.focus();
  }, [editing, data.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F2") return;
      if (!selectedColumn || editing) return;
      const sel = useSchemaStore.getState().selectedColumn;
      if (sel?.table !== data.id) return;
      e.preventDefault();
      ignoreNextBlur.current = true;
      setRenameDraft(data.id, { column: selectedColumn, draft: selectedColumn });
      setEditing(selectedColumn);
      setDraft(selectedColumn);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedColumn, editing, data.id]);

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

  const commitEdit = (oldName: string, cause: "blur" | "enter" = "enter") => {
    if (cause === "blur" && ignoreNextBlur.current) {
      ignoreNextBlur.current = false;
      return;
    }
    const v = draft.trim();
    if (v && v !== oldName) {
      const err = columnNameError(
        v,
        data.columns.map((c) => c.name),
        oldName,
      );
      if (err) {
        setRenameError(err);
        return;
      }
      setRenameError(null);
      actions.onRenameColumn(data.id, oldName, v);
    }
    setEditing(null);
    clearRenameDraft(data.id);
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

  const tableLabel = data.schema ? `${data.schema}.${data.name}` : data.name;
  const tint = headerTint(data.headerColor);

  const columnDeps = (column: string): ColumnDep[] => {
    const deps: ColumnDep[] = [];
    for (const fk of data.meta.fks ?? []) {
      if (fk.column === column)
        deps.push({ kind: "fk", label: `${data.id}.${column} → ${fk.ref}` });
    }
    const parsed = dbtParsed;
    for (const l of parsed?.lineageFields ?? []) {
      if (
        (l.targetTable === data.id && l.targetColumn === column) ||
        (l.sourceTable === data.id && l.sourceColumn === column)
      ) {
        deps.push({
          kind: "lineage",
          label: `${l.targetTable}.${l.targetColumn} < ${l.sourceTable}.${l.sourceColumn}`,
        });
      }
    }
    return deps;
  };

  const requestDelete = (column: string) => {
    const deps = columnDeps(column);
    if (!deps.length) {
      actions.onRemoveColumn?.(data.id, column);
      toast(t("canvas.node.columnDeleted"), {
        action: {
          label: t("shell.undo"),
          onClick: () => useSchemaStore.getState().undo(),
        },
      });
      return;
    }
    setPendingDelete({ column, deps });
  };

  return (
    <div
      className={cn("group relative table-node-shell", lineageMode && "table-node-shell--lineage")}
      style={dimPeek ? { opacity: PEEK_OPACITY } : undefined}
      role="group"
      aria-label={t("canvas.node.tableAria", { name: tableLabel, count: data.columns.length })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
          style={{ height: TABLE_HEADER_H, backgroundColor: tint }}
        >
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <span
                className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
                title={readOnly ? t("shell.dbtReadOnly") : t("canvas.node.renameTableTitle")}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (readOnly) {
                    toast.message(t("shell.dbtReadOnly"));
                    return;
                  }
                  const nv = prompt("Novo nome da tabela (schema.tabela):", data.id);
                  if (nv && nv.trim()) actions.onRenameTable(data.id, nv.trim());
                }}
              >
                {data.schema ? <span className="text-muted-foreground">{data.schema}</span> : null}
                {data.schema ? <span className="text-muted-foreground"> · </span> : null}
                <span className="font-medium text-foreground">{data.name}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="max-w-none border-0 bg-transparent p-0 shadow-none"
            >
              <TableInfoPopover meta={data.meta} />
            </TooltipContent>
          </Tooltip>
          {state === "sigil" ? (
            <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
              {t("canvas.node.relations", { count: rel })}
            </span>
          ) : (
            <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
              {data.columns.length}
            </span>
          )}
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
                data-testid="table-menu-trigger"
                className={cn(
                  "nodrag nopan h-6 w-6 shrink-0 text-foreground opacity-0",
                  "focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100",
                  (hovered || selected) && "opacity-100",
                )}
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
                disabled={readOnly}
                title={readOnly ? t("shell.dbtReadOnly") : undefined}
                onSelect={() => {
                  if (readOnly) {
                    toast.message(t("shell.dbtReadOnly"));
                    return;
                  }
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
            ignoreNextBlur.current = true;
            setRenameDraft(data.id, { column, draft: column });
            setEditing(column);
            setDraft(column);
          }}
          onDraftChange={setDraft}
          onCommitEdit={commitEdit}
          onCancelEdit={() => {
            setEditing(null);
            setRenameError(null);
            clearRenameDraft(data.id);
          }}
          onShowMore={() => useSchemaStore.getState().setNodeLod(data.id, "full")}
          onDeleteColumn={isDbt ? requestDelete : undefined}
        />
        {renameError ? (
          <p data-testid="col-rename-error" className="px-2 py-0.5 text-[10px] text-destructive">
            {renameError === "empty"
              ? t("canvas.node.columnNameEmpty")
              : renameError === "invalid"
                ? t("canvas.node.columnNameInvalid")
                : t("canvas.node.columnNameDuplicate")}
          </p>
        ) : null}
        {state !== "sigil" ? (
          isDbt && composing ? (
            <ColumnComposer
              existing={data.columns.map((c) => c.name)}
              onCommit={(name, dataType) => {
                actions.onAddColumn(data.id, name, dataType);
                setComposing(false);
              }}
              onCancel={() => setComposing(false)}
            />
          ) : (
            <button
              type="button"
              data-testid="col-add"
              className="col-add nodrag nopan box-border flex w-full shrink-0 items-center overflow-hidden px-2 text-left font-mono text-2xs leading-none text-muted-foreground hover:bg-surface-hover"
              style={{ height: TABLE_FOOTER_H }}
              onClick={(e) => {
                e.stopPropagation();
                if (isDbt) setComposing(true);
                else actions.onAddColumn(data.id);
              }}
            >
              {t("canvas.node.addColumn")}
            </button>
          )
        ) : null}
      </div>
      {pendingDelete ? (
        <ColumnDeleteDialog
          open
          column={pendingDelete.column}
          deps={pendingDelete.deps}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            actions.onRemoveColumn?.(data.id, pendingDelete.column);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}

export const TableNode = memo(TableNodeImpl);
