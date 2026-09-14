import { useState } from "react";
import { useOnViewportChange, useReactFlow } from "@xyflow/react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const ICON = 14;
const PILL_FALLBACK_H = 36;
const PILL_GAP = 12;

export function ZoomControls() {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(() => getZoom());
  useOnViewportChange({ onChange: (viewport) => setZoom(viewport.zoom) });

  const fit = () => {
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
  };

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
        onClick={() => void zoomOut({ duration: 0 })}
      >
        <Minus size={ICON} strokeWidth={1.5} />
      </button>
      <span className="min-w-8 text-center text-2xs tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        data-zoom="in"
        aria-label={t("shell.zoomIn")}
        className={btn}
        onClick={() => void zoomIn({ duration: 0 })}
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
