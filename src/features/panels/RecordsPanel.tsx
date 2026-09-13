import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseRecordsOpen } from "@/features/records/utils/recordsPanelState";
import {
  getColumnSettings,
  setColumnSetting,
  setTableOrRecordsNote,
} from "@/features/schema/model/edit";
import type { ParsedFieldLineage, RefView, TableView } from "@/features/schema/model/parse";
import type { ParsedRecords } from "@/features/schema/model/records";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

type Props = {
  records: ParsedRecords[];
  tables: TableView[];
  refs: RefView[];
  lineageFields?: ParsedFieldLineage[];
  dbml: string;
  onApply: (next: string) => void;
  onFocusTable?: (tableId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const RECORDS_OPEN_KEY = "localdrawdb.recordsPanelOpen";

export function loadRecordsOpen(): boolean {
  try {
    return parseRecordsOpen(localStorage.getItem(RECORDS_OPEN_KEY));
  } catch {
    return false;
  }
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const TEXTAREA =
  "flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "ring-offset-background placeholder:text-muted-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Constraints da tabela ativa, derivadas das colunas (pk/notNull) e dos refs (FK). */
function tableConstraints(table: TableView | undefined, refs: RefView[]) {
  if (!table)
    return {
      pks: [] as string[],
      composites: [] as string[][],
      fks: [] as { col: string; target: string }[],
      notNull: [] as string[],
    };
  const pks = table.columns.filter((c) => c.pk).map((c) => c.name);
  const composites = (table.compositePks ?? []).filter((g) => g.length > 1);
  const notNull = table.columns.filter((c) => c.notNull && !c.pk).map((c) => c.name);
  const fks = refs
    .filter((r) => r.source === table.id || r.source === table.name)
    .map((r) => ({ col: r.fromCol, target: `${r.target}.${r.toCol}` }));
  return { pks, composites, fks, notNull };
}

function NoteField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!focused) setDraft(value);
  }

  return (
    <label className="grid gap-1.5">
      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <textarea
        className={TEXTAREA}
        value={draft}
        placeholder={placeholder}
        rows={2}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          if (draft !== value) onChange(draft);
        }}
      />
    </label>
  );
}

