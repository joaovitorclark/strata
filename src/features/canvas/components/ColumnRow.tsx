import { memo, useCallback, useRef, type PointerEvent } from "react";
import { Handle, Position, useNodeId } from "@xyflow/react";
import { Pencil, Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TableMeta } from "@/features/canvas/actions";
import type { ColumnView } from "@/features/schema/model/parse";
import { useCanvasRowH } from "@/features/canvas/hooks/useCanvasDensity";
import { useFlowZoom } from "@/features/canvas/hooks/useCanvasEdges";
import { resolveLod } from "@/features/canvas/utils/lod";
import { useSchemaStore } from "@/features/schema/store";
import {
  ColumnGlyph,
  columnRowHint,
  type ColumnGlyphFlags,
} from "@/features/canvas/components/columnGlyphs";

export type ColumnRowProps = {
  column: ColumnView;
  meta: TableMeta;
  compositePks?: string[][];
  pinned: readonly string[];
  selectedColumn: string | null;
  editing: string | null;
  draft: string;
  simplified?: boolean;
  hasLineage?: boolean;
  isLast?: boolean;
  inKeyArea?: boolean;
  showKeySeparator?: boolean;
  onSelect: (column: string, altKey: boolean, metaKey: boolean) => void;
  onStartEdit: (column: string) => void;
  onDraftChange: (value: string) => void;
  onCommitEdit: (oldName: string) => void;
  onCancelEdit: () => void;
};

function inCompositePk(name: string, groups?: string[][]): boolean {
  return !!groups?.some((group) => group.includes(name));
}

export function isPrimaryKeyColumn(
  column: ColumnView,
  meta: TableMeta,
  compositePks?: string[][],
): boolean {
  return (
    column.pk || (meta.pks ?? []).includes(column.name) || inCompositePk(column.name, compositePks)
  );
}

