import { describe, expect, it } from "vitest";

import {
  borderX,
  fanY,
  nearestRelationSides,
} from "@/features/canvas/utils/relationEndpoints";

describe("S09 relation endpoints", () => {
  it("picks the facing sides when tables sit side by side", () => {
    const left = { x: 0, w: 230 };
    const right = { x: 400, w: 230 };
    expect(nearestRelationSides(left, right)).toEqual({
      sourceSide: "right",
      targetSide: "left",
      offset: 12,
    });
    expect(nearestRelationSides(right, left)).toEqual({
      sourceSide: "left",
      targetSide: "right",
      offset: 12,
    });
  });

  it("uses the same side and 24px offset when tables stack in one column", () => {
    expect(nearestRelationSides({ x: 0, w: 230 }, { x: 10, w: 230 })).toEqual({
      sourceSide: "right",
      targetSide: "right",
      offset: 24,
    });
  });

  it("places the tip on the node border and fans 4px", () => {
    expect(borderX(100, 230, "left")).toBe(100);
    expect(borderX(100, 230, "right")).toBe(330);
    expect(fanY(0, 1)).toBe(0);
    expect(fanY(0, 3)).toBe(-4);
    expect(fanY(1, 3)).toBe(0);
    expect(fanY(2, 3)).toBe(4);
  });
});
