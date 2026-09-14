import { useCallback, useEffect } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const ICON = 14;
const PILL_FALLBACK_H = 36;
const PILL_GAP = 12;
const ZOOM_MS = 150;
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.5, 2] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable], .cm-editor"));
}

export function ZoomControls() {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const percent = Math.round(zoom * 100);

  const fit = useCallback(() => {
    const pill = document.querySelector("[data-testid='canvas-toolbar']");
    const pillH = pill?.getBoundingClientRect().height || PILL_FALLBACK_H;
    void fitView({
      padding: {
        top: "24px",
        left: "24px",
        right: "24px",
        bottom: `${pillH + PILL_GAP}px`,
      },
      duration: 200,
    });
  }, [fitView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        void zoomIn({ duration: ZOOM_MS });
        return;
      }
      if (mod && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        void zoomOut({ duration: ZOOM_MS });
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        void zoomTo(1, { duration: ZOOM_MS });
        return;
      }
      if (e.shiftKey && !mod && (e.key === "1" || e.key === "!")) {
        e.preventDefault();
        fit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, zoomTo, fit]);

  const btn =
    FOCUS +
    " inline-flex size-7 items-center justify-center rounded-full text-foreground hover:bg-accent";

  return (
    <div className="flex items-center gap-0.5" data-testid="zoom-controls">
      <button
        type="button"
        data-zoom="out"
        aria-label={t("shell.zoomOut")}
        className={btn}
        onClick={() => void zoomOut({ duration: ZOOM_MS })}
      >
        <Minus size={ICON} strokeWidth={1.5} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="zoom-percent"
            data-zoom="percent"
            aria-label={t("canvas.toolbar.zoomMenu")}
            className={
              FOCUS +
              " min-w-8 rounded-full px-1 text-center text-2xs tabular-nums text-muted-foreground hover:bg-accent"
            }
          >
            {t("canvas.toolbar.zoomPercent", { percent })}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" data-testid="zoom-menu">
          {ZOOM_PRESETS.map((level) => (
            <DropdownMenuItem
              key={level}
              onSelect={() => void zoomTo(level, { duration: ZOOM_MS })}
            >
              {t("canvas.toolbar.zoomPercent", { percent: Math.round(level * 100) })}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => fit()}>{t("canvas.toolbar.zoomFit")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        data-zoom="in"
        aria-label={t("shell.zoomIn")}
        className={btn}
        onClick={() => void zoomIn({ duration: ZOOM_MS })}
      >
        <Plus size={ICON} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        data-zoom="fit"
        aria-label={t("shell.fitView")}
        className={btn}
        onClick={fit}
      >
        <Maximize2 size={ICON} strokeWidth={1.5} />
      </button>
    </div>
  );
}
