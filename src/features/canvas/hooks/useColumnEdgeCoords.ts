import { useMemo } from 'react';
import { useInternalNode, type InternalNode, type Node, type Position } from "@xyflow/react";
import type { TableNodeData } from '../actions';
import {
  columnHandleFlowPoint,
  needsScrollAwareHandles,
  parseFieldLineageColumnHandle,
  parseRelationColumnHandle,
  sidePortFlowPoint,
} from '../utils/columnHandleGeometry';
import { useTableScrollStore } from '../store/tableScrollStore';
import { useCanvasRowH } from './useCanvasDensity';

export type ColumnEdgeCoords = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
};

function resolveEndpoint(
  node: InternalNode<Node<TableNodeData>>,
  column: string,
  side: 'source' | 'target',
  scrollTop: number,
  rowH: number,
) {
  return (
    columnHandleFlowPoint(node, column, side, scrollTop, rowH) ?? sidePortFlowPoint(node, side, rowH)
  );
}

/** Recalcula pontos de aresta coluna↔coluna quando a tabela tem scroll interno. */
export function useColumnEdgeCoords(
  source: string,
  target: string,
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
  mode: 'relation' | 'fieldLineage',
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  _sourcePosition: Position,
  _targetPosition: Position,
): ColumnEdgeCoords {
  void _sourcePosition;
  void _targetPosition;
  const scrollFor = useTableScrollStore((s) => s.byNode);
  const rowH = useCanvasRowH();

  const sourceNode = useInternalNode<Node<TableNodeData>>(source);
  const targetNode = useInternalNode<Node<TableNodeData>>(target);

  return useMemo(() => {
    let sx = sourceX;
    let sy = sourceY;
    let tx = targetX;
    let ty = targetY;
    const parse = mode === 'fieldLineage' ? parseFieldLineageColumnHandle : parseRelationColumnHandle;

    const src = parse(sourceHandle);
    if (src && sourceNode && needsScrollAwareHandles(sourceNode.data)) {
      const pt = resolveEndpoint(sourceNode, src.column, 'source', scrollFor[source] ?? 0, rowH);
      sx = pt.x;
      sy = pt.y;
    }

    const tgt = parse(targetHandle);
    if (tgt && targetNode && needsScrollAwareHandles(targetNode.data)) {
      const pt = resolveEndpoint(targetNode, tgt.column, 'target', scrollFor[target] ?? 0, rowH);
      tx = pt.x;
      ty = pt.y;
    }

    return { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty };
  }, [
    source,
    target,
    sourceHandle,
    targetHandle,
    mode,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceNode,
    targetNode,
    scrollFor,
    rowH,
  ]);
}
