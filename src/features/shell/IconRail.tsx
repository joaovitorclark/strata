import {
  CodeXml,
  GitBranch,
  Layers,
  Search,
  Settings,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_SIZE = 17;
const ICON_STROKE = 1.5;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const RAIL_ITEMS = ["tables", "layers", "lineage", "code", "search", "settings"] as const;

export type RailItem = (typeof RAIL_ITEMS)[number];

const RAIL_ICONS: Record<RailItem, LucideIcon> = {
  tables: Table2,
  layers: Layers,
  lineage: GitBranch,
  code: CodeXml,
  search: Search,
  settings: Settings,
};

export type IconRailProps = {
  active?: RailItem;
  onSelect?: (item: RailItem) => void;
};

export function IconRail({ active = "tables", onSelect }: IconRailProps = {}) {
  const { t } = useTranslation();

  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-chrome="rail"
        data-testid="icon-rail"
        className={
          "flex h-full min-h-0 w-full flex-col items-center gap-1 " +
          "border-r border-sidebar-border bg-sidebar py-2"
        }
      >
        {RAIL_ITEMS.map((id) => {
          const Icon = RAIL_ICONS[id];
          const label = t(`shell.rail.${id}`);
          const isActive = active === id;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-rail-item={id}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onSelect?.(id)}
                  className={cn(
                    FOCUS,
                    "inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                >
                  <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
