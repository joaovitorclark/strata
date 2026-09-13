import { useState, type ReactNode } from "react";
import {
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CodeXml,
  Maximize2,
  Minus,
  Plus,
  Rows3,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_SIZE = 17;
const ICON_STROKE = 1.5;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type Density = "compact" | "cozy";

export type StatusBarProps = {
  problemCount?: number;
  zoomPercent?: number;
  density?: Density;
  dbmlOpen?: boolean;
  recordsOpen?: boolean;
  onProblemsClick?: () => void;
  onDbmlToggle?: () => void;
  onRecordsToggle?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onDensityChange?: (density: Density) => void;
  statusLog?: ReactNode;
  problemsContent?: ReactNode;
  problemsOpen?: boolean;
  onProblemsOpenChange?: (open: boolean) => void;
};

export function StatusBar({
  problemCount = 0,
  zoomPercent = 100,
  density: densityProp,
  dbmlOpen = false,
  recordsOpen = false,
  onProblemsClick,
  onDbmlToggle,
  onRecordsToggle,
  onZoomIn,
  onZoomOut,
  onFitView,
  onDensityChange,
  statusLog,
  problemsContent,
  problemsOpen,
  onProblemsOpenChange,
}: StatusBarProps = {}) {
  const { t } = useTranslation();
  const [uncontrolledDensity, setUncontrolledDensity] = useState<Density>("cozy");
  const [uncontrolledDbml, setUncontrolledDbml] = useState(dbmlOpen);
  const density = densityProp ?? uncontrolledDensity;
  const dbmlExpanded = onDbmlToggle ? dbmlOpen : uncontrolledDbml;

  const toggleDensity = () => {
    const next: Density = density === "cozy" ? "compact" : "cozy";
    if (densityProp === undefined) setUncontrolledDensity(next);
    onDensityChange?.(next);
  };

  const toggleDbml = () => {
    if (onDbmlToggle) {
      onDbmlToggle();
      return;
    }
    setUncontrolledDbml((open) => !open);
  };

  const hasProblems = problemCount > 0;
  const ProblemIcon = hasProblems ? CircleAlert : CircleCheck;

  const problemsButton = (
    <button
      type="button"
      onClick={onProblemsClick}
      aria-label={t("shell.problemsLabel", { count: problemCount })}
      className={cn(
        FOCUS,
        "inline-flex h-6 items-center gap-1.5 rounded-md px-1.5",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <ProblemIcon
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE}
        className={hasProblems ? "text-warning" : "text-success"}
      />
      <span>{t("shell.problems")}</span>
      <span className="tabular-nums text-muted-foreground">{problemCount}</span>
    </button>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-chrome="statusbar"
        data-testid="status-bar"
        className={
          "flex h-8 items-center gap-2 border-t border-border bg-sidebar px-3 " +
          "text-xs text-sidebar-foreground"
        }
      >
        {problemsContent ? (
          <Popover open={problemsOpen} onOpenChange={onProblemsOpenChange}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>{problemsButton}</PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">{t("shell.problems")}</TooltipContent>
            </Tooltip>
            <PopoverContent
              align="start"
              side="top"
              sideOffset={4}
              data-testid="problems-popover"
              className="w-auto max-w-[min(420px,calc(100vw-16px))] p-2"
            >
              {problemsContent}
            </PopoverContent>
          </Popover>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{problemsButton}</TooltipTrigger>
            <TooltipContent side="top">{t("shell.problems")}</TooltipContent>
          </Tooltip>
        )}

        {statusLog}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleDbml}
              aria-label={t("shell.dbml")}
              aria-expanded={dbmlExpanded}
              className={cn(
                FOCUS,
                "inline-flex h-6 items-center gap-1 rounded-md px-1.5",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <CodeXml size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              <span>{t("shell.dbml")}</span>
              <ChevronUp
                size={ICON_SIZE}
                strokeWidth={ICON_STROKE}
                className={cn("transition-transform", dbmlExpanded ? "rotate-0" : "rotate-180")}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("shell.dbml")}</TooltipContent>
        </Tooltip>

        {onRecordsToggle ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onRecordsToggle}
                aria-label={t("shell.records")}
                aria-expanded={recordsOpen}
                className={cn(
                  FOCUS,
                  "inline-flex h-6 items-center gap-1 rounded-md px-1.5",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <span>{t("shell.records")}</span>
                <ChevronUp
                  size={ICON_SIZE}
                  strokeWidth={ICON_STROKE}
                  className={cn("transition-transform", recordsOpen ? "rotate-0" : "rotate-180")}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("shell.records")}</TooltipContent>
          </Tooltip>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onZoomOut}
                aria-label={t("shell.zoomOut")}
                className={cn(
                  FOCUS,
                  "inline-flex size-6 items-center justify-center rounded-md",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Minus size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("shell.zoomOut")}</TooltipContent>
          </Tooltip>

          <span
            aria-live="polite"
            className="min-w-10 text-center tabular-nums text-muted-foreground"
          >
            {Math.round(zoomPercent)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onZoomIn}
                aria-label={t("shell.zoomIn")}
                className={cn(
                  FOCUS,
                  "inline-flex size-6 items-center justify-center rounded-md",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("shell.zoomIn")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onFitView}
                aria-label={t("shell.fitView")}
                className={cn(
                  FOCUS,
                  "inline-flex size-6 items-center justify-center rounded-md",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Maximize2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("shell.fitView")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleDensity}
                aria-label={t("shell.density")}
                aria-pressed={density === "compact"}
                className={cn(
                  FOCUS,
                  "inline-flex h-6 items-center gap-1 rounded-md px-1.5",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Rows3 size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                <span>
                  {t(density === "compact" ? "shell.densityCompact" : "shell.densityCozy")}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("shell.density")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
