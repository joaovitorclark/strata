import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import type { ParsedFieldLineage, TableView } from "@/features/schema/model/parse";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

import { ColumnDetail } from "./ColumnDetail";
import { FOCUS } from "./types";

type ColumnsSectionProps = {
  table: TableView;
  dbml?: string;
  onApply?: (next: string) => void;
  lineageFields: ParsedFieldLineage[];
  onFocusTable?: (tableId: string) => void;
};

export function ColumnsSection({
  table,
  dbml,
  onApply,
  lineageFields,
  onFocusTable,
}: ColumnsSectionProps) {
  const { t } = useTranslation();
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);
  const selectColumn = useSchemaStore((s) => s.selectColumn);
  const [filter, setFilter] = useState("");
  const selectedName = selectedColumn?.table === table.id ? selectedColumn.column : null;
  const selectedRef = useRef<HTMLDivElement | null>(null);

  const columns = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return table.columns;
    return table.columns.filter((c) => c.name.toLowerCase().includes(q));
  }, [filter, table.columns]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedName]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        aria-label={t("shell.inspector.filterColumns")}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("shell.inspector.filterColumns")}
        className="h-8 text-xs"
      />
      <ul className="flex flex-col gap-1">
        {columns.map((column) => {
          const open = selectedName === column.name;
          return (
            <li key={column.name}>
              <button
                type="button"
                className={cn(
                  FOCUS,
                  "flex w-full items-center justify-between rounded-sm px-1 py-1 text-left",
                  "hover:bg-accent",
                  open && "bg-accent",
                )}
                onClick={() => selectColumn(open ? null : { table: table.id, column: column.name })}
              >
                <span className="font-mono text-xs text-foreground">{column.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{column.type}</span>
              </button>
              {open ? (
                <div ref={selectedRef} className="mt-1">
                  <ColumnDetail
                    tableId={table.id}
                    column={column}
                    dbml={dbml}
                    onApply={onApply}
                    lineageFields={lineageFields}
                    onFocusTable={onFocusTable}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
