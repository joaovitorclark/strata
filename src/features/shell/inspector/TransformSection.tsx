import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { defaultTablePosition } from "@/features/canvas/utils/defaultTablePosition";
import {
  contextFromFiles,
  isManagedModel,
  modelTransform,
  suggestTransform,
  toSparkSql,
  type TransformIR,
  type TransformJoin,
} from "@/features/dbt-source/transform";
import { useSchemaStore } from "@/features/schema/store";
import { exportSparkSql } from "@/infrastructure/api";
import { cn } from "@/lib/utils";

import { CommitField } from "./CommitField";
import { Field } from "./Field";
import { FOCUS } from "./types";

const SPARK_OPTS = { catalog: "main" as const };

function emptyTransform(): TransformIR {
  return { from: { ref: "", alias: "a" }, joins: [], where: "", group_by: [] };
}

export function NewModelFromSelection() {
  const { t } = useTranslation();
  const documentFormat = useSchemaStore((s) => s.documentFormat);
  const applyDbt = useSchemaStore((s) => (s.documentFormat === "dbt" ? s.applyDbtOp : null));
  const selectedTableIds = useSchemaStore((s) => s.selectedTableIds);
  const files = useSchemaStore((s) => s.files);
  const dbtProject = useSchemaStore((s) => s.dbtProject);
  const positions = useSchemaStore((s) => s.positions);
  const [exportMsg, setExportMsg] = useState("");

  if (documentFormat !== "dbt" || !applyDbt || selectedTableIds.length < 2) return null;

  const onCreate = () => {
    const name = window.prompt(
      t("shell.inspector.newModelFromSelectionPrompt"),
      "gold.from_selection",
    );
    if (!name?.trim()) return;
    const transform = suggestTransform(files, dbtProject, selectedTableIds);
    applyDbt({
      op: "addManagedFromSelection",
      tableId: name.trim(),
      sourceTableIds: selectedTableIds,
      transform,
      position: defaultTablePosition(positions),
    });
  };

  const onExportSelected = async () => {
    const ctx = contextFromFiles(files, dbtProject);
    const out: Record<string, string> = {};
    for (const id of selectedTableIds) {
      const name = id.includes(".") ? id.slice(id.lastIndexOf(".") + 1) : id;
      const node = ctx.models.find((m) => m.name === name);
      if (!node?.managed || !node.transform) continue;
      out[name] = toSparkSql(ctx, name, SPARK_OPTS);
    }
    if (!Object.keys(out).length) return;
    const result = await exportSparkSql(dbtProject, out);
    setExportMsg(result.files.join(", "));
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
      <button
        type="button"
        data-testid="inspector-new-model-from-selection"
        className={cn(FOCUS, "rounded-md border border-border px-2 py-1 text-xs")}
        onClick={onCreate}
      >
        {t("shell.inspector.newModelFromSelection")}
      </button>
      <button
        type="button"
        data-testid="export-spark-sql-selected"
        className={cn(FOCUS, "rounded-md border border-border px-2 py-1 text-xs")}
        onClick={() => void onExportSelected()}
      >
        {t("shell.inspector.exportSparkSqlSelected")}
      </button>
      {exportMsg ? (
        <p data-testid="export-spark-sql-result" className="break-all font-mono text-2xs">
          {exportMsg}
        </p>
      ) : null}
    </div>
  );
}

