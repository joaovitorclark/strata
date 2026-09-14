import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNodeId, useUpdateNodeInternals } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { TableNodeData } from "@/features/canvas/actions";
import {
  ColumnRow,
  isPrimaryKeyColumn,
  type ColumnRowProps,
} from "@/features/canvas/components/ColumnRow";
import { computeVirtualWindow } from "@/features/canvas/hooks/useVirtualWindow";
import { useTableScrollStore } from "@/features/canvas/store/tableScrollStore";
import { keyColumns, DOCS_NOTE_BLOCK_H, type LodState } from "@/features/canvas/utils/lod";
import { useCanvasRowH } from "@/features/canvas/hooks/useCanvasDensity";
import {
  COLUMN_VIRTUALIZE_THRESHOLD,
  columnVirtualViewportCss,
  columnVirtualViewportPx,
} from "@/features/canvas/utils/scaleLimits";
import type { ColumnView } from "@/features/schema/model/parse";

const OVERSCAN = 5;

function scrollToColumnIndex(el: HTMLDivElement, index: number, rowH: number): void {
  if (index < 0) return;
  const rowTop = index * rowH;
  const rowBottom = rowTop + rowH;
  const viewportH = el.clientHeight || columnVirtualViewportPx(rowH);
  if (rowTop < el.scrollTop) el.scrollTop = rowTop;
  else if (rowBottom > el.scrollTop + viewportH) el.scrollTop = rowBottom - viewportH;
}

function partitionPkFirst(
  columns: ColumnView[],
  data: TableNodeData,
): { pk: ColumnView[]; rest: ColumnView[]; ordered: ColumnView[] } {
  const pk: ColumnView[] = [];
  const rest: ColumnView[] = [];
  for (const column of columns) {
    if (isPrimaryKeyColumn(column, data.meta, data.compositePks)) pk.push(column);
    else rest.push(column);
  }
  return { pk, rest, ordered: [...pk, ...rest] };
}

export type TableColumnListProps = {
  data: TableNodeData;
  state: LodState;
  pinned?: readonly string[];
  filter?: string;
  peekColumns?: readonly string[];
  simplified?: boolean;
  selectedColumn: string | null;
  editing: string | null;
  draft: string;
  onSelect: (column: string, altKey: boolean, metaKey: boolean) => void;
  onStartEdit: (column: string) => void;
  onDraftChange: (value: string) => void;
  onCommitEdit: (oldName: string, cause?: "blur" | "enter") => void;
  onCancelEdit: () => void;
  onShowMore?: () => void;
};

