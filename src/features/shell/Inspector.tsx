import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CanvasActions, TableMeta } from "@/features/canvas/actions";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import type { TableView } from "@/features/schema/model/parse";
import { useSchemaStore } from "@/features/schema/store";
import { useShellLayout } from "@/features/shell/AppShell";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type InspectorProps = {
  tableMeta: CanvasActions["tableMeta"];
  layerOf: CanvasActions["layerOf"];
  colorOf: CanvasActions["colorOf"];
  onSetColor: CanvasActions["onSetColor"];
  layers: CanvasActions["layers"];
  tables: TableView[];
};

function layerEdgeClass(layerId: string | undefined): string {
  switch ((layerId ?? "").toLowerCase()) {
    case "bronze":
      return "bg-layer-bronze";
    case "silver":
    case "prata":
      return "bg-layer-silver";
    case "gold":
    case "ouro":
      return "bg-layer-gold";
    default:
      return "bg-layer-raw";
  }
}

function formatFkTarget(ref: string): string {
  const i = ref.lastIndexOf(".");
  if (i <= 0 || i === ref.length - 1) return ref;
  return `${ref.slice(0, i)}(${ref.slice(i + 1)})`;
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section data-field={id} className="space-y-1.5">
      <h3 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  );
}

function KeyBadge({ kind, name }: { kind: "PK" | "FK"; name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground">
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          kind === "PK" ? "bg-key-pk" : "border border-key-fk bg-transparent",
        )}
      />
      {name}
      <span>{kind}</span>
    </span>
  );
}

export function Inspector({
  tableMeta,
  layerOf,
  colorOf,
  onSetColor,
  layers,
  tables,
}: InspectorProps) {
  const { t } = useTranslation();
  const { setInspectorCollapsed } = useShellLayout();
  const selectedTable = useSchemaStore((s) => s.selectedTable);
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);

  const tableId = selectedTable;
  const table = tableId ? tables.find((item) => item.id === tableId) : undefined;
  const meta: TableMeta | null = tableId ? tableMeta(tableId) : null;
  const layerId = tableId ? layerOf(tableId) : undefined;
  const layer = layers.find((item) => item.id === layerId);
  const currentColor = tableId ? colorOf(tableId) : undefined;
  const columnCount = table?.columns.length ?? 0;
  const selectedColName = selectedColumn?.table === tableId ? selectedColumn.column : null;
  const selectedColView = selectedColName
    ? table?.columns.find((c) => c.name === selectedColName)
    : undefined;
  const selectedColFk = selectedColName
    ? meta?.fks.find((f) => f.column === selectedColName)
    : undefined;
  const selectedColNote = selectedColName
    ? meta?.columnNotes.find((n) => n.column === selectedColName)
    : undefined;

  return (
    <div
      data-inspector="root"
      className="flex h-full min-h-0 w-64 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("shell.inspector.title")}
        </h2>
        <button
          type="button"
          aria-label={t("shell.inspector.close")}
          onClick={() => setInspectorCollapsed(true)}
          className={cn(
            FOCUS,
            "inline-flex size-7 items-center justify-center rounded-md text-foreground",
            "hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <X size={17} strokeWidth={1.5} />
        </button>
      </div>

      {!tableId || !meta ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">{t("shell.inspector.empty")}</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-4">
            <Field id="table" label={t("shell.inspector.table")}>
              <p className="truncate font-mono text-xs text-foreground">{tableId}</p>
            </Field>

            <Field id="layer" label={t("shell.inspector.layer")}>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-foreground">
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full", layerEdgeClass(layerId))}
                />
                {layer?.name ?? t("shell.inspector.noLayer")}
              </span>
            </Field>

            <Field id="columns" label={t("shell.inspector.columns")}>
              <p className="font-mono text-xs tabular-nums text-foreground">{columnCount}</p>
            </Field>

            {meta.pks.length > 0 ? (
              <Field id="pks" label={t("shell.inspector.primaryKey")}>
                <div className="flex flex-wrap gap-1">
                  {meta.pks.map((name) => (
                    <KeyBadge key={name} kind="PK" name={name} />
                  ))}
                </div>
              </Field>
            ) : null}

            {meta.fks.length > 0 ? (
              <Field id="fks" label={t("shell.inspector.foreignKeys")}>
                <ul className="flex flex-col gap-1">
                  {meta.fks.map((fk) => (
                    <li key={fk.column} className="font-mono text-xs text-foreground">
                      {fk.column} → {formatFkTarget(fk.ref)}
                    </li>
                  ))}
                </ul>
              </Field>
            ) : null}

            {meta.materialization ? (
              <Field id="materialization" label={t("shell.inspector.materialization")}>
                <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground">
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
                      className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </Field>
            ) : null}

            {meta.resourceType ? (
              <Field id="resourceType" label={t("shell.inspector.resourceType")}>
                <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground">
                  {meta.resourceType}
                </span>
              </Field>
            ) : null}

            <Field id="colour" label={t("shell.inspector.colour")}>
              <div className="grid grid-cols-6 gap-1">
                {TABLE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={currentColor === c}
                    onClick={() => onSetColor(tableId, c)}
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
                onClick={() => onSetColor(tableId, null)}
                className={cn(
                  FOCUS,
                  "mt-1 text-left text-2xs text-muted-foreground hover:text-foreground",
                )}
              >
                {t("shell.inspector.noColour")}
              </button>
            </Field>

            {meta.sources.length > 0 ? (
              <Field id="sources" label={t("shell.inspector.sources")}>
                <p className="text-xs text-foreground">
                  {t("canvas.edges.derivedFrom")}: {meta.sources.join(", ")}
                </p>
              </Field>
            ) : null}

            {meta.sample ? (
              <Field id="sample" label={t("shell.inspector.sample")}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-mono text-2xs">
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

            {meta.note || meta.columnNotes.length > 0 ? (
              <Field id="note" label={t("shell.inspector.comments")}>
                {meta.note ? <p className="text-xs text-foreground">{meta.note}</p> : null}
                {meta.columnNotes.length > 0 ? (
                  <ul data-field="columnNotes" className="flex flex-col gap-1">
                    {meta.columnNotes.map((item) => (
                      <li key={item.column} className="text-xs text-foreground">
                        <span className="font-mono font-medium">{item.column}:</span> {item.note}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Field>
            ) : null}

            {selectedColName ? (
              <Field id="column" label={t("shell.inspector.column")}>
                <div className="flex flex-col gap-1">
                  <p className="font-mono text-xs text-foreground">{selectedColName}</p>
                  {selectedColView ? (
                    <p className="font-mono text-2xs text-muted-foreground">
                      {selectedColView.type}
                    </p>
                  ) : null}
                  {meta.pks.includes(selectedColName) ? (
                    <KeyBadge kind="PK" name={selectedColName} />
                  ) : null}
                  {selectedColFk ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      → {formatFkTarget(selectedColFk.ref)}
                    </p>
                  ) : null}
                  {selectedColNote ? (
                    <p className="text-xs text-foreground">{selectedColNote.note}</p>
                  ) : null}
                </div>
              </Field>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
