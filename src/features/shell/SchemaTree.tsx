import { useMemo, useState, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { computeVirtualWindow } from "@/features/canvas/hooks/useVirtualWindow";
import {
  COLUMN_VIRTUAL_OVERSCAN,
  COLUMN_VIRTUAL_ROW_H,
  COLUMN_VIRTUAL_VIEW_ROWS,
} from "@/features/canvas/utils/scaleLimits";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

const VIEW_H_FALLBACK = COLUMN_VIRTUAL_VIEW_ROWS * COLUMN_VIRTUAL_ROW_H;

export type SchemaTreeTable = {
  id: string;
  name: string;
  schema?: string;
  columnCount: number;
  layerId?: string;
};

export type SchemaTreeProps = {
  tables: readonly SchemaTreeTable[];
  layerOf?: (tableId: string) => string | undefined;
};

type FlatRow =
  { kind: "schema"; id: string; label: string } | { kind: "table"; table: SchemaTreeTable };

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

function flattenTables(tables: readonly SchemaTreeTable[], ungrouped: string): FlatRow[] {
  const groups = new Map<string, SchemaTreeTable[]>();
  for (const table of tables) {
    const key = table.schema?.trim() ?? "";
    const list = groups.get(key);
    if (list) list.push(table);
    else groups.set(key, [table]);
  }
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === b) return 0;
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b);
  });
  const rows: FlatRow[] = [];
  for (const key of keys) {
    rows.push({ kind: "schema", id: key || "__ungrouped__", label: key === "" ? ungrouped : key });
    const members = groups.get(key)!;
    members.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    for (const table of members) rows.push({ kind: "table", table });
  }
  return rows;
}

export function SchemaTree({ tables, layerOf }: SchemaTreeProps) {
  const { t } = useTranslation();
  const selectedTable = useSchemaStore((s) => s.selectedTable);
  const selectTable = useSchemaStore((s) => s.selectTable);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(VIEW_H_FALLBACK);

  const rows = useMemo(() => flattenTables(tables, t("shell.schemaTree.ungrouped")), [tables, t]);

  const win = computeVirtualWindow({
    totalItems: rows.length,
    itemHeight: COLUMN_VIRTUAL_ROW_H,
    viewportHeight,
    scrollTop,
    overscan: COLUMN_VIRTUAL_OVERSCAN,
  });
  const visible = rows.slice(win.startIndex, win.endIndex);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    const h = e.currentTarget.clientHeight;
    if (h > 0) setViewportHeight(h);
  };

  return (
    <nav
      aria-label={t("shell.schemaTree.title")}
      className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("shell.schemaTree.title")}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" onScroll={onScroll}>
        <div style={{ height: win.totalHeight, position: "relative" }}>
          <div style={{ transform: `translateY(${win.offsetY}px)` }}>
            {visible.map((row) =>
              row.kind === "schema" ? (
                <div
                  key={`schema:${row.id}`}
                  className="flex items-center px-2 font-sans text-sm text-muted-foreground"
                  style={{ height: COLUMN_VIRTUAL_ROW_H }}
                >
                  {row.label}
                </div>
              ) : (
                <SchemaTreeRow
                  key={row.table.id}
                  table={row.table}
                  layerId={layerOf?.(row.table.id) ?? row.table.layerId}
                  selected={selectedTable === row.table.id}
                  onSelect={selectTable}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function SchemaTreeRow({
  table,
  layerId,
  selected,
  onSelect,
}: {
  table: SchemaTreeTable;
  layerId?: string;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      aria-label={table.id}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(table.id)}
      className={cn(
        "relative flex w-full items-center gap-1 pl-3 pr-2 text-left font-mono text-xs",
        selected
          ? "border-l border-l-primary bg-sidebar-accent text-sidebar-accent-foreground"
          : "border-l border-l-transparent hover:bg-surface-hover",
      )}
      style={{ height: COLUMN_VIRTUAL_ROW_H }}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[3px]",
          layerEdgeClass(layerId),
        )}
      />
      <span className="min-w-0 flex-1 truncate font-mono">{table.name}</span>
      <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
        {table.columnCount}
      </span>
    </button>
  );
}
