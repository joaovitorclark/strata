// Caixa de TableGroup: drag só na alça (rótulo + bordas); interior permite pan.
// Cor do grupo (--group-color): borda tracejada 1px a 45 % e preenchimento a 5 %.
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Palette, X } from "lucide-react";
import { useCanvasActions } from "@/features/canvas/actions";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type GroupNodeData = {
  label: string;
  collapsed: boolean;
  count: number;
  color?: string;
  onToggle?: () => void;
};

const FALLBACK_GROUP_COLOR = "hsl(var(--layer-raw))";

function GroupNodeImpl({ data }: { data: GroupNodeData }) {
  const actions = useCanvasActions();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const groupColor = data.color ?? FALLBACK_GROUP_COLOR;
  const style = {
    "--group-color": groupColor,
    borderColor: "color-mix(in srgb, var(--group-color) 45%, transparent)",
    backgroundColor: data.collapsed
      ? "color-mix(in srgb, var(--group-color) 12%, transparent)"
      : "color-mix(in srgb, var(--group-color) 5%, transparent)",
  } as CSSProperties;

  const close = useCallback(() => setRect(null), []);

  // Fecha ao clicar fora (o botão e a paleta portada ficam em subárvores diferentes).
  useEffect(() => {
    if (!rect) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || paletteRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [rect, close]);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "group-node pointer-events-none relative box-border h-full w-full rounded-lg border",
          data.collapsed ? "is-collapsed border-solid" : "border-dashed",
        )}
        style={style}
      >
        {!data.collapsed && (
          <>
            <div className="group-node__edge group-node__edge--top group-node__drag-handle pointer-events-auto absolute left-0 right-0 top-0 z-[1] h-1.5 cursor-move" />
            <div className="group-node__edge group-node__edge--bottom group-node__drag-handle pointer-events-auto absolute bottom-0 left-0 right-0 z-[1] h-1.5 cursor-move" />
            <div className="group-node__edge group-node__edge--left group-node__drag-handle pointer-events-auto absolute bottom-0 left-0 top-0 z-[1] w-1.5 cursor-move" />
            <div className="group-node__edge group-node__edge--right group-node__drag-handle pointer-events-auto absolute bottom-0 right-0 top-0 z-[1] w-1.5 cursor-move" />
          </>
        )}
        <span
          className={cn(
            "group-node__label group-node__drag-handle pointer-events-auto absolute bottom-full left-3 z-[2] mb-1",
            "inline-flex cursor-move items-center gap-1 whitespace-nowrap rounded-md border border-border",
            "bg-card px-2 py-0.5 text-xs font-semibold text-card-foreground shadow-xs",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="group-node__toggle p-0 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={data.collapsed ? "Expandir grupo" : "Colapsar grupo"}
                onClick={(e) => {
                  e.stopPropagation();
                  data.onToggle?.();
                }}
              >
                {data.collapsed ? (
                  <ChevronRight className="shrink-0" size={14} strokeWidth={1.5} />
                ) : (
                  <ChevronDown className="shrink-0" size={14} strokeWidth={1.5} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{data.collapsed ? "Expandir" : "Colapsar"}</TooltipContent>
          </Tooltip>
          {data.label}
          {data.collapsed ? ` · ${data.count} tabela(s)` : ""}
          <button
            ref={btnRef}
            type="button"
            className="group-node__color nodrag nopan pointer-events-auto p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            title="Cor do grupo"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setRect((r) => (r ? null : (btnRef.current?.getBoundingClientRect() ?? null)));
            }}
          >
            <Palette className="shrink-0" size={14} strokeWidth={1.5} />
          </button>
        </span>
        {/* Portada pra document.body: o group node é z-index:-1 e as tabelas cobririam a paleta. */}
        {rect &&
          createPortal(
            <div
              ref={paletteRef}
              className="color-palette color-palette--group nodrag nopan pointer-events-auto fixed z-50 w-[212px] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
              style={{
                top: rect.bottom + 4,
                left: Math.min(rect.left, window.innerWidth - 250),
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="color-palette__row flex flex-wrap gap-1.5">
                {TABLE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="h-[26px] w-[26px] cursor-pointer rounded-[5px] border border-border hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    style={{ background: c }}
                    onClick={() => {
                      actions.onSetGroupColor(data.label, c);
                      close();
                    }}
                  />
                ))}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="color-reset flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-[5px] border border-border bg-muted text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                      aria-label="Sem cor"
                      onClick={() => {
                        actions.onSetGroupColor(data.label, null);
                        close();
                      }}
                    >
                      <X className="shrink-0" size={14} strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Sem cor</TooltipContent>
                </Tooltip>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </TooltipProvider>
  );
}

export const GroupNode = memo(GroupNodeImpl);
