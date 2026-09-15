import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { inspectManaged } from "@/features/dbt-source/managed";
import { useSchemaStore } from "@/features/schema/store";

type Props = { tableId: string };

export function ManagedDrift({ tableId }: Props) {
  const { t } = useTranslation();
  const format = useSchemaStore((s) => s.documentFormat);
  const files = useSchemaStore((s) => s.files);
  const project = useSchemaStore((s) => s.dbtProject);
  const applyDbtOp = useSchemaStore((s) => s.applyDbtOp);
  if (format !== "dbt" || !project) return null;
  const report = inspectManaged(files, project).find(
    (r) => r.tableId === tableId || r.sqlPath.endsWith(`/${tableId.replace(/^.*\./, "")}.sql`),
  );
  if (!report || report.status !== "drift") return null;

  return (
    <div
      data-testid="managed-drift"
      className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-2"
    >
      <p className="text-xs font-medium text-foreground">{t("shell.inspector.driftTitle")}</p>
      <p className="text-xs text-muted-foreground">{t("shell.inspector.driftBody")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="managed-make-manual"
          onClick={() => applyDbtOp({ op: "makeManual", tableId: report.tableId })}
        >
          {t("shell.inspector.makeManual")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-testid="managed-regenerate"
          onClick={() => {
            if (window.confirm(t("shell.inspector.regenerateConfirm"))) {
              applyDbtOp({ op: "regenerate", tableId: report.tableId, confirmed: true });
            }
          }}
        >
          {t("shell.inspector.regenerate")}
        </Button>
      </div>
    </div>
  );
}