export function TransformSection({ tableId }: { tableId: string }) {
  const { t } = useTranslation();
  const documentFormat = useSchemaStore((s) => s.documentFormat);
  const applyDbt = useSchemaStore((s) => (s.documentFormat === "dbt" ? s.applyDbtOp : null));
  const files = useSchemaStore((s) => s.files);
  const dbtProject = useSchemaStore((s) => s.dbtProject);
  const [exportMsg, setExportMsg] = useState("");

  const managed = useMemo(
    () => documentFormat === "dbt" && isManagedModel(files, dbtProject, tableId),
    [documentFormat, files, dbtProject, tableId],
  );
  const ctx = useMemo(
    () => (documentFormat === "dbt" ? contextFromFiles(files, dbtProject) : { models: [] }),
    [documentFormat, files, dbtProject],
  );
  const modelName = tableId.includes(".") ? tableId.slice(tableId.lastIndexOf(".") + 1) : tableId;
  const node = ctx.models.find((m) => m.name === modelName);
  const ir = modelTransform(files, dbtProject, tableId) ?? node?.transform ?? emptyTransform();

  if (!managed || !applyDbt) return null;

  const commit = (next: TransformIR) => {
    applyDbt({ op: "setTransform", tableId, transform: next });
  };

  const fromIsSource = "source" in ir.from && Array.isArray(ir.from.source);
  const joins = ir.joins ?? [];

  const onExport = async (scope: "one" | "project") => {
    const full = contextFromFiles(files, dbtProject);
    const out: Record<string, string> = {};
    if (scope === "one") {
      out[modelName] = toSparkSql(full, modelName, SPARK_OPTS);
    } else {
      for (const m of full.models) {
        if (!m.managed || !m.transform) continue;
        out[m.name] = toSparkSql(full, m.name, SPARK_OPTS);
      }
    }
    if (!Object.keys(out).length) return;
    const result = await exportSparkSql(dbtProject, out);
    setExportMsg(result.files.join(", "));
  };

  return (
    <AccordionItem value="transform" data-testid="inspector-section-transform">
      <AccordionTrigger className="py-2 text-xs">{t("shell.inspector.transform")}</AccordionTrigger>
      <AccordionContent className="px-1">
        <div className="flex flex-col gap-3">
          <Field id="transform-from" label={t("shell.inspector.transformFrom")}>
            <select
              data-testid="inspector-transform-from-kind"
              aria-label={t("shell.inspector.transformFromKind")}
              className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
              value={fromIsSource ? "source" : "ref"}
              onChange={(e) => {
                const alias = ir.from.alias;
                const nextFrom =
                  e.target.value === "source"
                    ? { source: ["raw", "table"] as [string, string], alias }
                    : { ref: "", alias };
                commit({ ...ir, from: nextFrom });
              }}
            >
              <option value="ref">ref</option>
              <option value="source">source</option>
            </select>
            {fromIsSource && ir.from.source ? (
              <>
                <CommitField
                  id="inspector-transform-source-name"
                  label={t("shell.inspector.transformSource")}
                  value={ir.from.source[0]}
                  data-testid="inspector-transform-source-name"
                  onCommit={(v) =>
                    commit({
                      ...ir,
                      from: { source: [v.trim(), ir.from.source![1]], alias: ir.from.alias },
                    })
                  }
                />
                <CommitField
                  id="inspector-transform-source-table"
                  label={t("shell.inspector.transformSourceTable")}
                  value={ir.from.source[1]}
                  data-testid="inspector-transform-source-table"
                  onCommit={(v) =>
                    commit({
                      ...ir,
                      from: { source: [ir.from.source![0], v.trim()], alias: ir.from.alias },
                    })
                  }
                />
              </>
            ) : (
              <CommitField
                id="inspector-transform-ref"
                label={t("shell.inspector.transformRef")}
                value={"ref" in ir.from ? (ir.from.ref ?? "") : ""}
                data-testid="inspector-transform-ref"
                onCommit={(v) => commit({ ...ir, from: { ref: v.trim(), alias: ir.from.alias } })}
              />
            )}
            <CommitField
              id="inspector-transform-from-alias"
              label={t("shell.inspector.transformAlias")}
              value={ir.from.alias}
              data-testid="inspector-transform-from-alias"
              onCommit={(v) => commit({ ...ir, from: { ...ir.from, alias: v.trim() || "a" } })}
            />
          </Field>

          <Field id="transform-joins" label={t("shell.inspector.transformJoins")}>
            {joins.map((join, index) => (
              <div
                key={`${join.alias}-${index}`}
                data-testid={`inspector-transform-join-${index}`}
                className="mb-2 space-y-1 rounded-md border border-border p-2"
              >
                <select
                  aria-label={t("shell.inspector.transformJoinType")}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
                  value={join.type}
                  onChange={(e) => {
                    const next = [...joins];
                    next[index] = { ...join, type: e.target.value as TransformJoin["type"] };
                    commit({ ...ir, joins: next });
                  }}
                >
                  <option value="inner">inner</option>
                  <option value="left">left</option>
                  <option value="right">right</option>
                  <option value="full">full</option>
                </select>
                <CommitField
                  id={`inspector-transform-join-alias-${index}`}
                  label={t("shell.inspector.transformAlias")}
                  value={join.alias}
                  onCommit={(v) => {
                    const next = [...joins];
                    next[index] = { ...join, alias: v.trim() };
                    commit({ ...ir, joins: next });
                  }}
                />
                {"source" in join && join.source ? (
                  <CommitField
                    id={`inspector-transform-join-source-${index}`}
                    label={t("shell.inspector.transformSource")}
                    value={`${join.source[0]},${join.source[1]}`}
                    onCommit={(v) => {
                      const [s, tbl] = v.split(",").map((x) => x.trim());
                      const next = [...joins];
                      next[index] = { ...join, source: [s || "raw", tbl || "t"] };
                      commit({ ...ir, joins: next });
                    }}
                  />
                ) : (
                  <CommitField
                    id={`inspector-transform-join-ref-${index}`}
                    label={t("shell.inspector.transformRef")}
                    value={"ref" in join ? (join.ref ?? "") : ""}
                    onCommit={(v) => {
                      const next = [...joins];
                      next[index] = { ...join, ref: v.trim() };
                      commit({ ...ir, joins: next });
                    }}
                  />
                )}
                <CommitField
                  id={`inspector-transform-join-on-${index}`}
                  label={t("shell.inspector.transformOn")}
                  value={join.on ?? ""}
                  data-testid={`inspector-transform-join-on-${index}`}
                  onCommit={(v) => {
                    const next = [...joins];
                    next[index] = { ...join, on: v };
                    commit({ ...ir, joins: next });
                  }}
                />
                <button
                  type="button"
                  className={cn(FOCUS, "text-[11px] text-destructive")}
                  onClick={() => commit({ ...ir, joins: joins.filter((_, i) => i !== index) })}
                >
                  {t("shell.inspector.transformRemoveJoin")}
                </button>
              </div>
            ))}
            <button
              type="button"
              data-testid="inspector-transform-add-join"
              className={cn(FOCUS, "rounded-md border border-border px-2 py-1 text-xs")}
              onClick={() =>
                commit({
                  ...ir,
                  joins: [
                    ...joins,
                    { ref: "", alias: `j${joins.length + 1}`, type: "left", on: "" },
                  ],
                })
              }
            >
              {t("shell.inspector.transformAddJoin")}
            </button>
          </Field>

          <CommitField
            id="inspector-transform-where"
            label={t("shell.inspector.transformWhere")}
            value={ir.where ?? ""}
            data-testid="inspector-transform-where"
            onCommit={(v) => commit({ ...ir, where: v })}
          />
          <CommitField
            id="inspector-transform-group-by"
            label={t("shell.inspector.transformGroupBy")}
            value={(ir.group_by ?? []).join(", ")}
            data-testid="inspector-transform-group-by"
            onCommit={(v) =>
              commit({
                ...ir,
                group_by: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <CommitField
            id="inspector-transform-having"
            label={t("shell.inspector.transformHaving")}
            value={ir.having ?? ""}
            data-testid="inspector-transform-having"
            onCommit={(v) => commit({ ...ir, having: v })}
          />

          <Field id="transform-exprs" label={t("shell.inspector.transformExpr")}>
            {(node?.columns ?? []).map((col) => (
              <CommitField
                key={col.name}
                id={`inspector-transform-expr-${col.name}`}
                label={col.name}
                value={col.lineage?.find((l) => l.expr)?.expr ?? col.lineage?.[0]?.from ?? ""}
                data-testid={`inspector-transform-expr-${col.name}`}
                onCommit={(v) =>
                  applyDbt({ op: "setColumnExpr", tableId, column: col.name, expr: v })
                }
              />
            ))}
          </Field>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="export-spark-sql"
              className={cn(FOCUS, "rounded-md border border-border px-2 py-1 text-xs")}
              onClick={() => void onExport("one")}
            >
              {t("shell.inspector.exportSparkSql")}
            </button>
            <button
              type="button"
              data-testid="export-spark-sql-project"
              className={cn(FOCUS, "rounded-md border border-border px-2 py-1 text-xs")}
              onClick={() => void onExport("project")}
            >
              {t("shell.inspector.exportSparkSqlProject")}
            </button>
          </div>
          {exportMsg ? (
            <p data-testid="export-spark-sql-result" className="break-all font-mono text-2xs">
              {exportMsg}
            </p>
          ) : null}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
