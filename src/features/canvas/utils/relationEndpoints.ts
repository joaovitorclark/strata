export type Side = "left" | "right";

export type RelationSides = {
  sourceSide: Side;
  targetSide: Side;
  offset: number;
};

/** Facing borders, or the same side + 24px when tables share a layout column. */
export function nearestRelationSides(
  src: { x: number; w: number },
  tgt: { x: number; w: number },
): RelationSides {
  const overlap = Math.min(src.x + src.w, tgt.x + tgt.w) - Math.max(src.x, tgt.x);
  const stacked = overlap > Math.min(src.w, tgt.w) * 0.5;
  if (stacked) {
    return { sourceSide: "right", targetSide: "right", offset: 24 };
  }
  if (tgt.x + tgt.w / 2 >= src.x + src.w / 2) {
    return { sourceSide: "right", targetSide: "left", offset: 12 };
  }
  return { sourceSide: "left", targetSide: "right", offset: 12 };
}

export function borderX(originX: number, width: number, side: Side): number {
  return side === "right" ? originX + width : originX;
}

export function fanY(index: number, count: number, spacing = 4): number {
  if (count <= 1) return 0;
  return (index - (count - 1) / 2) * spacing;
}

export function sharingFan(
  ids: string[],
  selfId: string,
  spacing = 4,
): number {
  const index = ids.indexOf(selfId);
  return fanY(index < 0 ? 0 : index, ids.length, spacing);
}