export function TableColumnList(props: TableColumnListProps): ReactNode {
  const {
    data,
    state,
    pinned = [],
    filter = "",
    peekColumns,
    simplified = false,
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
  const { t } = useTranslation();

  const peekSet = peekColumns?.length ? new Set(peekColumns) : null;
  const scoped = peekSet ? data.columns.filter((c) => peekSet.has(c.name)) : data.columns;
  const filterText = filter.trim().toLowerCase();
  const filtered = filterText
    ? scoped.filter(
        (c) =>
          c.name.toLowerCase().includes(filterText) || c.type.toLowerCase().includes(filterText),
      )
    : scoped;

  const scrollable = state === "full" && filtered.length > COLUMN_VIRTUALIZE_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const setScrollTop = useTableScrollStore((s) => s.setScrollTop);
  const [scrollTop, setScrollTopLocal] = useState(0);
  const rowH = useCanvasRowH();
  const viewportH = columnVirtualViewportPx(rowH);
  const lineageSet = useMemo(() => new Set(data.linkedColumns ?? []), [data.linkedColumns]);

  const publishScroll = useCallback(
    (next: number) => {
      if (nodeId) setScrollTop(nodeId, next);
    },
    [nodeId, setScrollTop],
  );

  const syncEdgeAnchors = useCallback(() => {
    if (nodeId) updateNodeInternals(nodeId);
  }, [nodeId, updateNodeInternals]);

  const columnsForState = useMemo(() => {
    const peek = peekColumns?.length ? new Set(peekColumns) : null;
    const scopedCols = peek ? data.columns.filter((c) => peek.has(c.name)) : data.columns;
    const text = filter.trim().toLowerCase();
    const filteredCols = text
      ? scopedCols.filter(
          (c) => c.name.toLowerCase().includes(text) || c.type.toLowerCase().includes(text),
        )
      : scopedCols;
    if (state === "keys") {
      const shown = peek ? scopedCols : keyColumns(data, pinned, data.linkedColumns ?? []);
      return partitionPkFirst(shown, data);
    }
    return partitionPkFirst(filteredCols, data);
  }, [data, filter, peekColumns, pinned, state]);

  const displayColumns = columnsForState.ordered;
  const pkCount = columnsForState.pk.length;
  const hasRest = columnsForState.rest.length > 0;

  const scrollToColumn = useCallback(
    (columnName: string | null) => {
      const el = scrollRef.current;
      if (!el || !columnName) return;
      const idx = displayColumns.findIndex((c) => c.name === columnName);
      scrollToColumnIndex(el, idx, rowH);
    },
    [displayColumns, rowH],
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
    simplified,
  };

  const renderRow = (
    c: ColumnView,
    index: number,
    list: ColumnView[],
    opts?: { keyArea?: boolean },
  ) => {
    const useKeyArea = opts?.keyArea !== false;
    return (
      <ColumnRow
        key={c.name}
        {...rowProps}
        column={c}
        hasLineage={lineageSet.has(c.name)}
        isLast={index === list.length - 1}
        inKeyArea={useKeyArea && index < pkCount}
        showKeySeparator={useKeyArea && pkCount > 0 && hasRest && index === pkCount - 1}
      />
    );
  };

  if (state === "sigil") return null;

  if (state === "keys") {
    const hidden = peekSet ? 0 : data.columns.length - displayColumns.length;
    return (
      <div className="flex flex-col overflow-hidden">
        {pkCount > 0 ? (
          <div className="relative bg-surface" data-key-area>
            {columnsForState.pk.map((c, i) => renderRow(c, i, displayColumns))}
          </div>
        ) : null}
        {columnsForState.rest.map((c, i) => renderRow(c, pkCount + i, displayColumns))}
        {hidden > 0 ? (
          <button
            type="button"
            data-overflow-more
            className="nodrag nopan box-border flex w-full shrink-0 items-center overflow-hidden px-2 text-left font-mono text-2xs leading-none text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            style={{ height: rowH }}
            onClick={(e) => {
              e.stopPropagation();
              onShowMore?.();
            }}
          >
            {t("canvas.node.moreColumns", { count: hidden })}
          </button>
        ) : null}
      </div>
    );
  }

  if (state === "docs") {
    const tableNote = data.note || data.meta?.note;
    const noted = peekSet
      ? scoped.filter((c) => Boolean(c.note))
      : data.columns.filter((c) => Boolean(c.note));
    return (
      <div className="flex flex-col overflow-hidden">
        {tableNote ? (
          <p
            className="box-border line-clamp-2 overflow-hidden px-2 font-mono text-2xs leading-[11px] text-muted-foreground"
            style={{ height: DOCS_NOTE_BLOCK_H }}
          >
            {tableNote}
          </p>
        ) : null}
        {noted.map((c, i) => (
          <div key={c.name} className="flex flex-col">
            {renderRow(c, i, noted, { keyArea: false })}
            {c.note ? (
              <p
                className="box-border line-clamp-2 overflow-hidden px-2 font-mono text-2xs leading-[11px] text-muted-foreground"
                style={{ height: DOCS_NOTE_BLOCK_H }}
              >
                {c.note}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (!scrollable) {
    return (
      <div className="flex flex-col overflow-hidden">
        {pkCount > 0 ? (
          <div className="relative bg-surface" data-key-area>
            {columnsForState.pk.map((c, i) => renderRow(c, i, displayColumns))}
          </div>
        ) : null}
        {columnsForState.rest.map((c, i) => renderRow(c, pkCount + i, displayColumns))}
      </div>
    );
  }

  const win = computeVirtualWindow({
    totalItems: displayColumns.length,
    itemHeight: rowH,
    viewportHeight: viewportH,
    scrollTop,
    overscan: OVERSCAN,
  });
  const visible = displayColumns.slice(win.startIndex, win.endIndex);

  return (
    <div
      ref={scrollRef}
      className="nowheel nodrag nopan overflow-y-auto"
      style={{ height: columnVirtualViewportCss() }}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        setScrollTopLocal(top);
        publishScroll(top);
        requestAnimationFrame(syncEdgeAnchors);
      }}
    >
      <div style={{ height: win.totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${win.offsetY}px)` }}>
          {visible.map((c, i) => renderRow(c, win.startIndex + i, displayColumns))}
        </div>
      </div>
    </div>
  );
}
