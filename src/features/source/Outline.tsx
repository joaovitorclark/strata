import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { splitDbmlBlocks, type Block } from "@/features/schema/model/blocks";
import { computeVirtualWindow } from "@/features/canvas/hooks/useVirtualWindow";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  dbml: string;
  onGoToLine: (line: number) => void;
  onFocusTable?: (tableId: string) => void;
};

const ICONS: Record<string, string> = {
  table: "▪",
  ref: "→",
  tableGroup: "▣",
  layerGroup: "◈",
  lineage: "⟿",
  records: "⊞",
  enum: "▦",
  project: "◉",
};

const VIRTUALIZE_THRESHOLD = 80;
const ROW_HEIGHT = 26;
const OVERSCAN = 8;
const HEIGHT_STORAGE_KEY = "strata.outline.height";
const DEFAULT_HEIGHT = 200;
const MIN_HEIGHT = 80;
const MAX_HEIGHT_RATIO = 0.6;

export function Outline({ dbml, onGoToLine, onFocusTable }: Props) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState<number>(() => {
    try {
      const raw = Number(localStorage.getItem(HEIGHT_STORAGE_KEY));
      return Number.isFinite(raw) && raw >= MIN_HEIGHT ? raw : DEFAULT_HEIGHT;
    } catch {
      return DEFAULT_HEIGHT;
    }
  });

  const onResizeStart = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;
      const maxHeight = Math.max(MIN_HEIGHT, Math.floor(window.innerHeight * MAX_HEIGHT_RATIO));
      const onMove = (ev: MouseEvent) => {
        const next = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight + (ev.clientY - startY)));
        setHeight(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setHeight((h) => {
          try {
            localStorage.setItem(HEIGHT_STORAGE_KEY, String(Math.round(h)));
          } catch {
            /* ignore */
          }
          return h;
        });
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [height],
  );

  const deferredDbml = useDeferredValue(dbml);

  const items = useMemo(() => {
    const blocks = splitDbmlBlocks(deferredDbml);
    const base = blocks.filter((b) => b.type !== "blank" && b.type !== "comment");
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((b) => formatLabel(b).toLowerCase().includes(q));
  }, [deferredDbml, query]);

  const listRef = useRef<HTMLUListElement>(null);
  const [viewportHeight, setViewportHeight] = useState(400);
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    ro.observe(el);
    setViewportHeight(el.clientHeight);
    return () => ro.disconnect();
  }, [collapsed]);

  const virtualize = items.length > VIRTUALIZE_THRESHOLD;
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <div
      className={cn(
        "outline-panel flex shrink-0 flex-col border-b border-border bg-card text-card-foreground",
        collapsed && "is-collapsed",
      )}
      style={collapsed ? undefined : { height }}
    >
      <button
        type="button"
        className="outline-panel__toggle flex h-8 items-center gap-1 px-2 text-sm font-medium text-foreground"
        onClick={() => setCollapsed((c) => !c)}
      >
        <Chevron className="size-[14px]" strokeWidth={1.5} aria-hidden />
        {t("source.outline")}
      </button>
      {!collapsed && (
        <>
          <Input
            className="outline-panel__search h-7 rounded-none border-x-0 border-t-0 px-2 font-mono text-xs"
            type="search"
            placeholder={t("source.outlineFilter")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul
            ref={listRef}
            className="outline-panel__list min-h-0 flex-1 overflow-auto font-mono text-xs"
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            {!virtualize &&
              items.map((b, i) => (
                <OutlineItem
                  key={i}
                  block={b}
                  onGoToLine={onGoToLine}
                  onFocusTable={onFocusTable}
                />
              ))}
            {virtualize &&
              (() => {
                const win = computeVirtualWindow({
                  totalItems: items.length,
                  itemHeight: ROW_HEIGHT,
                  viewportHeight,
                  scrollTop,
                  overscan: OVERSCAN,
                });
                const visible = items.slice(win.startIndex, win.endIndex);
                return (
                  <li aria-hidden="true" style={{ position: "relative" }}>
                    <div style={{ height: win.totalHeight }}>
                      <div style={{ transform: `translateY(${win.offsetY}px)` }}>
                        {visible.map((b, j) => (
                          <OutlineItem
                            key={win.startIndex + j}
                            block={b}
                            onGoToLine={onGoToLine}
                            onFocusTable={onFocusTable}
                          />
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })()}
          </ul>
          <div
            className="outline-panel__resize-handle h-1.5 cursor-ns-resize bg-border hover:bg-primary"
            role="separator"
            aria-orientation="horizontal"
            aria-label={t("source.outlineResize")}
            title={t("source.outlineResize")}
            onMouseDown={onResizeStart}
          />
        </>
      )}
    </div>
  );
}

function OutlineItemImpl({
  block: b,
  onGoToLine,
  onFocusTable,
}: {
  block: Block;
  onGoToLine: (line: number) => void;
  onFocusTable?: (tableId: string) => void;
}) {
  return (
    <li
      className="outline-panel__item flex h-[26px] cursor-pointer items-center gap-1.5 px-2 hover:bg-surface-hover"
      onClick={() => {
        if (b.lineStart != null) onGoToLine(b.lineStart);
        if (b.type === "table" && b.name && onFocusTable) {
          onFocusTable(b.name.replace(/"/g, ""));
        }
      }}
    >
      <span className="outline-panel__icon text-muted-foreground">{ICONS[b.type] || "·"}</span>
      <span className="outline-panel__label truncate text-foreground">{formatLabel(b)}</span>
    </li>
  );
}

const OutlineItem = memo(OutlineItemImpl);

function formatLabel(b: Block): string {
  if (b.name) return `${b.type === "table" ? "" : b.type + " "}${b.name.replace(/"/g, "")}`;
  if (b.type === "ref") {
    const m = /Ref\s*(?:\w+\s*)?:\s*(.+)/i.exec(b.text);
    return m ? m[1].trim().slice(0, 40) : "Ref";
  }
  if (b.type === "lineage") return "Lineage";
  return b.type;
}
