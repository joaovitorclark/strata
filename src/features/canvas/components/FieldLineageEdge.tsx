import { useState } from "react";
import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";

import { useFlowZoom } from "@/features/canvas/hooks/useCanvasEdges";
import { useColumnEdgeCoords } from "@/features/canvas/hooks/useColumnEdgeCoords";
import { useSchemaStore } from "@/features/schema/store";

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
  id,
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
  const [localHover, setLocalHover] = useState(false);
  const peeked = useSchemaStore((s) => s.peekedEdge);
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

  const [path] = getBezierPath({
    sourceX: coords.sourceX,
    sourceY: coords.sourceY,
    targetX: coords.targetX,
    targetY: coords.targetY,
    sourcePosition,
    targetPosition,
  });
  const active = !!(selected || data?.highlighted);
  const focused = active || !!data?.emphasized;
  const hovered = localHover || peeked === id;
  const strokeWidth = focused ? 2 : hovered ? 1.5 : 1;
  const dash = focused ? "6 4" : "4 3";

  return (
    <BaseEdge
      path={path}
      markerEnd={lineageMarkerUrl(focused)}
      className="edge-path--field-lineage"
      style={{
        strokeWidth,
        strokeDasharray: dash,
        strokeLinecap: "round",
      }}
      onMouseEnter={() => setLocalHover(true)}
      onMouseLeave={() => setLocalHover(false)}
    />
  );
}
