import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import {
  getColumnSettingsFromBlocks,
  setColumnColor,
  setColumnSetting,
  type ColSettings,
} from "@/features/schema/model/edit";
import { splitDbmlBlocks } from "@/features/schema/model/blocks";
import type { ParsedFieldLineage, TableView } from "@/features/schema/model/parse";
import { useSchemaStore } from "@/features/schema/store";
import { ColumnMappings } from "@/features/panels/ColumnMappings";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const COLLAPSE_KEY = "localdrawdb.columnPanelCollapsed";

const FIELD_COLOR_PRESETS = [
  { label: "Vermelho", value: TABLE_COLORS[5] },
  { label: "Amarelo", value: TABLE_COLORS[3] },
  { label: "Verde", value: TABLE_COLORS[2] },
] as const;

const EXTRA_FIELD_COLORS = TABLE_COLORS.filter(
  (c) => !FIELD_COLOR_PRESETS.some((p) => p.value === c),
);

export type ColumnPanelProps = {
  dbml: string;
  tables: TableView[];
  onApply: (next: string) => void;
  onRenameColumn?: (table: string, oldName: string, newName: string) => void;
  onGoToColumn?: (table: string, column: string) => void;
  mappings: ParsedFieldLineage[];
  onAddMapping: (
    sourceTable: string,
    sourceColumn: string,
    targetColumn: string,
    note?: string,
    ref?: string,
  ) => void;
  onUpdateMapping: (
    prev: {
      sourceTable: string;
      sourceColumn: string;
      targetTable: string;
      targetColumn: string;
    },
    next: {
      sourceTable: string;
      sourceColumn: string;
      targetColumn: string;
      note?: string;
      ref?: string;
    },
  ) => void;
  onRemoveMapping: (sourceTable: string, sourceColumn: string, targetColumn: string) => void;
  embedded?: boolean;
};

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function ColumnPanel({
  dbml,
  tables,
  onApply,
  onRenameColumn,
  onGoToColumn,
  mappings,
  onAddMapping,
  onUpdateMapping,
  onRemoveMapping,
  embedded = false,
}: ColumnPanelProps) {
  const applyDbt = useSchemaStore((s) => (s.documentFormat === "dbt" ? s.applyDbtOp : null));
  const sel = useSchemaStore((s) => s.selectedColumn);
  const selectColumn = useSchemaStore((s) => s.selectColumn);
  const [nameDraft, setNameDraft] = useState("");
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const table = useMemo(
    () => (sel ? tables.find((t) => t.id === sel.table) : undefined),
    [tables, sel],
  );

  const blocks = useMemo(() => splitDbmlBlocks(dbml), [dbml]);

  const settings = useMemo(
    () => (sel ? getColumnSettingsFromBlocks(blocks, sel.table, sel.column) : null),
    [blocks, sel],
  );

  const refOptions = useMemo(() => {
    if (!sel) return [];
    const out: { value: string; label: string }[] = [];
    for (const t of tables) {
      for (const c of t.columns) {
        if (t.id === sel.table && c.name === sel.column) continue;
        if (c.pk) out.push({ value: `${t.id}.${c.name}`, label: `${t.id}.${c.name} (PK)` });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [tables, sel]);

  const compositeHint = useMemo(() => {
    if (!sel || !table) return null;
    const groups = table.compositePks?.filter((g) => g.includes(sel.column) && g.length > 1);
    if (!groups?.length) return null;
    return groups.map((g) => `(${g.join(", ")})`).join(", ");
  }, [table, sel]);

  if (!sel || !settings) return null;

  const apply = (patch: ColSettings) => {
    if (applyDbt && sel) {
      if (patch.pk !== undefined)
        applyDbt({
          op: "setPrimaryKey",
          tableId: sel.table,
          column: sel.column,
          value: !!patch.pk,
        });
      if (patch.notNull !== undefined)
        applyDbt({
          op: "setNotNull",
          tableId: sel.table,
          column: sel.column,
          value: !!patch.notNull,
        });
      if (patch.default !== undefined)
        applyDbt({
          op: "setDefault",
          tableId: sel.table,
          column: sel.column,
          value: patch.default ?? "",
        });
      if (patch.note !== undefined)
        applyDbt({
          op: "setDescription",
          tableId: sel.table,
          column: sel.column,
          description: patch.note ?? "",
        });
      if (patch.refTarget !== undefined && patch.refTarget) {
        const i = patch.refTarget.lastIndexOf(".");
        applyDbt({
          op: "addRef",
          fromTable: sel.table,
          fromCol: sel.column,
          toTable: patch.refTarget.slice(0, i),
          toCol: patch.refTarget.slice(i + 1),
        });
      }
      return;
    }
    onApply(setColumnSetting(dbml, sel.table, sel.column, { ...settings, ...patch }));
  };

  const commitRename = () => {
    const v = nameDraft.trim();
    if (!v || v === sel.column || !onRenameColumn) return;
    onRenameColumn(sel.table, sel.column, v);
    selectColumn({ table: sel.table, column: v });
    setNameDraft(v);
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const refValue = settings.refTarget ?? "";
  const selCol = table?.columns.find((c) => c.name === sel.column);
  const dbtTests: string[] = [];
  if (settings.pk) dbtTests.push("unique", "not_null");
  else if (settings.notNull) dbtTests.push("not_null");
  if (selCol?.acceptedValues?.length) {
    dbtTests.push(`accepted_values: [${selCol.acceptedValues.join(", ")}]`);
  }
  if (settings.refTarget) dbtTests.push(`relationships → ${settings.refTarget}`);

  const collapseLabel = collapsed ? "Expandir editor" : "Recolher editor";
  const CollapseIcon = collapsed ? ChevronRight : ChevronDown;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "column-panel text-xs text-card-foreground",
          embedded
            ? "w-full bg-sidebar p-3"
            : "rounded-md border border-border bg-card p-3 shadow-md",
          collapsed && "is-collapsed",
        )}
        data-mapping-count={mappings.length}
      >
        <div className="column-panel__head mb-2 flex items-center gap-1.5 border-b border-border pb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("column-panel__collapse size-6 shrink-0", FOCUS)}
                onClick={toggleCollapsed}
                aria-label={collapseLabel}
              >
                <CollapseIcon className="size-3.5" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{collapseLabel}</TooltipContent>
          </Tooltip>
          <strong className="column-panel__col truncate font-medium">{sel.column}</strong>
          <span className="column-panel__tbl truncate text-2xs text-muted-foreground">
            {sel.table}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("column-panel__close ml-auto size-6 shrink-0", FOCUS)}
                aria-label="Fechar editor de coluna"
                onClick={() => selectColumn(null)}
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fechar editor de coluna</TooltipContent>
          </Tooltip>
        </div>
        {!collapsed && (
          <>
            {compositeHint && (
              <p className="column-panel__hint mb-2 italic text-muted-foreground">
                PK composta: {compositeHint}
              </p>
            )}
            <div className="column-panel__field mt-2 flex flex-col gap-1">
              <Label htmlFor="column-panel-name">Nome</Label>
              <Input
                id="column-panel-name"
                type="text"
                className="h-8 text-xs"
                value={nameDraft || sel.column}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                }}
              />
            </div>
            {onGoToColumn && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("column-panel__dbml-btn mt-2 h-8 w-full text-xs", FOCUS)}
                onClick={() => onGoToColumn(sel.table, sel.column)}
              >
                Editar no DBML
              </Button>
            )}
            <div className="column-panel__field mt-2 flex flex-col gap-1">
              <span>Cor do nome</span>
              <div className="column-panel__colors flex flex-wrap items-center gap-1">
                {FIELD_COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={cn(
                      "col-color-dot size-4 rounded-sm ring-1 ring-border",
                      FOCUS,
                      selCol?.color === c.value && "ring-2 ring-ring",
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    aria-label={c.label}
                    onClick={() => {
                      if (applyDbt)
                        applyDbt({
                          op: "setColor",
                          key: `${sel.table}.${sel.column}`,
                          color: c.value,
                        });
                      else onApply(setColumnColor(dbml, sel.table, sel.column, c.value));
                    }}
                  />
                ))}
                {EXTRA_FIELD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "col-color-dot size-4 rounded-sm ring-1 ring-border",
                      FOCUS,
                      selCol?.color === c && "ring-2 ring-ring",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                    onClick={() => onApply(setColumnColor(dbml, sel.table, sel.column, c))}
                  />
                ))}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn("col-color-clear size-6", FOCUS)}
                      aria-label="Sem cor"
                      onClick={() => onApply(setColumnColor(dbml, sel.table, sel.column, null))}
                    >
                      <X className="size-3.5" strokeWidth={1.5} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sem cor</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <label className="column-panel__row mt-2 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!!settings.pk}
                onChange={(e) => apply({ pk: e.target.checked })}
              />
              Primary key
            </label>
            <div className="column-panel__field mt-2 flex flex-col gap-1">
              <Label htmlFor="column-panel-fk">Referência (FK)</Label>
              <select
                id="column-panel-fk"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={refValue}
                onChange={(e) => apply({ refTarget: e.target.value || null })}
              >
                <option value="">— nenhuma —</option>
                {refOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="column-panel__row mt-2 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!!settings.notNull}
                onChange={(e) => apply({ notNull: e.target.checked })}
              />
              Not null
            </label>
            <div className="column-panel__field mt-2 flex flex-col gap-1">
              <Label htmlFor="column-panel-note">Note</Label>
              <Input
                id="column-panel-note"
                type="text"
                className="h-8 text-xs"
                value={settings.note ?? ""}
                onChange={(e) => apply({ note: e.target.value })}
                placeholder="descrição"
              />
            </div>
            <div className="column-panel__field mt-2 flex flex-col gap-1">
              <Label htmlFor="column-panel-default">Default</Label>
              <Input
                id="column-panel-default"
                type="text"
                className="h-8 text-xs"
                value={settings.default ?? ""}
                onChange={(e) => apply({ default: e.target.value })}
                placeholder="ex.: 0 ou 'x'"
              />
            </div>
            {dbtTests.length > 0 && (
              <div className="column-panel__tests mt-2 border-t border-border pt-2">
                <span className="column-panel__tests-label font-medium">Tests dbt</span>
                <ul className="mt-1 list-disc pl-4 font-mono text-2xs text-muted-foreground">
                  {dbtTests.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="column-panel__mappings mt-2 border-t border-border pt-2">
              <ColumnMappings
                tables={tables}
                mappings={mappings}
                targetTable={sel.table}
                targetColumn={sel.column}
                onAdd={onAddMapping}
                onUpdate={onUpdateMapping}
                onRemove={onRemoveMapping}
              />
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
