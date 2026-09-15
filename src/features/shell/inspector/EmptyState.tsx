import { useTranslation } from "react-i18next";

import type { TableView } from "@/features/schema/model/parse";
import type { ParsedFieldLineage } from "@/features/schema/model/parse";
import type { TableMeta } from "@/features/canvas/actions";

type EmptyStateProps = {
  tables: TableView[];
  lineageFields: ParsedFieldLineage[];
  problemCount: number;
  tableMeta: (tableId: string) => TableMeta;
};

export function EmptyState({ tables, lineageFields, problemCount, tableMeta }: EmptyStateProps) {
  const { t } = useTranslation();
  const columns = tables.reduce((n, table) => n + table.columns.length, 0);
  const relations = tables.reduce((n, table) => n + tableMeta(table.id).fks.length, 0);

  return (
    <div className="flex flex-col gap-3 px-3 py-4">
      <dl
        data-testid="inspector-summary"
        className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-xs text-foreground"
      >
        <dt className="text-[11px] text-muted-foreground">{t("shell.inspector.summaryTables")}</dt>
        <dd>{tables.length}</dd>
        <dt className="text-[11px] text-muted-foreground">{t("shell.inspector.summaryColumns")}</dt>
        <dd>{columns}</dd>
        <dt className="text-[11px] text-muted-foreground">
          {t("shell.inspector.summaryRelations")}
        </dt>
        <dd>{relations}</dd>
        <dt className="text-[11px] text-muted-foreground">
          {t("shell.inspector.summaryMappings")}
        </dt>
        <dd>{lineageFields.length}</dd>
        <dt className="text-[11px] text-muted-foreground">
          {t("shell.inspector.summaryProblems")}
        </dt>
        <dd>{problemCount}</dd>
      </dl>
      <p className="text-sm text-muted-foreground">{t("shell.inspector.empty")}</p>
    </div>
  );
}
