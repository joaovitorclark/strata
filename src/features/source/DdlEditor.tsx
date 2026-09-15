import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fromDbtProject } from "@/features/dbt-source/fromDbtProject";
import {
  ddlToOperations,
  toDdl,
  type DdlDialect,
  type DdlRenameCandidate,
} from "@/features/dbt-source/ddlProjection";
import { Editor } from "@/features/source/Editor";
import { useSchemaStore } from "@/features/schema/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DIALECTS: DdlDialect[] = ["spark", "postgres", "oracle"];

export function DdlEditor({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const files = useSchemaStore((s) => s.files);
  const project = useSchemaStore((s) => s.dbtProject);
  const selectedTable = useSchemaStore((s) => s.selectedTable);
  const persistGen = useSchemaStore((s) => s.dbtPersistGen);
  const [dialect, setDialect] = useState<DdlDialect>("spark");
  const [edit, setEdit] = useState<{ key: string; text: string } | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [errorLine, setErrorLine] = useState<number | undefined>();
  const [pending, setPending] = useState<DdlRenameCandidate[] | null>(null);
  const [pendingAfter, setPendingAfter] = useState<string | null>(null);

  const model = useMemo(() => fromDbtProject(files, project), [files, project]);
  const projected = useMemo(
    () => toDdl(model, { dialect, tables: selectedTable ? [selectedTable] : undefined }),
    [model, dialect, selectedTable],
  );
  const sourceKey = `${dialect}:${selectedTable ?? "*"}:${persistGen}`;
  const buffer = edit?.key === sourceKey ? edit.text : projected.text;

  const applyOps = useCallback(
    (after: string, confirm?: { tableId: string; oldName: string; newName: string }[]) => {
      const result = ddlToOperations(projected.text, after, model, dialect, {
        confirmRenames: confirm,
      });
      if (result.kind === "error") {
        setError(result.message);
        setErrorLine(Math.max(0, result.line - 1));
        return;
      }
      if (result.kind === "needsConfirmation") {
        setPending(result.candidates);
        setPendingAfter(after);
        return;
      }
      setError(undefined);
      setErrorLine(undefined);
      setEdit(null);
      const apply = useSchemaStore.getState().applyDbtOp;
      for (const op of result.ops) apply(op);
    },
    [projected.text, model, dialect],
  );

  const save = useCallback(() => {
    applyOps(buffer);
  }, [applyOps, buffer]);

  if (!open) return null;

  return (
    <div
      data-testid="ddl-editor"
      className="flex h-[40vh] min-h-0 w-full flex-col bg-card text-card-foreground"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1">
        <label className="flex items-center gap-1 text-xs">
          {t("source.dialect")}
          <select
            data-testid="ddl-dialect"
            className="h-7 rounded-md border border-border bg-background px-1 text-xs"
            value={dialect}
            onChange={(e) => setDialect(e.target.value as DdlDialect)}
          >
            {DIALECTS.map((d) => (
              <option key={d} value={d}>
                {t(`source.dialect_${d}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="ghost" size="sm" data-testid="drawer-save" onClick={save}>
          {t("common.save")}
        </Button>
      </div>
      <Editor
        value={buffer}
        onChange={(v) => {
          setEdit({ key: sourceKey, text: v });
          setError(undefined);
          setErrorLine(undefined);
        }}
        error={error}
        errorLine={errorLine}
        onCommit={save}
        showOutline={false}
      />
      <Dialog open={!!pending} onOpenChange={(next) => !next && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("source.renameAmbiguousTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("source.renameAmbiguousHint")}</p>
          <ul className="font-mono text-xs">
            {(pending ?? []).map((c) => (
              <li key={`${c.tableId}:${c.from}:${c.to}`}>
                {c.tableId}: {c.from} → {c.to}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!pending) return;
                setPending(null);
                setPendingAfter(null);
                const apply = useSchemaStore.getState().applyDbtOp;
                for (const c of pending) {
                  apply({ op: "removeColumn", tableId: c.tableId, column: c.from });
                  apply({
                    op: "addColumn",
                    tableId: c.tableId,
                    name: c.to,
                    dataType: "string",
                  });
                }
              }}
            >
              {t("source.renameDropAdd")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pendingAfter || !pending) return;
                const confirm = pending.map((c) => ({
                  tableId: c.tableId,
                  oldName: c.from,
                  newName: c.to,
                }));
                const after = pendingAfter;
                setPending(null);
                setPendingAfter(null);
                applyOps(after, confirm);
              }}
            >
              {t("source.renameApply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
