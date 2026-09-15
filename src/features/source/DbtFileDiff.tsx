import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { diffFiles } from "@/features/dbt-source/dbtDiff";
import { dbtBaselineFiles } from "@/features/source/dbtBaseline";
import { modelNameFromPath } from "@/features/source/tableYaml";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

export function DbtFileDiff({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const files = useSchemaStore((s) => s.files);

  const hunks = useMemo(() => {
    if (!open) return [];
    const baseline = dbtBaselineFiles();
    const keys = new Set([...Object.keys(baseline), ...Object.keys(files)]);
    const changes: Record<string, string | null> = {};
    for (const k of keys) {
      const before = baseline[k];
      const after = files[k];
      if (before === after) continue;
      changes[k] = after ?? null;
    }
    return diffFiles(baseline, changes);
  }, [files, open]);

  const models = useMemo(() => {
    const names = new Set<string>();
    for (const h of hunks) {
      const name = modelNameFromPath(h.path);
      if (name) names.add(name);
    }
    return [...names].sort();
  }, [hunks]);

  if (!open) return null;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-card"
      role="dialog"
      aria-label={t("source.diffTitleDbt")}
      data-testid="dbt-file-diff"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <strong className="text-sm">{t("source.diffTitleDbt")}</strong>
        <span className="font-mono text-xs text-muted-foreground" data-testid="dbt-diff-models">
          {t("source.diffModels", { models: models.join(", ") || "—" })}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto font-mono text-xs">
        {hunks.length === 0 ? (
          <p className="p-3 text-muted-foreground">{t("source.diffEmpty")}</p>
        ) : (
          hunks.map((h) => (
            <section key={h.path} className="border-b border-border" data-testid="dbt-diff-file">
              <h3 className="bg-muted/50 px-2 py-1 font-medium">{h.path}</h3>
              <pre>
                {h.lines.map((line, i) => {
                  const kind = line.includes("+ ") ? "add" : line.includes("- ") ? "del" : "same";
                  return (
                    <div
                      key={`${h.path}:${i}`}
                      className={cn(
                        "px-2",
                        kind === "add" && "bg-success/15 text-success",
                        kind === "del" && "bg-destructive/15 text-destructive",
                      )}
                    >
                      {line}
                    </div>
                  );
                })}
              </pre>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
