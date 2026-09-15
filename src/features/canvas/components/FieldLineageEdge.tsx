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
import { useColumnEdgeCoords } from "@/features/canvas/hooks/useColumnEdgeCoords";
import type { InferredLineage } from "@/features/dbt-source/infer/types";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

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

function matchInferred(
  rows: InferredLineage[],
  mapping: FieldLineageEdgeData["mapping"],
): InferredLineage | undefined {
  if (!mapping) return undefined;
  return rows.find(
    (row) =>
      row.target.model === mapping.targetTable &&
      row.target.column === mapping.targetColumn &&
      row.from.some((o) => o.relation === mapping.sourceTable && o.column === mapping.sourceColumn),
  );
}

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
  const { t } = useTranslation();
  const [localHover, setLocalHover] = useState(false);
  const peeked = useSchemaStore((s) => s.peekedEdge);
  const inferredVisible = useSchemaStore((s) => s.inferredVisible);
  const inferredLineage = useSchemaStore((s) => s.inferredLineage);
  const applyDbtOp = useSchemaStore((s) => s.applyDbtOp);
  const inferred = matchInferred(inferredLineage, data?.mapping);
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

  const [path, labelX, labelY] = getBezierPath({
    sourceX: coords.sourceX,
    sourceY: coords.sourceY,
    targetX: coords.targetX,
    targetY: coords.targetY,
    sourcePosition,
    targetPosition,
  });
  const active = !!(selected || data?.highlighted);
  const focused = active || !!data?.emphasized;
  const hovered = localHover || peeked === id || selected;
  const inferredLevel = inferred?.level;
  const strokeWidth =
    inferredLevel === "parsed" || inferredLevel === "name" ? 1 : focused ? 2 : hovered ? 1.5 : 1;
  const dash =
    inferredLevel === "parsed" || inferredLevel === "name" ? "1 3" : focused ? "6 4" : "4 3";

  if (inferred && !inferredVisible) return null;

  const from = data?.mapping ? `${data.mapping.sourceTable}.${data.mapping.sourceColumn}` : "";

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={lineageMarkerUrl(focused)}
        className={cn("edge-path--field-lineage", inferred && "edge-path--field-lineage-inferred")}
        style={{
          strokeWidth,
          strokeDasharray: dash,
          strokeLinecap: "round",
          opacity: inferredLevel === "name" ? 0.6 : undefined,
        }}
        onMouseEnter={() => setLocalHover(true)}
        onMouseLeave={() => setLocalHover(false)}
      />
      {inferred && hovered && data?.mapping ? (
        <EdgeLabelRenderer>
          <div
            data-testid="infer-tooltip"
            className="nodrag nopan pointer-events-auto z-50 rounded-md border border-border bg-popover px-2 py-1.5 text-2xs text-popover-foreground shadow-md"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onMouseEnter={() => setLocalHover(true)}
            onMouseLeave={() => setLocalHover(false)}
          >
            <div className="mb-1 font-medium">
              {inferredLevel === "name" ? "? " : ""}
              {t(`canvas.edges.inferLevel.${inferred.level}`)}
              {inferred.reason ? ` · ${inferred.reason}` : ""}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                data-testid="infer-confirm"
                className="rounded bg-primary px-1.5 py-0.5 text-primary-foreground"
                onClick={() =>
                  applyDbtOp({
                    op: "confirmInferredLineage",
                    targetTable: data.mapping!.targetTable,
                    targetColumn: data.mapping!.targetColumn,
                    from,
                    inferred: inferred.level === "name" ? "name" : "parsed",
                  })
                }
              >
                {t("canvas.edges.inferConfirm")}
              </button>
              <button
                type="button"
                data-testid="infer-dismiss"
                className="rounded bg-muted px-1.5 py-0.5"
                onClick={() =>
                  applyDbtOp({
                    op: "dismissInferredLineage",
                    targetTable: data.mapping!.targetTable,
                    targetColumn: data.mapping!.targetColumn,
                    from,
                  })
                }
              >
                {t("canvas.edges.inferDismiss")}
              </button>
            </div>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
