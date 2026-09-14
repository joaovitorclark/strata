import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ColumnPanel } from "@/features/panels/ColumnPanel";
import type { ParsedFieldLineage, TableView } from "@/features/schema/model/parse";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

import { FOCUS } from "./types";
import type { InspectorProps } from "./types";

type LineageSectionProps = {
  tableId: string;
  tables: TableView[];
  lineageFields: ParsedFieldLineage[];
  dbml?: string;
  onApply?: (next: string) => void;
  onRenameColumn?: InspectorProps["onRenameColumn"];
  onGoToColumn?: InspectorProps["onGoToColumn"];
  onAddMapping?: InspectorProps["onAddMapping"];
  onUpdateMapping?: InspectorProps["onUpdateMapping"];
  onRemoveMapping?: InspectorProps["onRemoveMapping"];
  onFocusTable?: (tableId: string) => void;
};

export function LineageSection({
  tableId,
  tables,
  lineageFields,
  dbml,
  onApply,
  onRenameColumn,
  onGoToColumn,
  onAddMapping,
  onUpdateMapping,
  onRemoveMapping,
  onFocusTable,
}: LineageSectionProps) {
  const { t } = useTranslation();
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);
  const selectColumn = useSchemaStore((s) => s.selectColumn);
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const forTable = lineageFields.filter(
      (m) => m.targetTable === tableId || m.sourceTable === tableId,
    );
    if (!selectedColumn || selectedColumn.table !== tableId) return forTable;
    return forTable.filter(
      (m) =>
        (m.targetTable === selectedColumn.table && m.targetColumn === selectedColumn.column) ||
        (m.sourceTable === selectedColumn.table && m.sourceColumn === selectedColumn.column),
    );
  }, [lineageFields, selectedColumn, tableId]);

  const canMountPanel =
    !!selectedColumn &&
    !!dbml &&
    !!onApply &&
    !!onAddMapping &&
    !!onUpdateMapping &&
    !!onRemoveMapping;

  useEffect(() => {
    if (!canMountPanel) return;
    const node = panelRef.current;
    if (!node) return;
    const id = window.setTimeout(() => {
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, 220);
    return () => window.clearTimeout(id);
  }, [canMountPanel, selectedColumn]);

  return (
    <div ref={panelRef} className="flex flex-col gap-2">
      {canMountPanel ? (
        <ColumnPanel
          embedded
          dbml={dbml}
          tables={tables}
          onApply={onApply}
          onRenameColumn={onRenameColumn}
          onGoToColumn={onGoToColumn}
          mappings={lineageFields}
          onAddMapping={onAddMapping}
          onUpdateMapping={onUpdateMapping}
          onRemoveMapping={onRemoveMapping}
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {filtered.map((m) => (
            <li key={`${m.sourceTable}.${m.sourceColumn}-${m.targetTable}.${m.targetColumn}`}>
              <button
                type="button"
                className={cn(FOCUS, "w-full text-left font-mono text-xs hover:underline")}
                onClick={() => {
                  onFocusTable?.(m.sourceTable);
                  selectColumn({ table: m.sourceTable, column: m.sourceColumn });
                }}
              >
                {m.sourceTable}.{m.sourceColumn} → {m.targetTable}.{m.targetColumn}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="text-xs text-muted-foreground">{t("shell.inspector.lineageEmpty")}</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
