import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useTranslation } from "react-i18next";

import { useFlowZoom } from "@/features/canvas/hooks/useCanvasEdges";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { lineageMarkerUrl } from "./EdgeMarkers";
import "./edgeClasses.css";

export type AggregatedMapping = {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
};

export type LineageEdgeData = {
  highlighted?: boolean;
  dimmed?: boolean;
  count?: number;
  mappings?: AggregatedMapping[];
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
  useFlowZoom();
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
  const count = data?.count ?? 0;
  const mappings = data?.mappings ?? [];

  const label = (
    <div
      className={`lineage-label nodrag nopan${active ? " lineage-label--active" : ""}`}
      style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
    >
      {t("canvas.edges.fieldCount", { count })}
    </div>
  );

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
          {mappings.length ? (
            <Tooltip>
              <TooltipTrigger asChild>{label}</TooltipTrigger>
              <TooltipContent>
                <ul className="flex flex-col gap-0.5 font-mono text-2xs">
                  {mappings.map((m) => (
                    <li
                      key={`${m.sourceTable}.${m.sourceColumn}->${m.targetTable}.${m.targetColumn}`}
                    >
                      {m.sourceTable}.{m.sourceColumn} → {m.targetTable}.{m.targetColumn}
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          ) : (
            label
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
