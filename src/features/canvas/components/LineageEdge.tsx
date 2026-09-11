import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { lineageMarkerUrl } from "./EdgeMarkers";
import "./edgeClasses.css";

export type LineageEdgeData = {
  highlighted?: boolean;
  dimmed?: boolean;
  onRemove?: () => void;
};

type LineageFlowEdge = Edge<LineageEdgeData>;

export function LineageEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<LineageFlowEdge>) {
  const { t } = useTranslation();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });
  const active = !!(selected || data?.highlighted);
  const dimmed = !!data?.dimmed && !selected;

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={lineageMarkerUrl(active)}
        className="edge-path--lineage animate-lineage-flow"
        style={{
          strokeWidth: active ? 2.8 : 1.8,
          strokeLinecap: "round",
          strokeDasharray: "8 4",
        }}
      />
      {!dimmed && (
        <EdgeLabelRenderer>
          <div
            className={`lineage-label nodrag nopan${active ? " lineage-label--active" : ""}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {t("canvas.edges.derivedFrom")}
            {selected && data?.onRemove && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="edge-delete"
                    aria-label={t("canvas.edges.removeLineage")}
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onRemove?.();
                    }}
                  >
                    <X size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("canvas.edges.removeLineage")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
