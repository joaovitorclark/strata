import type { InternalNode, Node } from "@xyflow/react";
import type { TableNodeData } from '../actions';
import { nodeHeight, nodeWidth } from './nodeMetrics';
import {
  COLUMN_VIRTUAL_ROW_H,
  COLUMN_VIRTUALIZE_THRESHOLD,
  COLUMN_VIRTUAL_VIEW_ROWS,
  columnVirtualViewportPx,
} from './scaleLimits';

/** Alturas fixas alinhadas ao CSS / nodeMetrics. */
export const TABLE_HEADER_H = 34;
export const TABLE_EXTERNAL_BAR_H = 28;
export const TABLE_FOOTER_H = 26;

export const COLUMN_SCROLL_VIEW_H = columnVirtualViewportPx(COLUMN_VIRTUAL_ROW_H);

const PORT_INSET = 8;

export type ColumnAnchorKind = 'row' | 'above' | 'below';

export function needsScrollAwareHandles(data: TableNodeData | undefined): boolean {
  // Guarda `columns`: nós stub (grupos externos agregados) têm data sem columns
  // e não devem crashar o render de arestas ao filtrar por página/grupo.
  return !!data?.columns && data.columns.length > COLUMN_VIRTUALIZE_THRESHOLD;
}

export function columnScrollViewport(data: TableNodeData, rowH = COLUMN_VIRTUAL_ROW_H): { top: number; bottom: number; center: number } {
  const top = TABLE_HEADER_H + (data.externalLinks?.length ? TABLE_EXTERNAL_BAR_H : 0);
  const bottom = top + COLUMN_VIRTUAL_VIEW_ROWS * rowH;
  return { top, bottom, center: top + (bottom - top) / 2 };
}

export function tableBodyHeight(data: TableNodeData, rowH = COLUMN_VIRTUAL_ROW_H): number {
  if (needsScrollAwareHandles(data)) {
    return (
      TABLE_HEADER_H
      + (data.externalLinks?.length ? TABLE_EXTERNAL_BAR_H : 0)
      + COLUMN_VIRTUAL_VIEW_ROWS * rowH
      + TABLE_FOOTER_H
    );
  }
  return nodeHeight(data, { rowH });
}

function clampLocalY(data: TableNodeData, y: number, rowH = COLUMN_VIRTUAL_ROW_H): number {
  const maxY = tableBodyHeight(data, rowH) - TABLE_FOOTER_H - PORT_INSET;
  const minY = TABLE_HEADER_H + (data.externalLinks?.length ? TABLE_EXTERNAL_BAR_H : 0) + PORT_INSET;
  return Math.max(minY, Math.min(maxY, y));
}

/** Y local (relativo ao topo do nó) do ponto de ligação. */
export function columnAnchorY(
  data: TableNodeData,
  columnName: string,
  scrollTop: number,
  rowH = COLUMN_VIRTUAL_ROW_H,
): { y: number; kind: ColumnAnchorKind } | null {
  const idx = data.columns.findIndex((c) => c.name === columnName);
  if (idx < 0) return null;

  const { top, bottom } = columnScrollViewport(data, rowH);

  if (!needsScrollAwareHandles(data)) {
    const y = top + idx * rowH + rowH / 2;
    return { y: clampLocalY(data, y, rowH), kind: 'row' };
  }

  const raw = top + idx * rowH - scrollTop + rowH / 2;
  const minY = top + PORT_INSET;
  const maxY = bottom - PORT_INSET;

  // Coluna acima da área visível: a ligação fica encostada na borda de cima,
  // esperando o usuário rolar para cima. Abaixo: encostada na borda de baixo.
  if (raw < minY) {
    return { y: clampLocalY(data, minY, rowH), kind: 'above' };
  }
  if (raw > maxY) {
    return { y: clampLocalY(data, maxY, rowH), kind: 'below' };
  }
  return { y: clampLocalY(data, raw, rowH), kind: 'row' };
}

export function sidePortFlowPoint(
  node: InternalNode<Node<TableNodeData>>,
  side: 'source' | 'target',
  rowH = COLUMN_VIRTUAL_ROW_H,
): { x: number; y: number; kind: ColumnAnchorKind } {
  const { center } = columnScrollViewport(node.data, rowH);
  const origin = node.internals.positionAbsolute;
  const w = node.measured?.width ?? nodeWidth(node.data) ?? 230;
  const xLocal = side === 'source' ? w : 0;
  const yLocal = clampLocalY(node.data, center, rowH);
  return { x: origin.x + xLocal, y: origin.y + yLocal, kind: 'row' };
}

export function columnHandleFlowPoint(
  node: InternalNode<Node<TableNodeData>>,
  columnName: string,
  side: 'source' | 'target',
  scrollTop: number,
  rowH = COLUMN_VIRTUAL_ROW_H,
): { x: number; y: number; kind: ColumnAnchorKind } | null {
  const anchor = columnAnchorY(node.data, columnName, scrollTop, rowH);
  if (!anchor) return null;

  const origin = node.internals.positionAbsolute;
  const w = node.measured?.width ?? nodeWidth(node.data) ?? 230;
  const xLocal = side === 'source' ? w : 0;
  return { x: origin.x + xLocal, y: origin.y + anchor.y, kind: anchor.kind };
}

export function parseRelationColumnHandle(
  handle: string | null | undefined,
): { side: 'source' | 'target'; column: string } | null {
  if (handle?.startsWith('s:')) return { side: 'source', column: handle.slice(2) };
  if (handle?.startsWith('t:')) return { side: 'target', column: handle.slice(2) };
  return null;
}

export function parseFieldLineageColumnHandle(
  handle: string | null | undefined,
): { side: 'source' | 'target'; column: string } | null {
  if (handle?.startsWith('fl:s:')) return { side: 'source', column: handle.slice(5) };
  if (handle?.startsWith('fl:t:')) return { side: 'target', column: handle.slice(5) };
  return null;
}
