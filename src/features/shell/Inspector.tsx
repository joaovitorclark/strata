import { Table2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSchemaStore } from "@/features/schema/store";
import { useShellLayout } from "@/features/shell/AppShell";
import { BatchSection } from "@/features/shell/inspector/BatchSection";
import { ColumnsSection } from "@/features/shell/inspector/ColumnsSection";
import { EmptyState } from "@/features/shell/inspector/EmptyState";
import { LineageSection } from "@/features/shell/inspector/LineageSection";
import { RelatedTablesSection } from "@/features/shell/inspector/RelatedTablesSection";
import { RelationsSection } from "@/features/shell/inspector/RelationsSection";
import { TableSection } from "@/features/shell/inspector/TableSection";
import { ManagedDrift } from "@/features/shell/inspector/ManagedDrift";
import {
  NewModelFromSelection,
  TransformSection,
} from "@/features/shell/inspector/TransformSection";
import { cn } from "@/lib/utils";

import { FOCUS, layerEdgeClass, type InspectorProps } from "./inspector/types";

export type { InspectorProps };

function defaultOpen(hasColumn: boolean): string[] {
  return hasColumn ? ["lineage", "columns"] : ["table", "columns"];
}

function LineageItem({
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
}: Pick<
  InspectorProps,
  | "onRenameColumn"
  | "onGoToColumn"
  | "onAddMapping"
  | "onUpdateMapping"
  | "onRemoveMapping"
  | "onApply"
  | "onFocusTable"
> & {
  tableId: string;
  tables: InspectorProps["tables"];
  lineageFields: NonNullable<InspectorProps["lineageFields"]>;
  dbml?: string;
}) {
  const { t } = useTranslation();
  return (
    <AccordionItem value="lineage" data-testid="inspector-section-lineage">
      <AccordionTrigger className="py-2 text-xs">{t("shell.inspector.lineage")}</AccordionTrigger>
      <AccordionContent className="px-1">
        <LineageSection
          tableId={tableId}
          tables={tables}
          lineageFields={lineageFields}
          dbml={dbml}
          onApply={onApply}
          onRenameColumn={onRenameColumn}
          onGoToColumn={onGoToColumn}
          onAddMapping={onAddMapping}
          onUpdateMapping={onUpdateMapping}
          onRemoveMapping={onRemoveMapping}
          onFocusTable={onFocusTable}
        />
      </AccordionContent>
    </AccordionItem>
  );
}

