import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, WrapText } from "lucide-react";
import { Editor, type EditorHandle } from "@/features/source/Editor";
import { RenameConfirmModal } from "@/features/source/RenameConfirmModal";
import { DbmlDiff } from "@/features/source/DbmlDiff";
import { analyzeRenames, type RenameImpact } from "@/features/schema/model/reconcile";
import { isCompleteTableId, renameColumnAllRefs, renameTable } from "@/features/schema/model/edit";
import {
  keepSeparateKeyRename,
  propagateKeyRename,
} from "@/features/schema/model/propagateKeyRename";
import { classifyChildFks } from "@/features/schema/model/rolename";
import { organize } from "@/features/schema/model/organize";
import { useSchemaStore } from "@/features/schema/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SourceDrawerCommitResult = {
  openedModal: boolean;
  reconciledDbml: string | null;
};

export type SourceDrawerHandle = EditorHandle & { commit: () => SourceDrawerCommitResult };

export type SourceDrawerProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  committedValue?: string;
  savedValue?: string;
  onCommitted?: (value: string) => void;
  onTableRenamed?: (oldId: string, newId: string) => void;
  error?: string;
  errorLine?: number;
  onFocusTable?: (tableId: string) => void;
  onCursorLine?: (line0: number) => void;
  onGoToError?: () => void;
  onCommit?: () => void;
  onRenameModalOpenChange?: (open: boolean) => void;
};

type PendingRename = { impacts: RenameImpact[]; buffer: string; committed: string };

function applyRenameImpacts(
  src: string,
  impacts: RenameImpact[],
  keyColFn: typeof propagateKeyRename,
  onTableRenamed?: (oldId: string, newId: string) => void,
): string {
  let out = src;
  for (const { rename } of impacts) {
    if (rename.kind === "table") {
      if (isCompleteTableId(rename.oldId) && isCompleteTableId(rename.newId)) {
        out = renameTable(out, rename.oldId, rename.newId);
        onTableRenamed?.(rename.oldId, rename.newId);
      }
    } else {
      const isKey = classifyChildFks(src, rename.table, rename.oldCol).length > 0;
      out = isKey
        ? keyColFn(out, rename.table, rename.oldCol, rename.newCol)
        : renameColumnAllRefs(out, rename.table, rename.oldCol, rename.newCol);
      const sel = useSchemaStore.getState().selectedColumn;
      if (sel?.table === rename.table && sel.column === rename.oldCol) {
        useSchemaStore.getState().selectColumn({ table: rename.table, column: rename.newCol });
      }
    }
  }
  return out;
}

export const SourceDrawer = forwardRef<SourceDrawerHandle, SourceDrawerProps>(function SourceDrawer(
  {
    open,
    value,
    onChange,
    committedValue,
    savedValue,
    onCommitted,
    onTableRenamed,
    error,
    errorLine,
    onFocusTable,
    onCursorLine,
    onGoToError,
    onCommit,
    onRenameModalOpenChange,
  },
  ref,
) {
  const { t } = useTranslation();
  const editorRef = useRef<EditorHandle>(null);
  const [pendingRename, setPendingRename] = useState<PendingRename | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);

  const finish = useCallback(
    (next: string) => {
      if (next !== value) onChange(next);
      onCommitted?.(next);
      onCommit?.();
    },
    [value, onChange, onCommitted, onCommit],
  );

  const commit = useCallback((): SourceDrawerCommitResult => {
    const committed = committedValue;
    if (committed == null || committed === value) {
      onCommit?.();
      return { openedModal: false, reconciledDbml: null };
    }
    const impacts = analyzeRenames(committed, value);
    if (impacts.some((i) => i.affectsRefs)) {
      setPendingRename({ impacts, buffer: value, committed });
      onRenameModalOpenChange?.(true);
      return { openedModal: true, reconciledDbml: null };
    }
    const out = applyRenameImpacts(value, impacts, propagateKeyRename, onTableRenamed);
    finish(out);
    return { openedModal: false, reconciledDbml: out };
  }, [committedValue, value, onCommit, onTableRenamed, finish, onRenameModalOpenChange]);

  useImperativeHandle(
    ref,
    () => ({
      commit,
      goToLine: (line) => editorRef.current?.goToLine(line),
      goToColumn: (table, column) => editorRef.current?.goToColumn(table, column),
    }),
    [commit],
  );

  const onFormat = useCallback(() => {
    onChange(organize(value));
  }, [value, onChange]);

  const onCopy = useCallback(() => {
    void navigator.clipboard?.writeText(value);
  }, [value]);

  if (!open) return null;

  return (
    <div
      data-source-drawer
      className={cn(
        "flex h-[40vh] w-full flex-col border-t border-border bg-card text-card-foreground",
        "animate-drawer-up shadow-lg",
      )}
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
        <Button type="button" variant="ghost" size="sm" onClick={onFormat}>
          <WrapText className="size-[14px]" strokeWidth={1.5} />
          {t("source.format")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
          <Copy className="size-[14px]" strokeWidth={1.5} />
          {t("source.copy")}
        </Button>
        {savedValue != null && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDiffOpen((d) => !d)}>
            {t("source.diff")}
          </Button>
        )}
      </div>
      {diffOpen && savedValue != null ? (
        <DbmlDiff open saved={savedValue} working={value} onClose={() => setDiffOpen(false)} />
      ) : (
        <Editor
          ref={editorRef}
          value={value}
          onChange={onChange}
          error={error}
          errorLine={errorLine}
          onFocusTable={onFocusTable}
          onGoToError={onGoToError}
          onCursorLine={onCursorLine}
          onCommit={commit}
        />
      )}
      {pendingRename && (
        <RenameConfirmModal
          impacts={pendingRename.impacts}
          onApply={() => {
            const out = applyRenameImpacts(
              pendingRename.buffer,
              pendingRename.impacts,
              propagateKeyRename,
              onTableRenamed,
            );
            setPendingRename(null);
            onRenameModalOpenChange?.(false);
            finish(out);
          }}
          onKeepSeparate={() => {
            const out = applyRenameImpacts(
              pendingRename.buffer,
              pendingRename.impacts,
              keepSeparateKeyRename,
              onTableRenamed,
            );
            setPendingRename(null);
            onRenameModalOpenChange?.(false);
            finish(out);
          }}
          onClose={() => {
            setPendingRename(null);
            onRenameModalOpenChange?.(false);
          }}
        />
      )}
    </div>
  );
});
