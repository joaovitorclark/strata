import { useMemo, useState, type KeyboardEvent, type MouseEvent, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, MoreHorizontal } from "lucide-react";
import { computeVirtualWindow } from "@/features/canvas/hooks/useVirtualWindow";
import {
  COLUMN_VIRTUAL_OVERSCAN,
  COLUMN_VIRTUAL_ROW_H,
  COLUMN_VIRTUAL_VIEW_ROWS,
} from "@/features/canvas/utils/scaleLimits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

const VIEW_H_FALLBACK = COLUMN_VIRTUAL_VIEW_ROWS * COLUMN_VIRTUAL_ROW_H;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
  onFocusTable?: (id: string) => void;
  onOpenInspector?: () => void;
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

function HighlightName({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-primary/25 text-inherit">
        {text.slice(i, i + query.length)}
      </mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function SchemaTree({ tables, layerOf, onFocusTable, onOpenInspector }: SchemaTreeProps) {
  const { t } = useTranslation();
  const selectedTable = useSchemaStore((s) => s.selectedTable);
  const selectedTableIds = useSchemaStore((s) => s.selectedTableIds);
  const hiddenTableIds = useSchemaStore((s) => s.hiddenTableIds);
  const selectTable = useSchemaStore((s) => s.selectTable);
  const setSelectedTableIds = useSchemaStore((s) => s.setSelectedTableIds);
  const toggleTableHidden = useSchemaStore((s) => s.toggleTableHidden);
  const setHiddenTables = useSchemaStore((s) => s.setHiddenTables);
  const showAllTables = useSchemaStore((s) => s.showAllTables);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(VIEW_H_FALLBACK);
  const [filter, setFilter] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const query = filter.trim();
  const filteredTables = useMemo(() => {
    if (!query) return tables;
    const q = query.toLowerCase();
    return tables.filter((table) => table.name.toLowerCase().includes(q));
  }, [tables, query]);

  const rows = useMemo(
    () => flattenTables(filteredTables, t("shell.schemaTree.ungrouped")),
    [filteredTables, t],
  );

  const hiddenCount = useMemo(() => {
    const known = new Set(tables.map((table) => table.id));
    return hiddenTableIds.filter((id) => known.has(id)).length;
  }, [tables, hiddenTableIds]);

  const hiddenSet = useMemo(() => new Set(hiddenTableIds), [hiddenTableIds]);

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

  const revealIfHidden = (id: string) => {
    if (useSchemaStore.getState().hiddenTableIds.includes(id)) toggleTableHidden(id);
  };

  const activateTable = (id: string, additive: boolean, pan: boolean) => {
    revealIfHidden(id);
    if (additive) {
      const ids = useSchemaStore.getState().selectedTableIds;
      if (!ids.includes(id)) setSelectedTableIds([...ids, id]);
      return;
    }
    selectTable(id);
    if (pan) onFocusTable?.(id);
  };

  return (
    <nav
      data-testid="schema-tree"
      aria-label={t("shell.schemaTree.title")}
      className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      <div className="flex shrink-0 items-center gap-1 px-1 py-1">
        <Input
          data-testid="schema-tree-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("shell.schemaTree.filter")}
          aria-label={t("shell.schemaTree.filter")}
          className="h-7 px-2 text-xs"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="schema-tree-menu"
              aria-label={t("shell.schemaTree.menu")}
              className={cn(
                FOCUS,
                "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => showAllTables()}>
              {t("shell.schemaTree.showAll")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setHiddenTables(tables.map((table) => table.id))}>
              {t("shell.schemaTree.hideAll")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                setHiddenTables(
                  tables
                    .filter((table) => !selectedTableIds.includes(table.id))
                    .map((table) => table.id),
                )
              }
            >
              {t("shell.schemaTree.hideUnselected")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                  hidden={hiddenSet.has(row.table.id)}
                  hovered={hoveredId === row.table.id}
                  filter={query}
                  onHover={setHoveredId}
                  onActivate={activateTable}
                  onToggleHidden={toggleTableHidden}
                  onOpenInspector={onOpenInspector}
                />
              ),
            )}
          </div>
        </div>
      </div>
      <div
        data-testid="schema-tree-footer"
        className="shrink-0 px-2 py-1 text-2xs text-muted-foreground"
      >
        {t("shell.schemaTree.footer", { total: tables.length, hidden: hiddenCount })}
      </div>
    </nav>
  );
}

function SchemaTreeRow({
  table,
  layerId,
  selected,
  hidden,
  hovered,
  filter,
  onHover,
  onActivate,
  onToggleHidden,
  onOpenInspector,
}: {
  table: SchemaTreeTable;
  layerId?: string;
  selected: boolean;
  hidden: boolean;
  hovered: boolean;
  filter: string;
  onHover: (id: string | null) => void;
  onActivate: (id: string, additive: boolean, pan: boolean) => void;
  onToggleHidden: (id: string) => void;
  onOpenInspector?: () => void;
}) {
  const { t } = useTranslation();

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onActivate(table.id, false, true);
      return;
    }
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onToggleHidden(table.id);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const nav = e.currentTarget.closest("[data-testid='schema-tree']");
    if (!nav) return;
    const rows = [...nav.querySelectorAll<HTMLButtonElement>("[data-tree-table]")];
    const i = rows.indexOf(e.currentTarget);
    const next = e.key === "ArrowDown" ? rows[i + 1] : rows[i - 1];
    next?.focus();
  };

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    onActivate(table.id, e.altKey, !e.altKey);
  };

  return (
    <div
      className="group relative"
      style={{ height: COLUMN_VIRTUAL_ROW_H }}
      onMouseEnter={() => onHover(table.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        data-tree-table={table.id}
        aria-label={table.id}
        aria-current={selected ? "true" : undefined}
        onClick={onClick}
        onDoubleClick={() => {
          onActivate(table.id, false, true);
          onOpenInspector?.();
        }}
        onKeyDown={onKeyDown}
        className={cn(
          FOCUS,
          "relative flex h-full w-full items-center gap-1 pl-3 pr-2 text-left font-mono text-xs",
          selected
            ? "border-l border-l-primary bg-sidebar-accent text-sidebar-accent-foreground"
            : "border-l border-l-transparent hover:bg-surface-hover",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-[3px]",
            layerEdgeClass(layerId),
          )}
        />
        <span
          className={cn("min-w-0 flex-1 truncate font-mono", hidden && "text-muted-foreground")}
        >
          <HighlightName text={table.name} query={filter} />
        </span>
        <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
          {table.columnCount}
        </span>
      </button>
      <button
        type="button"
        data-testid={`schema-tree-visibility-${table.id}`}
        aria-label={
          hidden
            ? t("shell.schemaTree.showTable", { name: table.name })
            : t("shell.schemaTree.hideTable", { name: table.name })
        }
        tabIndex={-1}
        className={cn(
          FOCUS,
          "absolute right-1 top-1/2 z-10 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground",
          !(hovered || hidden) && "pointer-events-none opacity-0",
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleHidden(table.id);
        }}
      >
        {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  );
}