export function RecordsPanel({
  records,
  tables,
  refs,
  lineageFields,
  dbml,
  onApply,
  onFocusTable,
  open: openProp,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(loadRecordsOpen);
  const open = openProp ?? uncontrolledOpen;
  const toggleOpen = () => {
    const next = !open;
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
    try {
      localStorage.setItem(RECORDS_OPEN_KEY, next ? "1" : "0");
    } catch {
      /* noop */
    }
  };
  const selectedTable = useSchemaStore((s) => s.selectedTable);
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);
  const selectedGroup = useSchemaStore((s) => s.selectedGroup);

  const effectiveTableId = selectedColumn?.table ?? selectedTable;

  const filtered = useMemo(() => {
    if (selectedGroup) {
      const groupTables = tables.filter((tbl) => tbl.group === selectedGroup);
      const ids = new Set(groupTables.map((tbl) => tbl.id));
      const names = new Set(groupTables.map((tbl) => tbl.name));
      return records.filter((r) => ids.has(r.table) || names.has(r.table));
    }
    if (effectiveTableId) {
      const table = tables.find((tbl) => tbl.id === effectiveTableId);
      return records.filter((r) => r.table === effectiveTableId || r.table === table?.name);
    }
    return [];
  }, [records, effectiveTableId, selectedGroup, tables]);

  const activeTable = useMemo(
    () => (effectiveTableId ? tables.find((tbl) => tbl.id === effectiveTableId) : undefined),
    [effectiveTableId, tables],
  );

  const constraints = useMemo(() => tableConstraints(activeTable, refs), [activeTable, refs]);
  const hasConstraints =
    constraints.pks.length > 0 ||
    constraints.composites.length > 0 ||
    constraints.fks.length > 0 ||
    constraints.notNull.length > 0;

  const activeRecord = useMemo(() => {
    if (!effectiveTableId) return undefined;
    return records.find((r) => r.table === effectiveTableId || r.table === activeTable?.name);
  }, [records, effectiveTableId, activeTable?.name]);

  const tableNote = activeRecord?.note ?? activeTable?.note ?? "";

  const columnSettings = useMemo(
    () =>
      selectedColumn ? getColumnSettings(dbml, selectedColumn.table, selectedColumn.column) : null,
    [dbml, selectedColumn],
  );

  const noteOnlyEntries = useMemo(() => {
    if (selectedGroup) {
      return tables
        .filter((tbl) => tbl.group === selectedGroup && tbl.note)
        .filter((tbl) => !filtered.some((r) => r.table === tbl.id || r.table === tbl.name))
        .map((tbl) => ({ table: tbl.id, note: tbl.note! }));
    }
    return [];
  }, [selectedGroup, tables, filtered]);

  // L1: origens da tabela (tabelas que alimentam esta via FK RefView).
  // Uma tabela "fonte" para `effectiveTableId` é aquela cuja FK aponta para esta
  // (source !== effectiveTableId && target === effectiveTableId), ou a própria
  // tabela que serve como pai em self-refs. Mostra fontes upstream + downstream.
  const l1Sources = useMemo(() => {
    if (!effectiveTableId) return [] as { table: string; via: string; direction: "up" | "down" }[];
    const out: { table: string; via: string; direction: "up" | "down" }[] = [];
    for (const r of refs) {
      const sourceIsThis = r.source === effectiveTableId;
      const targetIsThis = r.target === effectiveTableId;
      if (!sourceIsThis && !targetIsThis) continue;
      const other = sourceIsThis ? r.target : r.source;
      out.push({ table: other, via: r.fromCol, direction: sourceIsThis ? "down" : "up" });
    }
    return out;
  }, [refs, effectiveTableId]);

  // L2: origens do campo selecionado (ParsedFieldLineage.target = sel.table/col).
  const l2Sources = useMemo(() => {
    if (!selectedColumn || !lineageFields) return [] as ParsedFieldLineage[];
    return lineageFields.filter(
      (m) => m.targetTable === selectedColumn.table && m.targetColumn === selectedColumn.column,
    );
  }, [lineageFields, selectedColumn]);

  const panelCount = filtered.length + noteOnlyEntries.length + (effectiveTableId ? 1 : 0);

  if (!effectiveTableId && !selectedGroup) return null;
  if (!panelCount && !effectiveTableId) return null;

  const applyTableNote = (note: string) => {
    if (!effectiveTableId) return;
    onApply(setTableOrRecordsNote(dbml, effectiveTableId, note));
  };

  const applyColumnNote = (note: string) => {
    if (!selectedColumn || !columnSettings) return;
    onApply(
      setColumnSetting(dbml, selectedColumn.table, selectedColumn.column, {
        ...columnSettings,
        note,
      }),
    );
  };

  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div
      className={cn(
        "flex max-h-[45%] flex-col border-t border-border bg-card text-card-foreground",
        open ? "is-open" : "h-[30px] max-h-none",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={toggleOpen}
        className={cn(FOCUS, "h-auto justify-start rounded-none px-3 py-1.5 text-sm font-semibold")}
      >
        <Chevron size={14} strokeWidth={1.5} />
        {t("panels.records.toggle", { count: Math.max(panelCount, 1) })}
      </Button>
      {open && (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-wrap gap-4 p-3">
            {effectiveTableId && (
              <div className="min-w-64 max-w-xl space-y-3 text-xs">
                <div className="font-mono text-sm font-semibold">{effectiveTableId}</div>
                <NoteField
                  label={t("panels.records.tableNote")}
                  value={tableNote}
                  placeholder={t("panels.records.tableNotePlaceholder")}
                  onChange={applyTableNote}
                />
                {selectedColumn && (
                  <NoteField
                    label={t("panels.records.columnNote", { column: selectedColumn.column })}
                    value={columnSettings?.note ?? ""}
                    placeholder={t("panels.records.columnNotePlaceholder")}
                    onChange={applyColumnNote}
                  />
                )}
                {l1Sources.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("panels.records.l1Title")}
                    </div>
                    {l1Sources.map((src, i) => (
                      <div key={`l1:${i}`} className="flex items-center gap-1.5 text-sm">
                        <span
                          className={cn(
                            "inline-block min-w-6 rounded-sm px-1 font-mono text-2xs",
                            src.direction === "up" ? "text-rel-lineage" : "text-rel-fk",
                          )}
                        >
                          {src.direction === "up" ? "↑" : "↓"}
                        </span>
                        {onFocusTable ? (
                          <button
                            type="button"
                            className={cn(
                              FOCUS,
                              "rounded-sm text-primary underline-offset-4 hover:underline",
                            )}
                            onClick={() => onFocusTable(src.table)}
                            title={t("panels.records.goTo", { table: src.table })}
                          >
                            {src.table}
                          </button>
                        ) : (
                          src.table
                        )}
                        <span className="text-muted-foreground">
                          {t("panels.records.via", { col: src.via })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedColumn && l2Sources.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("panels.records.l2Title")}
                    </div>
                    {l2Sources.map((m, i) => (
                      <div key={`l2:${i}`} className="flex items-center gap-1.5 text-sm">
                        <span className="inline-block rounded-sm bg-secondary px-1 font-mono text-2xs text-secondary-foreground">
                          L2
                        </span>
                        {onFocusTable ? (
                          <button
                            type="button"
                            className={cn(
                              FOCUS,
                              "rounded-sm text-primary underline-offset-4 hover:underline",
                            )}
                            onClick={() => onFocusTable(m.sourceTable)}
                            title={t("panels.records.goTo", { table: m.sourceTable })}
                          >
                            {m.sourceTable}.{m.sourceColumn}
                          </button>
                        ) : (
                          <span>
                            {m.sourceTable}.{m.sourceColumn}
                          </span>
                        )}
                        {m.note && <span className="text-muted-foreground">— {m.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {hasConstraints && (
                  <div className="space-y-1">
                    <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("panels.records.constraints")}
                    </div>
                    {constraints.pks.length > 0 && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="rounded-sm bg-key-pk px-1 font-mono text-2xs text-background">
                          PK
                        </span>
                        {constraints.pks.join(", ")}
                      </div>
                    )}
                    {constraints.composites.map((g, i) => (
                      <div key={`cpk:${i}`} className="flex items-center gap-1.5 text-sm">
                        <span className="rounded-sm bg-key-pk px-1 font-mono text-2xs text-background">
                          PK
                        </span>
                        ({g.join(", ")})
                      </div>
                    ))}
                    {constraints.fks.map((fk, i) => (
                      <div key={`fk:${i}`} className="flex items-center gap-1.5 text-sm">
                        <span className="rounded-sm border border-key-fk px-1 font-mono text-2xs">
                          FK
                        </span>
                        {fk.col} → {fk.target}
                      </div>
                    ))}
                    {constraints.notNull.length > 0 && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="rounded-sm bg-secondary px-1 font-mono text-2xs">
                          NOT NULL
                        </span>
                        {constraints.notNull.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {noteOnlyEntries.map((e) => (
              <div key={`note:${e.table}`} className="text-xs">
                <div className="font-mono font-semibold">{e.table}</div>
                <p className="text-muted-foreground">{e.note}</p>
              </div>
            ))}
            {filtered.map((r) => {
              const tbl = tables.find((item) => item.id === r.table || item.name === r.table);
              const displayNote = r.note ?? tbl?.note;
              return (
                <div key={r.table} className="text-xs">
                  <div className="font-semibold">
                    {r.table}{" "}
                    <span className="font-normal text-muted-foreground">
                      {t("panels.records.rows", { count: r.rows.length })}
                    </span>
                  </div>
                  {displayNote && effectiveTableId !== r.table && effectiveTableId !== tbl?.id && (
                    <p className="text-muted-foreground">{displayNote}</p>
                  )}
                  <div className="mt-1 max-w-full overflow-auto">
                    <table className="w-full border-collapse font-mono text-2xs">
                      {r.columns.length > 0 && (
                        <thead>
                          <tr>
                            {r.columns.map((c) => (
                              <th
                                key={c}
                                className="border-b border-border px-2 py-1 text-left font-medium text-muted-foreground"
                              >
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {r.rows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j} className="border-b border-border px-2 py-1">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export type RecordsPanelProps = Props;