export function Inspector({
  tableMeta,
  layerOf,
  colorOf,
  onSetColor,
  layers,
  tables,
  dbml,
  onApply,
  lineageFields = [],
  problemCount = 0,
  onFocusTable,
  onSetLayer,
  onRenameTable,
  onRenameColumn,
  onRemoveTables,
  onGoToColumn,
  onAddMapping,
  onUpdateMapping,
  onRemoveMapping,
}: InspectorProps) {
  const { t } = useTranslation();
  const { setInspectorCollapsed } = useShellLayout();
  const selectedTable = useSchemaStore((s) => s.selectedTable);
  const selectedTableIds = useSchemaStore((s) => s.selectedTableIds);
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);

  const multi = selectedTableIds.length > 1;
  const tableId = selectedTable;
  const table = tableId ? tables.find((item) => item.id === tableId) : undefined;
  const meta = tableId ? tableMeta(tableId) : null;
  const layerId = tableId ? layerOf(tableId) : undefined;
  const layer = layers.find((item) => item.id === layerId);
  const currentColor = tableId ? colorOf(tableId) : undefined;
  const hasColumn = !!selectedColumn && selectedColumn.table === tableId;

  const headerName = table
    ? table.schema
      ? `${table.schema}·${table.name}`
      : table.name
    : tableId;

  return (
    <div
      data-inspector="root"
      data-testid="inspector"
      className="flex h-full min-h-0 w-80 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Table2 size={16} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
          {headerName ? (
            <span
              data-testid="inspector-header-name"
              title={tableId ?? undefined}
              className="truncate font-mono text-xs text-foreground"
            >
              {headerName}
              {tableId ? <span className="sr-only"> {tableId}</span> : null}
            </span>
          ) : (
            <h2 className="truncate px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("shell.inspector.title")}
            </h2>
          )}
          {tableId && !multi ? (
            <span
              data-testid="inspector-layer-chip"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
            >
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", layerEdgeClass(layerId))}
              />
              {layer?.name ?? t("shell.inspector.noLayer")}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={t("shell.inspector.close")}
          onClick={() => setInspectorCollapsed(true)}
          className={cn(
            FOCUS,
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-foreground",
            "hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <X size={17} strokeWidth={1.5} />
        </button>
      </div>

      {multi ? (
        <>
          <BatchSection
            tableIds={selectedTableIds}
            layers={layers}
            dbml={dbml}
            onApply={onApply}
            onSetLayer={onSetLayer}
            onSetColor={onSetColor}
            onRemoveTables={onRemoveTables}
          />
          {/* D4 mount */}
          <NewModelFromSelection />
        </>
      ) : !tableId || !table || !meta ? (
        <EmptyState
          tables={tables}
          lineageFields={lineageFields}
          problemCount={problemCount}
          tableMeta={tableMeta}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Accordion
            key={`${tableId}:${hasColumn ? "col" : "tbl"}`}
            type="multiple"
            defaultValue={defaultOpen(hasColumn)}
            className="px-2"
          >
            {hasColumn ? (
              <LineageItem
                tableId={table.id}
                tables={tables}
                lineageFields={lineageFields}
                dbml={dbml}
                onApply={onApply}
                onRenameColumn={onRenameColumn}
                onGoToColumn={onGoToColumn}
                onAddMapping={onAddMapping}
                onUpdateMapping={onUpdateMapping}
                onRemoveMapping={onRemoveMapping}
                onFocusTable={onFocusTable}
              />
            ) : null}
            <AccordionItem value="table" data-testid="inspector-section-table">
              <AccordionTrigger className="py-2 text-xs">
                {t("shell.inspector.table")}
              </AccordionTrigger>
              <AccordionContent className="px-1">
                <TableSection
                  table={table}
                  meta={meta}
                  layerId={layerId}
                  layerName={layer?.name ?? t("shell.inspector.noLayer")}
                  currentColor={currentColor}
                  dbml={dbml}
                  onApply={onApply}
                  onSetColor={onSetColor}
                  onSetLayer={onSetLayer}
                  onRenameTable={onRenameTable}
                  layers={layers}
                />
                {/* D5 mount */}
                <ManagedDrift tableId={table.id} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="columns" data-testid="inspector-section-columns">
              <AccordionTrigger className="py-2 text-xs">
                {t("shell.inspector.columns")}
              </AccordionTrigger>
              <AccordionContent className="px-1">
                <ColumnsSection
                  table={table}
                  dbml={dbml}
                  onApply={onApply}
                  lineageFields={lineageFields}
                  onFocusTable={onFocusTable}
                />
              </AccordionContent>
            </AccordionItem>
            {/* D4 mount */}
            <TransformSection tableId={table.id} />
            <AccordionItem value="relations" data-testid="inspector-section-relations">
              <AccordionTrigger className="py-2 text-xs">
                {t("shell.inspector.relations")}
              </AccordionTrigger>
              <AccordionContent className="px-1">
                <RelationsSection meta={meta} onFocusTable={onFocusTable} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="related" data-testid="inspector-section-related">
              <AccordionTrigger className="py-2 text-xs">
                {t("shell.inspector.relatedTables")}
              </AccordionTrigger>
              <AccordionContent className="px-1">
                <RelatedTablesSection tableId={table.id} meta={meta} onFocusTable={onFocusTable} />
              </AccordionContent>
            </AccordionItem>
            {hasColumn ? null : (
              <LineageItem
                tableId={table.id}
                tables={tables}
                lineageFields={lineageFields}
                dbml={dbml}
                onApply={onApply}
                onRenameColumn={onRenameColumn}
                onGoToColumn={onGoToColumn}
                onAddMapping={onAddMapping}
                onUpdateMapping={onUpdateMapping}
                onRemoveMapping={onRemoveMapping}
                onFocusTable={onFocusTable}
              />
            )}
          </Accordion>
        </div>
      )}
    </div>
  );
}
