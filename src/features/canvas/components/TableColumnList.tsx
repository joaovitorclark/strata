import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNodeId, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import type { TableNodeData } from "@/features/canvas/actions";
import { ColumnRow, type ColumnRowProps } from "@/features/canvas/components/ColumnRow";
import { computeVirtualWindow } from "@/features/canvas/hooks/useVirtualWindow";
import { useTableScrollStore } from "@/features/canvas/store/tableScrollStore";
import { keyColumns, type LodState } from "@/features/canvas/utils/lod";
import {
  COLUMN_VIRTUAL_ROW_H,
  COLUMN_VIRTUALIZE_THRESHOLD,
  COLUMN_VIRTUAL_VIEW_ROWS,
} from "@/features/canvas/utils/scaleLimits";

const VIEW_H_FALLBACK = COLUMN_VIRTUAL_VIEW_ROWS * COLUMN_VIRTUAL_ROW_H;
const OVERSCAN = 5;

// Alturas reservadas dentro do nó da tabela (para o header, botão de adicionar
// e padding) — descontadas da altura do nó para obter o viewport disponível.
const NODE_HEADER_H = 34;
const NODE_ADD_BTN_H = 30;
const NODE_PADDING = 8;
const VIEWPORT_MIN_H = 120;

function scrollToColumnIndex(el: HTMLDivElement, index: number): void {
  if (index < 0) return;
  const rowTop = index * COLUMN_VIRTUAL_ROW_H;
  const rowBottom = rowTop + COLUMN_VIRTUAL_ROW_H;
  const viewportH = el.clientHeight || VIEW_H_FALLBACK;
  if (rowTop < el.scrollTop) el.scrollTop = rowTop;
  else if (rowBottom > el.scrollTop + viewportH) el.scrollTop = rowBottom - viewportH;
}

export type TableColumnListProps = {
  data: TableNodeData;
  state: LodState;
  pinned?: readonly string[];
  filter?: string;
  selectedColumn: string | null;
  editing: string | null;
  draft: string;
  onSelect: (column: string, altKey: boolean) => void;
  onStartEdit: (column: string) => void;
  onDraftChange: (value: string) => void;
  onCommitEdit: (oldName: string) => void;
  onCancelEdit: () => void;
  onShowMore?: () => void;
};

export function TableColumnList(props: TableColumnListProps): ReactNode {
  const {
    data,
    state,
    pinned = [],
    filter = "",
    selectedColumn,
    editing,
    draft,
    onSelect,
    onStartEdit,
    onDraftChange,
    onCommitEdit,
    onCancelEdit,
    onShowMore,
  } = props;

  const filterText = filter.trim().toLowerCase();
  const columns = filterText
    ? data.columns.filter(
        (c) =>
          c.name.toLowerCase().includes(filterText) || c.type.toLowerCase().includes(filterText),
      )
    : data.columns;

  const scrollable = state === "full" && columns.length > COLUMN_VIRTUALIZE_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const { getNode } = useReactFlow();
  const setScrollTop = useTableScrollStore((s) => s.setScrollTop);
  const [scrollTop, setScrollTopLocal] = useState(0);
  const [nodeH, setNodeH] = useState<number | null>(null);

  useEffect(() => {
    if (!scrollable || !nodeId) return;
    let raf = 0;
    const tick = () => {
      const n = getNode(nodeId);
      const h = n?.measured?.height ?? n?.height ?? null;
      setNodeH((prev) => (prev === h ? prev : h));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrollable, nodeId, getNode]);

  const viewportH = nodeH
    ? Math.max(VIEWPORT_MIN_H, nodeH - NODE_HEADER_H - NODE_ADD_BTN_H - NODE_PADDING)
    : VIEW_H_FALLBACK;

  const publishScroll = useCallback(
    (next: number) => {
      if (nodeId) setScrollTop(nodeId, next);
    },
    [nodeId, setScrollTop],
  );

  const syncEdgeAnchors = useCallback(() => {
    if (nodeId) updateNodeInternals(nodeId);
  }, [nodeId, updateNodeInternals]);

  const scrollToColumn = useCallback(
    (columnName: string | null) => {
      const el = scrollRef.current;
      if (!el || !columnName) return;
      const idx = columns.findIndex((c) => c.name === columnName);
      scrollToColumnIndex(el, idx);
    },
    [columns],
  );

  useEffect(() => {
    if (!scrollable) return;
    scrollToColumn(selectedColumn);
    const el = scrollRef.current;
    if (el) publishScroll(el.scrollTop);
    requestAnimationFrame(syncEdgeAnchors);
  }, [scrollable, selectedColumn, scrollToColumn, publishScroll, syncEdgeAnchors]);

  useEffect(() => {
    if (!scrollable) return;
    scrollToColumn(editing);
    const el = scrollRef.current;
    if (el) publishScroll(el.scrollTop);
    requestAnimationFrame(syncEdgeAnchors);
  }, [scrollable, editing, scrollToColumn, publishScroll, syncEdgeAnchors]);

  const rowProps: Omit<ColumnRowProps, "column"> = {
    meta: data.meta,
    compositePks: data.compositePks,
    pinned,
    selectedColumn,
    editing,
    draft,
    onSelect,
    onStartEdit,
    onDraftChange,
    onCommitEdit,
    onCancelEdit,
  };

  if (state === "sigil") return null;

  if (state === "keys") {
    const shown = keyColumns(data, pinned);
    const hidden = data.columns.length - shown.length;
    return (
      <div>
        {shown.map((c) => (
          <ColumnRow key={c.name} {...rowProps} column={c} />
        ))}
        {hidden > 0 ? (
          <button
            type="button"
            className="nodrag nopan w-full px-2 text-left font-mono text-2xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            style={{ height: COLUMN_VIRTUAL_ROW_H }}
            onClick={(e) => {
              e.stopPropagation();
              onShowMore?.();
            }}
          >
            + {hidden} more columns
          </button>
        ) : null}
      </div>
    );
  }

  if (!scrollable) {
    return (
      <div>
        {columns.map((c) => (
          <ColumnRow key={c.name} {...rowProps} column={c} />
        ))}
      </div>
    );
  }

  const win = computeVirtualWindow({
    totalItems: columns.length,
    itemHeight: COLUMN_VIRTUAL_ROW_H,
    viewportHeight: viewportH,
    scrollTop,
    overscan: OVERSCAN,
  });
  const visible = columns.slice(win.startIndex, win.endIndex);

  return (
    <div
      ref={scrollRef}
      className="nowheel nodrag nopan overflow-y-auto"
      style={{ maxHeight: viewportH }}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        setScrollTopLocal(top);
        publishScroll(top);
        requestAnimationFrame(syncEdgeAnchors);
      }}
    >
      <div style={{ height: win.totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${win.offsetY}px)` }}>
          {visible.map((c) => (
            <ColumnRow key={c.name} {...rowProps} column={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
