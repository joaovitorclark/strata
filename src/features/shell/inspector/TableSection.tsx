import { useTranslation } from "react-i18next";

import { TABLE_COLORS } from "@/features/canvas/tableColors";
import type { TableMeta } from "@/features/canvas/actions";
import type { TableView } from "@/features/schema/model/parse";
import { setTableOrRecordsNote } from "@/features/schema/model/edit";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

import { CommitField } from "./CommitField";
import { Field } from "./Field";
import { FOCUS, layerEdgeClass } from "./types";

type TableSectionProps = {
  table: TableView;
  meta: TableMeta;
  layerId: string | undefined;
  layerName: string;
  currentColor: string | undefined;
  dbml?: string;
  onApply?: (next: string) => void;
  onSetColor: (tableId: string, color: string | null) => void;
  onSetLayer?: (tableId: string, layerId: string | null) => void;
  onRenameTable?: (tableId: string, newName: string) => void;
  layers: { id: string; name: string }[];
};

export function TableSection({
  table,
  meta,
  layerId,
  layerName,
  currentColor,
  dbml,
  onApply,
  onSetColor,
  onSetLayer,
  onRenameTable,
  layers,
}: TableSectionProps) {
  const { t } = useTranslation();
  const applyDbt = useSchemaStore((s) => (s.documentFormat === "dbt" ? s.applyDbtOp : null));
  const columnCount = table.columns.length;
  const relationCount = meta.fks.length + meta.refsIn.length;

  return (
    <div className="flex flex-col gap-3">
      <CommitField
        id="inspector-table-name"
        label={t("shell.inspector.name")}
        value={table.name}
        onCommit={(name) => {
          const next = table.schema ? `${table.schema}.${name.trim()}` : name.trim();
          if (next && next !== table.id) onRenameTable?.(table.id, next);
        }}
      />
      <CommitField
        id="inspector-table-schema"
        label={t("shell.inspector.schema")}
        value={table.schema ?? ""}
        onCommit={(schema) => {
          const next = schema.trim() ? `${schema.trim()}.${table.name}` : table.name;
          if (next !== table.id) onRenameTable?.(table.id, next);
        }}
      />

      <Field id="layer" label={t("shell.inspector.layer")}>
        <select
          aria-label={t("shell.inspector.layer")}
          className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
          value={layerId ?? ""}
          onChange={(event) => onSetLayer?.(table.id, event.target.value || null)}
        >
          <option value="">{t("shell.inspector.noLayer")}</option>
          {layers.map((layer) => (
            <option key={layer.id} value={layer.id}>
              {layer.name}
            </option>
          ))}
        </select>
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-foreground">
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", layerEdgeClass(layerId))}
          />
          {layerName}
        </span>
      </Field>

      <p className="font-mono text-xs tabular-nums text-foreground">
        {t("shell.inspector.counts", { columns: columnCount, relations: relationCount })}
      </p>

      <Field id="colour" label={t("shell.inspector.colour")}>
        <div className="grid grid-cols-6 gap-1">
          {TABLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={currentColor === c}
              onClick={() => onSetColor(table.id, c)}
              className={cn(
                FOCUS,
                "size-4 rounded-sm ring-1 ring-border",
                currentColor === c && "ring-2 ring-ring",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label={t("shell.inspector.noColour")}
          onClick={() => onSetColor(table.id, null)}
          className={cn(
            FOCUS,
            "mt-1 text-left text-[11px] text-muted-foreground hover:text-foreground",
          )}
        >
          {t("shell.inspector.noColour")}
        </button>
      </Field>

      {(onApply && dbml != null) || applyDbt ? (
        <CommitField
          id="inspector-table-note"
          data-testid="inspector-table-note"
          label={t("shell.inspector.note")}
          value={meta.note ?? ""}
          multiline
          onCommit={(note) => {
            if (applyDbt) {
              applyDbt({ op: "setDescription", tableId: table.id, description: note });
              return;
            }
            if (onApply && dbml != null) onApply(setTableOrRecordsNote(dbml, table.id, note));
          }}
        />
      ) : meta.note ? (
        <Field id="note" label={t("shell.inspector.note")}>
          <p className="font-mono text-xs text-foreground">{meta.note}</p>
        </Field>
      ) : null}

      {meta.pks.length > 0 ? (
        <Field id="pks" label={t("shell.inspector.primaryKey")}>
          <p className="font-mono text-xs text-foreground">{meta.pks.join(", ")}</p>
        </Field>
      ) : null}

      {meta.materialization ? (
        <Field id="materialization" label={t("shell.inspector.materialization")}>
          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {meta.materialization}
          </span>
        </Field>
      ) : null}

      {meta.tags && meta.tags.length > 0 ? (
        <Field id="tags" label={t("shell.inspector.tags")}>
          <div className="flex flex-wrap gap-1">
            {meta.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        </Field>
      ) : null}

      {meta.resourceType ? (
        <Field id="resourceType" label={t("shell.inspector.resourceType")}>
          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {meta.resourceType}
          </span>
        </Field>
      ) : null}

      {meta.sources.length > 0 ? (
        <Field id="sources" label={t("shell.inspector.sources")}>
          <p className="font-mono text-xs text-foreground">
            {t("canvas.edges.derivedFrom")}: {meta.sources.join(", ")}
          </p>
        </Field>
      ) : null}

      {meta.sample ? (
        <Field id="sample" label={t("shell.inspector.sample")}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-[11px]">
              {meta.sample.columns.length > 0 ? (
                <thead>
                  <tr>
                    {meta.sample.columns.map((col) => (
                      <th
                        key={col}
                        className="border-b border-border px-1 text-left font-medium text-foreground"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {meta.sample.rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {row.map((value, j) => (
                      <td key={j} className="px-1 py-0.5 text-muted-foreground">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Field>
      ) : null}

      {meta.refsIn.length > 0 ? (
        <Field id="refsIn" label={t("shell.inspector.referencedBy")}>
          <p className="font-mono text-xs text-foreground">{meta.refsIn.join(", ")}</p>
        </Field>
      ) : null}

      {meta.columnNotes.length > 0 ? (
        <Field id="note" label={t("shell.inspector.comments")}>
          <ul data-field="columnNotes" className="flex flex-col gap-1">
            {meta.columnNotes.map((item) => (
              <li key={item.column} className="text-xs text-foreground">
                <span className="font-mono font-medium">{item.column}:</span> {item.note}
              </li>
            ))}
          </ul>
        </Field>
      ) : null}
    </div>
  );
}
