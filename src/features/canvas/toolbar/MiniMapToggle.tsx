import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MiniMap, useStore, type Node } from "@xyflow/react";
import { Map } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCanvasActions } from "@/features/canvas/actions";
import { isTypingTarget } from "@/features/command-palette/gestures";
import { cn } from "@/lib/utils";
import {
  MINIMAP_BOTTOM_PX,
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  minimapLayerColor,
  readMinimapVisible,
  writeMinimapPref,
} from "./minimapPref";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function MiniMapToggle() {
  const { t } = useTranslation();
  const { layerOf } = useCanvasActions();
  // Count from React Flow's nodes: re-parsing the whole DBML here ran on every keystroke in the
  // source drawer, duplicating the workspace parse on large models.
  const tableCount = useStore((s) => s.nodes.filter((node: Node) => node.type === "table").length);
  const domNode = useStore((s) => s.domNode);
  const [override, setOverride] = useState<boolean | null>(() => {
    try {
      const raw = localStorage.getItem("strata.minimap");
      if (raw === "1") return true;
      if (raw === "0") return false;
    } catch {
      /* private mode / quota */
    }
    return null;
  });
  const visible = override ?? readMinimapVisible(tableCount);

  const toggle = useCallback(() => {
    const next = !visible;
    setOverride(next);
    writeMinimapPref(next);
  }, [visible]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key !== "m" && event.key !== "M") return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const nodeColor = useCallback(
    (node: Node) =>
      node.type === "table" ? minimapLayerColor(layerOf(node.id)) : "hsl(var(--muted))",
    [layerOf],
  );

  return (
    <>
      <button
        type="button"
        data-testid="minimap-toggle"
        aria-pressed={visible}
        aria-label={t("canvas.toolbar.minimap")}
        className={cn(
          FOCUS,
          "inline-flex size-7 items-center justify-center rounded-full text-foreground hover:bg-accent",
          visible && "bg-accent",
        )}
        onClick={toggle}
      >
        <Map size={14} strokeWidth={1.5} />
      </button>
      {visible && domNode
        ? createPortal(
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              ariaLabel={t("canvas.toolbar.minimap")}
              nodeColor={nodeColor}
              nodeStrokeColor={() => "hsl(var(--border))"}
              style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT, bottom: MINIMAP_BOTTOM_PX }}
              className="nodrag nopan nowheel overflow-hidden rounded-md border border-border bg-card/95"
            />,
            domNode,
          )
        : null}
    </>
  );
}
