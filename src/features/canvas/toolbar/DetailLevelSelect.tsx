import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isTypingTarget } from "@/features/command-palette/gestures";
import { DETAIL_LEVELS, type DetailLevel } from "@/features/canvas/utils/lod";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const KEY_TO_LEVEL: Record<string, DetailLevel> = {
  "1": "name",
  "2": "keys",
  "3": "columns",
  "4": "docs",
};

export function DetailLevelSelect() {
  const { t } = useTranslation();
  const detailLevel = useSchemaStore((s) => s.detailLevel);
  const setDetailLevel = useSchemaStore((s) => s.setDetailLevel);
  const label = t(`canvas.detail.${detailLevel}`);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isTypingTarget(event.target)) return;
      const next = KEY_TO_LEVEL[event.key];
      if (!next) return;
      event.preventDefault();
      setDetailLevel(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDetailLevel]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="detail-level-select"
          aria-label={t("canvas.toolbar.detail")}
          className={cn(
            FOCUS,
            "inline-flex h-7 items-center rounded-full px-2 font-mono text-2xs text-foreground hover:bg-accent",
          )}
        >
          {t("canvas.toolbar.detailLevel", { level: label })} ▾
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="nodrag nopan">
        <DropdownMenuRadioGroup
          value={detailLevel}
          onValueChange={(value) => {
            if (value === "name" || value === "keys" || value === "columns" || value === "docs") {
              setDetailLevel(value);
            }
          }}
        >
          {DETAIL_LEVELS.map((level) => (
            <DropdownMenuRadioItem key={level} value={level}>
              {t(`canvas.detail.${level}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
