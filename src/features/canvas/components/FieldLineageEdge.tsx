import { BaseEdge, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";

import { useFlowZoom } from "@/features/canvas/hooks/useCanvasEdges";
import { useColumnEdgeCoords } from "@/features/canvas/hooks/useColumnEdgeCoords";

import { lineageMarkerUrl } from "./EdgeMarkers";
import "./edgeClasses.css";

export type FieldLineageEdgeData = {
  highlighted?: boolean;
  dimmed?: boolean;
  muted?: boolean;
  /** Column focus: selected thickness, glow comes from edge--highlight. */
  emphasized?: boolean;
  label?: string;
  mapping?: {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  };
  onRemove?: () => void;
};

type FieldLineageFlowEdge = Edge<FieldLineageEdgeData>;

export function FieldLineageEdge({
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
  selected,
  data,
}: EdgeProps<FieldLineageFlowEdge>) {
  useFlowZoom();
  const coords = useColumnEdgeCoords(
    source,
    target,
    sourceHandleId,
    targetHandleId,
    "fieldLineage",
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  );

  const [path] = getSmoothStepPath({
    sourceX: coords.sourceX,
    sourceY: coords.sourceY,
    targetX: coords.targetX,
    targetY: coords.targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 6,
  });
  const active = !!(selected || data?.highlighted);
  const focused = active || !!data?.emphasized;

  return (
    <BaseEdge
      path={path}
      markerEnd={lineageMarkerUrl(focused)}
      className="edge-path--field-lineage animate-lineage-flow"
      style={{
        strokeWidth: focused ? 2.4 : 1.4,
        strokeDasharray: "6 6",
        strokeLinecap: "round",
      }}
    />
  );
}
