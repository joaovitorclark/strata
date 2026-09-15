import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ColumnPanel } from "@/features/panels/ColumnPanel";
import type { InferredLineage } from "@/features/dbt-source/infer/types";
import { originRef } from "@/features/dbt-source/infer/types";
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

function isInferredMapping(rows: InferredLineage[], m: ParsedFieldLineage): boolean {
  return rows.some(
    (row) =>
      row.target.model === m.targetTable &&
      row.target.column === m.targetColumn &&
      row.from.some((o) => o.relation === m.sourceTable && o.column === m.sourceColumn),
  );
}

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
  const inferredLineage = useSchemaStore((s) => s.inferredLineage);
  const applyDbtOp = useSchemaStore((s) => s.applyDbtOp);
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

  const declared = filtered.filter((m) => !isInferredMapping(inferredLineage, m));
  const inferred = inferredLineage.filter((row) => {
    if (row.level === "unknown") return false;
    if (row.target.model !== tableId && !row.from.some((o) => o.relation === tableId)) return false;
    if (!selectedColumn || selectedColumn.table !== tableId) return true;
    return (
      row.target.column === selectedColumn.column ||
      row.from.some(
        (o) => o.relation === selectedColumn.table && o.column === selectedColumn.column,
      )
    );
  });

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
      {declared.length > 0 ? (
        <p className="text-2xs font-medium text-muted-foreground">
          {t("shell.inspector.lineageDeclared")}
        </p>
      ) : null}
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
          {declared.map((m) => (
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
          {declared.length === 0 && inferred.length === 0 ? (
            <li className="text-xs text-muted-foreground">{t("shell.inspector.lineageEmpty")}</li>
          ) : null}
        </ul>
      )}
      {inferred.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-2xs font-medium text-muted-foreground">
            {t("shell.inspector.lineageInferred")}
          </p>
          <ul className="flex flex-col gap-1">
            {inferred.map((row) =>
              row.from.map((origin) => (
                <li
                  key={`${originRef(origin)}-${row.target.model}.${row.target.column}`}
                  className="flex items-center justify-between gap-1 font-mono text-xs"
                >
                  <span>
                    {originRef(origin)} → {row.target.model}.{row.target.column} ({row.level})
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      data-testid="inspector-infer-confirm"
                      className={cn(FOCUS, "text-2xs underline")}
                      onClick={() =>
                        applyDbtOp({
                          op: "confirmInferredLineage",
                          targetTable: row.target.model,
                          targetColumn: row.target.column,
                          from: originRef(origin),
                          inferred: row.level === "name" ? "name" : "parsed",
                        })
                      }
                    >
                      {t("canvas.edges.inferConfirm")}
                    </button>
                    <button
                      type="button"
                      data-testid="inspector-infer-dismiss"
                      className={cn(FOCUS, "text-2xs underline")}
                      onClick={() =>
                        applyDbtOp({
                          op: "dismissInferredLineage",
                          targetTable: row.target.model,
                          targetColumn: row.target.column,
                          from: originRef(origin),
                        })
                      }
                    >
                      {t("canvas.edges.inferDismiss")}
                    </button>
                  </span>
                </li>
              )),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
