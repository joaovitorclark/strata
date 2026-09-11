import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import {
  diagramOverviewBounds,
  tableFocusBounds,
} from "@/features/canvas/utils/focusTableView";

/** v12 shape: measured after layout, no declared width/height. */
function measuredNode(id: string, x: number, y: number, w: number, h: number): Node {
  return {
    id,
    type: "table",
    position: { x, y },
    measured: { width: w, height: h },
    data: {},
  };
}

describe("focusTableView v12 measured nodes", () => {
  it("limita altura ao focar tabela alta (measured only)", () => {
    const bounds = tableFocusBounds(measuredNode("t", 10, 20, 240, 6000));
    expect(bounds).toEqual({ x: 10, y: 20, width: 240, height: 420 });
  });

  it("overview ignora cauda longa de colunas (measured only)", () => {
    const bounds = diagramOverviewBounds([
      measuredNode("a", 0, 0, 200, 5000),
      measuredNode("b", 300, 0, 200, 180),
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 500, height: 420 });
  });
});
