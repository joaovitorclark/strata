import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "@/features/source/Editor";
import { applyDbtFileChanges } from "@/features/source/applyDbtFileChanges";
import { filesForTable, listDbtFiles } from "@/features/source/tableYaml";
import { validateDbtYaml } from "@/features/source/yamlValidate";
import { useSchemaStore } from "@/features/schema/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DbtCodePanel({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const files = useSchemaStore((s) => s.files);
  const project = useSchemaStore((s) => s.dbtProject);
  const selectedTable = useSchemaStore((s) => s.selectedTable);
  const loc = useMemo(
    () => (selectedTable ? filesForTable(files, project, selectedTable) : undefined),
    [files, project, selectedTable],
  );
  const fileList = useMemo(() => listDbtFiles(files), [files]);
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [ymlEdit, setYmlEdit] = useState<{ path: string; text: string } | null>(null);
  const [sqlEdit, setSqlEdit] = useState<{ path: string; text: string } | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [errorLine, setErrorLine] = useState<number | undefined>();

  const ymlPath = loc?.ymlPath ?? picked;
  const sqlPath = loc?.sqlPath;
  const ymlValue = ymlPath ? (files[ymlPath] ?? "") : "";
  const sqlValue = sqlPath ? (files[sqlPath] ?? "") : "";
  const ymlBuffer = ymlPath && ymlEdit?.path === ymlPath ? ymlEdit.text : ymlValue;
  const sqlBuffer = sqlPath && sqlEdit?.path === sqlPath ? sqlEdit.text : sqlValue;

  const saveYaml = useCallback(() => {
    if (!ymlPath) return;
    if (/\.ya?ml$/.test(ymlPath)) {
      const result = validateDbtYaml(ymlBuffer);
      if (!result.ok) {
        setError(result.message);
        setErrorLine(result.line);
        return;
      }
    }
    setError(undefined);
    setErrorLine(undefined);
    if (ymlBuffer !== files[ymlPath]) applyDbtFileChanges({ [ymlPath]: ymlBuffer });
    setYmlEdit(null);
  }, [ymlPath, ymlBuffer, files]);

  const saveSql = useCallback(() => {
    if (!sqlPath) return;
    if (sqlBuffer !== files[sqlPath]) applyDbtFileChanges({ [sqlPath]: sqlBuffer }, "editSql");
    setSqlEdit(null);
  }, [sqlPath, sqlBuffer, files]);

  if (!open) return null;

  const filtered = fileList.filter((p) => p.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div
      data-source-drawer
      data-testid="source-drawer"
      className="flex h-[40vh] min-h-0 w-full flex-col bg-card text-card-foreground"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="drawer-save"
          onClick={saveYaml}
        >
          {t("common.save")}
        </Button>
        {ymlPath && (
          <span className="truncate font-mono text-2xs text-muted-foreground" title={ymlPath}>
            {ymlPath}
          </span>
        )}
      </div>
      {!ymlPath ? (
        <div className="flex min-h-0 flex-1 flex-col p-2" data-testid="dbt-file-tree">
          <input
            className="mb-2 h-8 rounded-md border border-border bg-background px-2 text-xs"
            placeholder={t("source.searchFiles")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("source.searchFiles")}
          />
          <ul className="min-h-0 flex-1 overflow-auto font-mono text-xs">
            {filtered.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  className="w-full truncate px-1 py-0.5 text-left hover:bg-muted"
                  onClick={() => setPicked(p)}
                >
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={cn("flex min-h-0 flex-1", sqlPath && "divide-x divide-border")}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="dbt-yaml-editor">
            <Editor
              value={ymlBuffer}
              onChange={(v) => {
                if (ymlPath) setYmlEdit({ path: ymlPath, text: v });
                setError(undefined);
                setErrorLine(undefined);
              }}
              error={error}
              errorLine={errorLine}
              onCommit={saveYaml}
              showOutline={false}
            />
          </div>
          {sqlPath && (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="dbt-sql-editor">
              <Editor
                value={sqlBuffer}
                onChange={(v) => {
                  if (sqlPath) setSqlEdit({ path: sqlPath, text: v });
                }}
                onCommit={saveSql}
                showOutline={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
