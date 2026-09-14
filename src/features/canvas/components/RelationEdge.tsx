import { useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useInternalNode,
  useStore,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useColumnEdgeCoords } from "@/features/canvas/hooks/useColumnEdgeCoords";
import { useCanvasRowH } from "@/features/canvas/hooks/useCanvasDensity";
import { useNotation } from "@/features/canvas/hooks/useNotation";
import { useTableScrollStore } from "@/features/canvas/store/tableScrollStore";
import type { TableNodeData } from "@/features/canvas/actions";
import {
  columnHandleFlowPoint,
  parseRelationColumnHandle,
  type ColumnAnchorKind,
} from "@/features/canvas/utils/columnHandleGeometry";
import { nodeWidth } from "@/features/canvas/utils/nodeMetrics";
import {
  continueMarkerUrl,
  relationMarkerUrl,
  type MarkerState,
} from "@/features/canvas/utils/notation";
import {
  borderX,
  nearestRelationSides,
  sharingFan,
  type Side,
} from "@/features/canvas/utils/relationEndpoints";
import type { Cardinality } from "@/features/schema/model/parse";
import { useSchemaStore } from "@/features/schema/store";

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

function sideToPosition(side: Side): Position {
  return side === "right" ? Position.Right : Position.Left;
}

function columnNullable(
  node: InternalNode<Node<TableNodeData>> | undefined,
  column: string | undefined,
): boolean {
  if (!node || !column) return false;
  const col = node.data.columns?.find((c) => c.name === column);
  if (!col) return false;
  return !col.notNull && !col.pk;
}

function sharingIds(
  edges: Edge[],
  nodeId: string,
  column: string,
  end: "source" | "target",
): string[] {
  return edges
    .filter((e) => {
      if (e.type !== "relation") return false;
      if (end === "source") {
        return e.source === nodeId && parseRelationColumnHandle(e.sourceHandle)?.column === column;
      }
      return e.target === nodeId && parseRelationColumnHandle(e.targetHandle)?.column === column;
    })
    .map((e) => e.id);
}

export function RelationEdge({
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
  data,
  selected,
}: EdgeProps<RelationFlowEdge>) {
  const { t } = useTranslation();
  const [notation] = useNotation();
  const [localHover, setLocalHover] = useState(false);
  const peeked = useSchemaStore((s) => s.peekedEdge);
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

  const sourceNode = useInternalNode<Node<TableNodeData>>(source);
  const targetNode = useInternalNode<Node<TableNodeData>>(target);
  const rowH = useCanvasRowH();
  const scrollFor = useTableScrollStore((s) => s.byNode);
  const edges = useStore((s) => s.edges);

  const srcCol = parseRelationColumnHandle(sourceHandleId);
  const tgtCol = parseRelationColumnHandle(targetHandleId);
  const srcFlow =
    sourceNode && srcCol
      ? columnHandleFlowPoint(sourceNode, srcCol.column, "source", scrollFor[source] ?? 0, rowH)
      : null;
  const tgtFlow =
    targetNode && tgtCol
      ? columnHandleFlowPoint(targetNode, tgtCol.column, "target", scrollFor[target] ?? 0, rowH)
      : null;

  let sx = srcFlow?.x ?? coords.sourceX;
  let sy = srcFlow?.y ?? coords.sourceY;
  let tx = tgtFlow?.x ?? coords.targetX;
  let ty = tgtFlow?.y ?? coords.targetY;
  let srcPos = sourcePosition;
  let tgtPos = targetPosition;
  let offset = 12;
  const srcKind: ColumnAnchorKind = srcFlow?.kind ?? "row";
  const tgtKind: ColumnAnchorKind = tgtFlow?.kind ?? "row";

  if (sourceNode && targetNode) {
    const sw = sourceNode.measured?.width ?? nodeWidth(sourceNode.data) ?? 230;
    const tw = targetNode.measured?.width ?? nodeWidth(targetNode.data) ?? 230;
    const sides = nearestRelationSides(
      { x: sourceNode.internals.positionAbsolute.x, w: sw },
      { x: targetNode.internals.positionAbsolute.x, w: tw },
    );
    sx = borderX(sourceNode.internals.positionAbsolute.x, sw, sides.sourceSide);
    tx = borderX(targetNode.internals.positionAbsolute.x, tw, sides.targetSide);
    srcPos = sideToPosition(sides.sourceSide);
    tgtPos = sideToPosition(sides.targetSide);
    offset = sides.offset;
  }

  if (srcCol) {
    sy += sharingFan(sharingIds(edges, source, srcCol.column, "source"), id);
  }
  if (tgtCol) {
    ty += sharingFan(sharingIds(edges, target, tgtCol.column, "target"), id);
  }

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: srcPos,
    targetPosition: tgtPos,
    borderRadius: 8,
    offset,
  });

  const active = !!(selected || data?.highlighted);
  const emphasis = !!(selected || data?.emphasized);
  const external = !!data?.externalSummary;
  const focused = active || emphasis;
  const hovered = localHover || peeked === id;
  const markerState: MarkerState = focused ? "active" : hovered ? "hover" : "rest";

  const srcNullable = columnNullable(sourceNode, srcCol?.column);
  const tgtNullable = columnNullable(targetNode, tgtCol?.column);
  const barkerOptional = notation === "barker" && (srcNullable || tgtNullable);

  const strokeWidth = external ? 1.5 : focused ? 2 : hovered ? 1.5 : 1;

  const fromLabel = srcCol?.column ?? "";
  const toLabel = tgtCol?.column ?? "";
  const showLabel = !external && (hovered || selected) && !(selected && data?.onRemove);

  return (
    <>
      <BaseEdge
        path={path}
        markerStart={
          srcKind === "row"
            ? relationMarkerUrl(notation, data?.fromRel ?? "*", srcNullable, markerState)
            : continueMarkerUrl(markerState)
        }
        markerEnd={
          tgtKind === "row"
            ? relationMarkerUrl(notation, data?.toRel ?? "1", tgtNullable, markerState)
            : continueMarkerUrl(markerState)
        }
        className={hovered ? "edge-path--fk is-hovered" : "edge-path--fk"}
        style={{
          strokeWidth,
          strokeDasharray: external || barkerOptional ? "5 4" : undefined,
        }}
        onMouseEnter={() => setLocalHover(true)}
        onMouseLeave={() => setLocalHover(false)}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            data-testid="edge-fk-label"
            className="edge-fk-label nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {t("canvas.edges.fkLabel", { from: fromLabel, to: toLabel })}
          </div>
        </EdgeLabelRenderer>
      )}
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