function ColumnRowImpl({
  column: c,
  meta,
  compositePks,
  pinned,
  selectedColumn,
  editing,
  draft,
  simplified: simplifiedProp,
  hasLineage = false,
  isLast = false,
  inKeyArea = false,
  showKeySeparator = false,
  onSelect,
  onStartEdit,
  onDraftChange,
  onCommitEdit,
  onCancelEdit,
}: ColumnRowProps) {
  const { t } = useTranslation();
  const isSel = selectedColumn === c.name;
  const isPk = isPrimaryKeyColumn(c, meta, compositePks);
  const fk = (meta.fks ?? []).find((f) => f.column === c.name);
  const isFk = Boolean(fk);
  const isPinned = pinned.includes(c.name);
  const isUnique = Boolean((c as ColumnView & { unique?: boolean }).unique);
  const isIndex = Boolean((c as ColumnView & { index?: boolean }).index);
  const rowH = useCanvasRowH();
  const lineageMode = useSchemaStore((s) => s.lineageMode);
  const nodeId = useNodeId() ?? "";
  const lodPin = useSchemaStore((s) => (nodeId ? s.nodeLod[nodeId] : undefined));
  const selected = useSchemaStore((s) => s.selectedTableIds.includes(nodeId));
  const detailLevel = useSchemaStore((s) => s.detailLevel);
  const zoom = useFlowZoom();
  const resolved = resolveLod(zoom, { level: detailLevel, pinned: lodPin, selected });
  const simplified = simplifiedProp ?? resolved.simplified;
  const showFieldHandles = lineageMode && resolved.state !== "sigil";

  const flags: ColumnGlyphFlags = {
    pk: isPk,
    fk: isFk,
    lineage: hasLineage,
    unique: isUnique,
    index: isIndex,
    notNull: c.notNull,
  };
  const hint = columnRowHint({ type: c.type, flags, fkRef: fk?.ref });

  const downPos = useRef<{ x: number; y: number } | null>(null);
  const isInteractiveChild = useCallback(
    (target: EventTarget | null) =>
      !!(target as HTMLElement | null)?.closest?.(".col-handle, .col-edit, .col-action"),
    [],
  );
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      downPos.current = isInteractiveChild(e.target) ? null : { x: e.clientX, y: e.clientY };
    },
    [isInteractiveChild],
  );
  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const d = downPos.current;
      downPos.current = null;
      if (!d || isInteractiveChild(e.target)) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
      e.stopPropagation();
      onSelect(c.name, e.altKey, e.metaKey || e.ctrlKey);
    },
    [c.name, isInteractiveChild, onSelect],
  );

  return (
    <div
      className={cn(
        "group/row col-row relative box-border flex shrink-0 items-center gap-1.5 overflow-hidden px-2",
        "border-b border-border/60 hover:bg-surface-hover",
        inKeyArea && "bg-surface",
        isSel && "bg-primary/12",
        (isLast || showKeySeparator) && "border-b-0",
      )}
      style={{ height: rowH }}
      title={hint}
      aria-label={t("canvas.node.columnAria", { name: c.name, type: c.type, flags: hint })}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {isSel ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-primary"
        />
      ) : null}
      {showKeySeparator ? (
        <span
          aria-hidden
          data-key-separator
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] border-b-[3px] border-double border-border"
        />
      ) : null}
      <Handle
        type="target"
        position={Position.Left}
        id={`t:${c.name}`}
        className="col-handle nodrag nopan !h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-rel-fk"
      />
      {showFieldHandles ? (
        <Handle
          type="target"
          position={Position.Left}
          id={`fl:t:${c.name}`}
          style={{ left: -18 }}
          className="col-handle nodrag nopan !h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-rel-lineage"
        />
      ) : null}
      {simplified ? (
        <span aria-hidden className="size-3.5 shrink-0" />
      ) : (
        <ColumnGlyph flags={flags} />
      )}
      {editing === c.name ? (
        <input
          className="col-edit nodrag nopan min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none"
          autoFocus
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={() => onCommitEdit(c.name)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitEdit(c.name);
            if (e.key === "Escape") onCancelEdit();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : simplified ? (
        <span aria-hidden className="h-1.5 w-12 shrink-0 rounded-sm bg-muted-foreground" />
      ) : (
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartEdit(c.name);
          }}
        >
          {c.name}
        </span>
      )}
      <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
        {c.type}
      </span>
      {simplified || editing === c.name ? null : (
        <div className="absolute right-2 top-1/2 z-[1] flex -translate-y-1/2 gap-0.5 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            data-testid="col-rename"
            className="col-action nodrag nopan rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={t("canvas.node.renameColumn")}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartEdit(c.name);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Pencil className="size-3" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className="col-action nodrag nopan rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={isPinned ? t("canvas.node.unpinColumn") : t("canvas.node.pinColumn")}
            aria-pressed={isPinned}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(c.name, false, true);
            }}
          >
            <Pin className={cn("size-3", isPinned && "text-key-pin")} strokeWidth={1.5} />
          </button>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        id={`s:${c.name}`}
        className="col-handle nodrag nopan !h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-rel-fk"
      />
      {showFieldHandles ? (
        <Handle
          type="source"
          position={Position.Right}
          id={`fl:s:${c.name}`}
          style={{ right: -18 }}
          className="col-handle nodrag nopan !h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-rel-lineage"
        />
      ) : null}
    </div>
  );
}

/** Memoizado por coluna: re-renderiza só quando a coluna individual muda. */
export const ColumnRow = memo(ColumnRowImpl, (prev, next) => {
  if (prev.column !== next.column) return false;
  if (prev.selectedColumn !== next.selectedColumn) return false;
  if (prev.editing !== next.editing) return false;
  if (prev.draft !== next.draft) return false;
  if (prev.pinned !== next.pinned) return false;
  if (prev.simplified !== next.simplified) return false;
  if (prev.meta !== next.meta) return false;
  if (prev.compositePks !== next.compositePks) return false;
  if (prev.hasLineage !== next.hasLineage) return false;
  if (prev.isLast !== next.isLast) return false;
  if (prev.inKeyArea !== next.inKeyArea) return false;
  if (prev.showKeySeparator !== next.showKeySeparator) return false;
  if (prev.editing === prev.column.name) return false;
  return true;
});
