import { useTranslation } from "react-i18next";

import type { ColumnView } from "@/features/schema/model/parse";
import type { ParsedFieldLineage } from "@/features/schema/model/parse";
import {
  getColumnSettings,
  setColumnSetting,
  setColumnType,
  setColumnUnique,
} from "@/features/schema/model/edit";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

import { CommitField } from "./CommitField";
import { FOCUS } from "./types";

type ColumnDetailProps = {
  tableId: string;
  column: ColumnView;
  dbml?: string;
  onApply?: (next: string) => void;
  lineageFields: ParsedFieldLineage[];
  onFocusTable?: (tableId: string) => void;
};

function columnHasUnique(dbml: string, table: string, column: string): boolean {
  return (
    setColumnUnique(dbml, table, column, true) === dbml &&
    setColumnUnique(dbml, table, column, false) !== dbml
  );
}

function useTraceField(): ((table: string, column: string) => void) | undefined {
  return useSchemaStore((s) => {
    const rec = s as Record<string, unknown>;
    // S08 focusSlice — keep "Rastrear" hidden until enterFieldTrace exists.
    if (typeof rec.enterFieldTrace === "function") {
      return rec.enterFieldTrace as (table: string, column: string) => void;
    }
    return undefined;
  });
}

export function ColumnDetail({
  tableId,
  column,
  dbml,
  onApply,
  lineageFields,
  onFocusTable,
}: ColumnDetailProps) {
  const { t } = useTranslation();
  const selectColumn = useSchemaStore((s) => s.selectColumn);
  const traceField = useTraceField();
  const settings = dbml ? getColumnSettings(dbml, tableId, column.name) : {};
  const pk = settings.pk ?? column.pk;
  const notNull = settings.notNull ?? column.notNull;
  const unique = dbml ? columnHasUnique(dbml, tableId, column.name) : false;
  const comesFrom = lineageFields.filter(
    (m) => m.targetTable === tableId && m.targetColumn === column.name,
  );
  const feeds = lineageFields.filter(
    (m) => m.sourceTable === tableId && m.sourceColumn === column.name,
  );

  const applyDbt = useSchemaStore((s) => (s.documentFormat === "dbt" ? s.applyDbtOp : null));
  const applyPatch = (patch: Parameters<typeof setColumnSetting>[3]) => {
    if (applyDbt) {
      if (patch.pk !== undefined)
        applyDbt({ op: "setPrimaryKey", tableId, column: column.name, value: !!patch.pk });
      if (patch.notNull !== undefined)
        applyDbt({ op: "setNotNull", tableId, column: column.name, value: !!patch.notNull });
      if (patch.default !== undefined)
        applyDbt({ op: "setDefault", tableId, column: column.name, value: patch.default ?? "" });
      if (patch.note !== undefined)
        applyDbt({
          op: "setDescription",
          tableId,
          column: column.name,
          description: patch.note ?? "",
        });
      if (patch.refTarget !== undefined) {
        if (!patch.refTarget) {
          /* inspector FK clear handled via removeRef when target known */
        } else {
          const i = patch.refTarget.lastIndexOf(".");
          applyDbt({
            op: "addRef",
            fromTable: tableId,
            fromCol: column.name,
            toTable: patch.refTarget.slice(0, i),
            toCol: patch.refTarget.slice(i + 1),
          });
        }
      }
      return;
    }
    if (!dbml || !onApply) return;
    onApply(setColumnSetting(dbml, tableId, column.name, { ...settings, ...patch }));
  };

  const goTo = (table: string, col: string) => {
    onFocusTable?.(table);
    selectColumn({ table, column: col });
  };

  return (
    <div data-testid={`inspector-column-${column.name}`} className="flex flex-col gap-2 pl-1">
      <p className="font-mono text-xs text-foreground">
        {column.name} <span className="text-muted-foreground">{column.type}</span>
      </p>
      <CommitField
        id={`inspector-col-type-${column.name}`}
        label={t("shell.inspector.type")}
        value={column.type}
        onCommit={(type) => {
          if (applyDbt) {
            applyDbt({ op: "setColumnType", tableId, column: column.name, dataType: type });
            return;
          }
          if (dbml && onApply) onApply(setColumnType(dbml, tableId, column.name, type));
        }}
      />
      <label className="flex items-center gap-1.5 text-xs text-foreground">
        <input
          type="checkbox"
          checked={!!pk}
          onChange={(e) => applyPatch({ pk: e.target.checked })}
        />
        {t("shell.inspector.pk")}
      </label>
      <label className="flex items-center gap-1.5 text-xs text-foreground">
        <input
          type="checkbox"
          data-testid="inspector-column-not-null"
          checked={!!notNull}
          onChange={(e) => applyPatch({ notNull: e.target.checked })}
        />
        {t("shell.inspector.notNull")}
      </label>
      <label className="flex items-center gap-1.5 text-xs text-foreground">
        <input
          type="checkbox"
          checked={unique}
          onChange={(e) => {
            if (applyDbt) {
              applyDbt({
                op: "setUnique",
                tableId,
                column: column.name,
                value: e.target.checked,
              });
              return;
            }
            if (dbml && onApply)
              onApply(setColumnUnique(dbml, tableId, column.name, e.target.checked));
          }}
        />
        {t("shell.inspector.unique")}
      </label>
      <CommitField
        id={`inspector-col-default-${column.name}`}
        label={t("shell.inspector.default")}
        value={settings.default ?? ""}
        onCommit={(value) => applyPatch({ default: value })}
      />
      <CommitField
        id={`inspector-col-note-${column.name}`}
        label={t("shell.inspector.note")}
        value={settings.note ?? column.note ?? ""}
        multiline
        onCommit={(note) => applyPatch({ note })}
      />

      <div>
        <h4 className="text-[11px] font-medium text-muted-foreground">
          {t("shell.inspector.comesFrom")}
        </h4>
        <ul data-testid="inspector-comes-from" className="mt-1 flex flex-col gap-1">
          {comesFrom.map((m) => (
            <li key={`${m.sourceTable}.${m.sourceColumn}`} className="flex items-center gap-1">
              <button
                type="button"
                className={cn(FOCUS, "font-mono text-xs text-foreground hover:underline")}
                onClick={() => goTo(m.sourceTable, m.sourceColumn)}
              >
                {m.sourceTable}.{m.sourceColumn}
              </button>
              {traceField ? (
                <button
                  type="button"
                  className={cn(FOCUS, "text-[11px] text-primary hover:underline")}
                  onClick={() => traceField(tableId, column.name)}
                >
                  {t("shell.inspector.trace")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-[11px] font-medium text-muted-foreground">
          {t("shell.inspector.feeds")}
        </h4>
        <ul data-testid="inspector-feeds" className="mt-1 flex flex-col gap-1">
          {feeds.map((m) => (
            <li key={`${m.targetTable}.${m.targetColumn}`} className="flex items-center gap-1">
              <button
                type="button"
                className={cn(FOCUS, "font-mono text-xs text-foreground hover:underline")}
                onClick={() => goTo(m.targetTable, m.targetColumn)}
              >
                {m.targetTable}.{m.targetColumn}
              </button>
              {traceField ? (
                <button
                  type="button"
                  className={cn(FOCUS, "text-[11px] text-primary hover:underline")}
                  onClick={() => traceField(tableId, column.name)}
                >
                  {t("shell.inspector.trace")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
