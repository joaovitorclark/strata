import { useCallback, useMemo, useState } from "react";
import { FileCode, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ParsedFieldLineage, TableView } from "@/features/schema/model/parse";
import { cn } from "@/lib/utils";

type MappingKey = {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
};

type Props = {
  tables: TableView[];
  mappings: ParsedFieldLineage[];
  targetTable: string;
  targetColumn: string;
  onAdd: (
    sourceTable: string,
    sourceColumn: string,
    targetColumn: string,
    note?: string,
    ref?: string,
  ) => void;
  onUpdate: (
    prev: MappingKey,
    next: {
      sourceTable: string;
      sourceColumn: string;
      targetColumn: string;
      note?: string;
      ref?: string;
    },
  ) => void;
  onRemove: (sourceTable: string, sourceColumn: string, targetColumn: string) => void;
};

const keysMatch = (a: MappingKey | null, b: MappingKey) =>
  !!a &&
  a.sourceTable === b.sourceTable &&
  a.sourceColumn === b.sourceColumn &&
  a.targetTable === b.targetTable &&
  a.targetColumn === b.targetColumn;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SELECT =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed " +
  "disabled:opacity-50";

/**
 * Editor de mapeamentos L2 de UM campo (destino fixo = targetColumn). Renderizado
 * dentro do ColumnPanel — mapeamento e edição do campo num painel só.
 */
export function ColumnMappings({
  tables,
  mappings,
  targetTable,
  targetColumn,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<MappingKey | null>(null);
  const [srcTable, setSrcTable] = useState("");
  const [srcCol, setSrcCol] = useState("");
  const [note, setNote] = useState("");
  const [refPath, setRefPath] = useState("");

  const forColumn = useMemo(
    () => mappings.filter((m) => m.targetTable === targetTable && m.targetColumn === targetColumn),
    [mappings, targetTable, targetColumn],
  );
  const sourceTables = useMemo(
    () => tables.filter((tbl) => tbl.id !== targetTable),
    [tables, targetTable],
  );

  const resetForm = useCallback(() => {
    setEditing(null);
    setSrcTable("");
    setSrcCol("");
    setNote("");
    setRefPath("");
  }, []);

  const loadMapping = (m: ParsedFieldLineage) => {
    setEditing({
      sourceTable: m.sourceTable,
      sourceColumn: m.sourceColumn,
      targetTable: m.targetTable,
      targetColumn: m.targetColumn,
    });
    setSrcTable(m.sourceTable);
    setSrcCol(m.sourceColumn);
    setNote(m.note ?? "");
    setRefPath(m.ref ?? "");
  };

  const handleAdd = () => {
    if (!srcTable || !srcCol.trim()) return;
    onAdd(
      srcTable,
      srcCol.trim(),
      targetColumn,
      note.trim() || undefined,
      refPath.trim() || undefined,
    );
    resetForm();
  };
  const handleSave = () => {
    if (!editing || !srcTable || !srcCol.trim()) return;
    onUpdate(editing, {
      sourceTable: srcTable,
      sourceColumn: srcCol.trim(),
      targetColumn,
      note: note.trim() || undefined,
      ref: refPath.trim() || undefined,
    });
    resetForm();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-sm">{t("panels.columnMappings.title")}</strong>
          <span className="tabular-nums text-xs text-muted-foreground">{forColumn.length}</span>
        </div>
        <ul className="space-y-1">
          {forColumn.map((m) => (
            <li
              key={`${m.sourceTable}.${m.sourceColumn}`}
              className="flex items-start gap-1 rounded-md border border-border p-1"
            >
              <button
                type="button"
                className={cn(
                  FOCUS,
                  "min-w-0 flex-1 rounded-sm px-2 py-1 text-left text-xs",
                  "hover:bg-accent",
                  keysMatch(editing, m) && "bg-accent",
                )}
                onClick={() => loadMapping(m)}
              >
                <span className="text-muted-foreground">
                  {m.sourceTable}.{m.sourceColumn}
                </span>
                <span className="px-1 font-semibold text-primary">→</span>
                <span className="font-medium">{targetColumn}</span>
                {(m.note || m.ref) && (
                  <div className="mt-0.5 truncate text-2xs text-muted-foreground">
                    {m.note && <span title={m.note}>{m.note}</span>}
                    {m.ref && (
                      <span title={m.ref} className="ml-1 inline-flex items-center gap-0.5">
                        <FileCode size={12} strokeWidth={1.5} /> {m.ref}
                      </span>
                    )}
                  </div>
                )}
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={t("panels.columnMappings.remove")}
                    onClick={() => {
                      onRemove(m.sourceTable, m.sourceColumn, targetColumn);
                      if (keysMatch(editing, m)) resetForm();
                    }}
                  >
                    <X size={14} strokeWidth={1.5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("panels.columnMappings.remove")}</TooltipContent>
              </Tooltip>
            </li>
          ))}
          {forColumn.length === 0 && (
            <li className="text-xs text-muted-foreground">{t("panels.columnMappings.empty")}</li>
          )}
        </ul>
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {editing ? t("panels.columnMappings.edit") : t("panels.columnMappings.new")}
            </span>
            {editing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={resetForm}
                title={t("panels.columnMappings.new")}
              >
                +
              </Button>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="l2-src-table">{t("panels.columnMappings.sourceTable")}</Label>
            <select
              id="l2-src-table"
              className={SELECT}
              value={srcTable}
              onChange={(e) => {
                setSrcTable(e.target.value);
                setSrcCol("");
              }}
            >
              <option value="">{t("panels.columnMappings.choose")}</option>
              {sourceTables.map((tbl) => (
                <option key={tbl.id} value={tbl.id}>
                  {tbl.id}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="l2-src-col">{t("panels.columnMappings.sourceColumn")}</Label>
            <select
              id="l2-src-col"
              className={SELECT}
              value={srcCol}
              onChange={(e) => setSrcCol(e.target.value)}
              disabled={!srcTable}
            >
              <option value="">{t("panels.columnMappings.dash")}</option>
              {(tables.find((tbl) => tbl.id === srcTable)?.columns ?? []).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="l2-note">{t("panels.columnMappings.etlNote")}</Label>
            <Input
              id="l2-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("panels.columnMappings.etlPlaceholder")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="l2-ref">{t("panels.columnMappings.ref")}</Label>
            <Input
              id="l2-ref"
              type="text"
              value={refPath}
              onChange={(e) => setRefPath(e.target.value)}
              placeholder={t("panels.columnMappings.refPlaceholder")}
            />
          </div>
          <Button type="button" size="sm" onClick={editing ? handleSave : handleAdd}>
            {editing ? t("common.save") : t("panels.columnMappings.add")}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

export type ColumnMappingsProps = Props;
