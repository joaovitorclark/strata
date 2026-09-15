import { useTranslation } from "react-i18next";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

export function DbtChangeLog() {
  const { t } = useTranslation();
  const format = useSchemaStore((s) => s.documentFormat);
  const entries = useSchemaStore((s) => s.changeLog);
  if (format !== "dbt" || !entries.length) return null;
  return (
    <aside
      data-testid="dbt-changelog"
      className="pointer-events-auto absolute bottom-12 right-3 z-20 w-80 max-h-72 overflow-auto rounded-md border border-border bg-card/95 p-2 shadow-md"
    >
      <h2 className="mb-1 text-[11px] font-medium text-muted-foreground">
        {t("shell.dbtChanges")}
      </h2>
      <ol className="flex flex-col gap-2">
        {entries.map((e) => (
          <li key={e.id} className="rounded-sm border border-border p-1.5">
            <p className="font-mono text-2xs text-foreground">{e.op}</p>
            {e.hunks.map((h) => (
              <div key={h.path} className="mt-1">
                <p className="truncate font-mono text-[10px] text-muted-foreground">{h.path}</p>
                <pre className={cn("max-h-24 overflow-auto font-mono text-[10px] leading-tight")}>
                  {h.lines.slice(0, 40).join("\n")}
                </pre>
              </div>
            ))}
          </li>
        ))}
      </ol>
    </aside>
  );
}
