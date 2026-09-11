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
import type { Cardinality } from "@/features/schema/model/parse";
import { useColumnEdgeCoords } from "@/features/canvas/hooks/useColumnEdgeCoords";

import { relationMarkerUrl } from "./EdgeMarkers";
import "./edgeClasses.css";

export type RelationEdgeData = {
  fromRel: Cardinality;
  toRel: Cardinality;
  highlighted?: boolean;
  dimmed?: boolean;
  muted?: boolean;
  /** Column focus: selected thickness, glow comes from edge--highlight. */
  emphasized?: boolean;
  /** Aggregated link to a group off this page. */
  externalSummary?: boolean;
  linkCount?: number;
  stubLabel?: string;
  externalDetails?: string[];
  onRemove?: () => void;
};

type RelationFlowEdge = Edge<RelationEdgeData>;

export function RelationEdge({
  source,
  target,
  sourceHandleId,
  targetHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationFlowEdge>) {
  const { t } = useTranslation();
  const coords = useColumnEdgeCoords(
    source,
    target,
    sourceHandleId,
    targetHandleId,
    "relation",
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  );

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: coords.sourceX,
    sourceY: coords.sourceY,
    targetX: coords.targetX,
    targetY: coords.targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const active = !!(selected || data?.highlighted);
  const emphasis = !!(selected || data?.emphasized);
  const external = !!data?.externalSummary;
  const focused = active || emphasis;

  return (
    <>
      <BaseEdge
        path={path}
        markerStart={relationMarkerUrl(data?.fromRel ?? "*", focused)}
        markerEnd={relationMarkerUrl(data?.toRel ?? "1", focused)}
        className="edge-path--fk"
        style={{
          strokeWidth: external ? 1.5 : focused ? 2.5 : 1.5,
          strokeDasharray: external ? "5 4" : undefined,
        }}
      />
      {selected && data?.externalSummary && data.linkCount && data.stubLabel && (
        <EdgeLabelRenderer>
          <div
            className="edge-external-label edge-external-label--detail nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title={data.externalDetails?.join("\n")}
          >
            {t("canvas.edges.externalLinks", { count: data.linkCount, label: data.stubLabel })}
          </div>
        </EdgeLabelRenderer>
      )}
      {selected && data?.onRemove && !data.externalSummary && (
        <EdgeLabelRenderer>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="edge-delete nodrag nopan"
                aria-label={t("canvas.edges.removeRelation")}
                style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
                onClick={(e) => {
                  e.stopPropagation();
                  data.onRemove?.();
                }}
              >
                <X size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("canvas.edges.removeRelation")}</TooltipContent>
          </Tooltip>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
