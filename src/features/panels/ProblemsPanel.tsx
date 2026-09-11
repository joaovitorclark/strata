import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModelIssue } from "@/features/schema/model/validateModel";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type ProblemsPanelProps = {
  issues: ModelIssue[];
  onFocusTable?: (tableId: string) => void;
  onGoToLine?: (line: number) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ProblemsPanel({
  issues,
  onFocusTable,
  onGoToLine,
  open,
  onOpenChange,
}: ProblemsPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);

  const errors = useMemo(() => issues.filter((i) => i.severity === "error"), [issues]);
  const warns = useMemo(() => issues.filter((i) => i.severity === "warn"), [issues]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (badgeRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.(".problems-pop")) return;
      setInternalOpen(false);
      onOpenChange?.(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [isOpen, onOpenChange]);

  if (!issues.length) return null;

  const severity = errors.length ? "error" : "warn";
  const label = errors.length
    ? `${errors.length} erro${errors.length !== 1 ? "s" : ""}${warns.length ? ` · ${warns.length} aviso${warns.length !== 1 ? "s" : ""}` : ""}`
    : `${warns.length} aviso${warns.length !== 1 ? "s" : ""}`;

  const toggle = () => {
    if (badgeRef.current) setRect(badgeRef.current.getBoundingClientRect());
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const close = () => {
    setInternalOpen(false);
    onOpenChange?.(false);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={badgeRef}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "problems-badge h-7 gap-1 text-xs",
              FOCUS,
              `problems-badge--${severity}`,
              isOpen && "is-open",
              severity === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-warning/40 bg-warning/15 text-foreground",
            )}
            onClick={toggle}
          >
            <CircleAlert className="problems-badge__icon size-3.5" strokeWidth={1.5} />
            <span className="problems-badge__label">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Problemas do modelo</TooltipContent>
      </Tooltip>
      {isOpen &&
        rect &&
        createPortal(
          <div
            className="problems-pop z-[1000] max-h-80 min-w-[260px] max-w-[min(420px,calc(100vw-16px))] overflow-y-auto rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground shadow-md"
            style={{
              position: "fixed",
              top: rect.bottom + 4,
              right: Math.max(8, window.innerWidth - rect.right),
            }}
          >
            <ul className="problems-pop__list space-y-1">
              {issues.map((issue, i) => (
                <li
                  key={i}
                  className={cn(
                    "problems-pop__item rounded-sm px-1 py-0.5",
                    `problems-pop__item--${issue.severity}`,
                    issue.severity === "error" ? "text-destructive" : "text-foreground",
                  )}
                >
                  <div className="problems-pop__row flex flex-wrap items-center gap-1">
                    {issue.line != null && onGoToLine && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn("problems-pop__goto h-6 px-1.5 text-2xs", FOCUS)}
                            onClick={() => {
                              onGoToLine(issue.line!);
                              close();
                            }}
                          >
                            Linha
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ir à linha no editor</TooltipContent>
                      </Tooltip>
                    )}
                    {issue.tableId && onFocusTable && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn("problems-pop__goto h-6 px-1.5 text-2xs", FOCUS)}
                            onClick={() => {
                              onFocusTable(issue.tableId!);
                              close();
                            }}
                          >
                            Tabela
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ir para tabela no canvas</TooltipContent>
                      </Tooltip>
                    )}
                    <span className="problems-pop__msg">{issue.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </TooltipProvider>
  );
}
