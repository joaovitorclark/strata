import { useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useTranslation } from "react-i18next";

import { useFlowZoom } from "@/features/canvas/hooks/useCanvasEdges";
import { useSchemaStore } from "@/features/schema/store";

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
  id,
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
  const [localHover, setLocalHover] = useState(false);
  const peeked = useSchemaStore((s) => s.peekedEdge);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const active = !!(selected || data?.highlighted);
  const dimmed = !!data?.dimmed && !selected;
  const hovered = localHover || peeked === id;
  const count = data?.count ?? 0;
  const mappings = data?.mappings ?? [];
  const strokeWidth = active ? 2 : hovered ? 2 : 1.5;
  const dash = active ? "6 4" : "4 3";

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
        className="edge-path--lineage"
        style={{
          strokeWidth,
          strokeLinecap: "round",
          strokeDasharray: dash,
        }}
        onMouseEnter={() => setLocalHover(true)}
        onMouseLeave={() => setLocalHover(false)}
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
