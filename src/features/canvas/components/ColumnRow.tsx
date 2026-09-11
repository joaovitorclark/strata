import { memo, useCallback, useRef, type PointerEvent } from "react";
import { Handle, Position } from "@xyflow/react";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableMeta } from "@/features/canvas/actions";
import type { ColumnView } from "@/features/schema/model/parse";
import { COLUMN_VIRTUAL_ROW_H } from "@/features/canvas/utils/scaleLimits";

export type ColumnRowProps = {
  column: ColumnView;
  meta: TableMeta;
  compositePks?: string[][];
  pinned: readonly string[];
  selectedColumn: string | null;
  editing: string | null;
  draft: string;
  onSelect: (column: string, altKey: boolean, metaKey: boolean) => void;
  onStartEdit: (column: string) => void;
  onDraftChange: (value: string) => void;
  onCommitEdit: (oldName: string) => void;
  onCancelEdit: () => void;
};

function inCompositePk(name: string, groups?: string[][]): boolean {
  return !!groups?.some((group) => group.includes(name));
}

function ColumnRowImpl({
  column: c,
  meta,
  compositePks,
  pinned,
  selectedColumn,
  editing,
  draft,
  onSelect,
  onStartEdit,
  onDraftChange,
  onCommitEdit,
  onCancelEdit,
}: ColumnRowProps) {
  const isSel = selectedColumn === c.name;
  const isPk = c.pk || (meta.pks ?? []).includes(c.name) || inCompositePk(c.name, compositePks);
  const isFk = (meta.fks ?? []).some((f) => f.column === c.name);
  const isPinned = pinned.includes(c.name);
  const isUnique = Boolean((c as ColumnView & { unique?: boolean }).unique);

  const downPos = useRef<{ x: number; y: number } | null>(null);
  const isInteractiveChild = useCallback(
    (target: EventTarget | null) =>
      !!(target as HTMLElement | null)?.closest?.(".col-handle, .col-edit"),
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
      className={cn("relative flex items-center gap-1.5 px-2", isSel && "bg-surface-hover")}
      style={{ height: COLUMN_VIRTUAL_ROW_H }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={`t:${c.name}`}
        className="col-handle nodrag nopan !h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-rel-fk"
      />
      {isPk ? (
        <span className="size-1.5 shrink-0 rounded-full bg-key-pk" aria-hidden />
      ) : isFk ? (
        <span
          className="size-1.5 shrink-0 rounded-full border border-key-fk bg-transparent"
          aria-hidden
        />
      ) : isPinned ? (
        <Pin className="size-3 shrink-0 text-key-pin" aria-hidden />
      ) : (
        <span className="size-1.5 shrink-0" aria-hidden />
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
      ) : (
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartEdit(c.name);
          }}
        >
          {c.name}
        </span>
      )}
      <span className="shrink-0 font-mono text-2xs text-muted-foreground">{c.type}</span>
      {isPk ? (
        <span className="shrink-0 rounded-sm bg-muted px-1 font-mono text-2xs text-foreground">
          PK
        </span>
      ) : null}
      {isFk ? (
        <span className="shrink-0 rounded-sm bg-muted px-1 font-mono text-2xs text-foreground">
          FK
        </span>
      ) : null}
      {isUnique ? (
        <span className="shrink-0 rounded-sm bg-muted px-1 font-mono text-2xs text-foreground">
          UQ
        </span>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        id={`s:${c.name}`}
        className="col-handle nodrag nopan !h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-rel-fk"
      />
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
  if (prev.meta !== next.meta) return false;
  if (prev.compositePks !== next.compositePks) return false;
  if (prev.editing === prev.column.name) return false;
  return true;
});
