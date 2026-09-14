import { describe, expect, it } from "vitest";
import { buildLineageCanvasEdges } from "@/features/canvas/hooks/useCanvasEdges";
import type { ParsedFieldLineage } from "@/features/schema/model/parse";

const three: ParsedFieldLineage[] = [
  { sourceTable: "bronze.a", sourceColumn: "x", targetTable: "silver.b", targetColumn: "y" },
  { sourceTable: "bronze.a", sourceColumn: "z", targetTable: "silver.b", targetColumn: "w" },
  { sourceTable: "bronze.a", sourceColumn: "q", targetTable: "silver.b", targetColumn: "v" },
];

const visible = {
  lineageVisible: true,
  lineageMode: true,
  focusTables: [] as string[],
  focusedFieldMapping: null,
  selectedColumn: null,
  onRemoveFieldLineage: () => {},
};

describe("S01 edge builder", () => {
  it("G7: both full → 3 fieldLineage edges, 0 aggregated", () => {
    const edges = buildLineageCanvasEdges(
      three,
      { "bronze.a": "full", "silver.b": "full" },
      visible,
    );
    const field = edges.filter((e) => e.type === "fieldLineage");
    expect(field).toHaveLength(3);
    expect(field.every((e) => e.sourceHandle?.startsWith("fl:s:"))).toBe(true);
    expect(edges.filter((e) => e.type === "lineage")).toHaveLength(0);
  });

  it("G8: keys/full (non-sigil) emit per-field edges", () => {
    const edges = buildLineageCanvasEdges(
      three,
      { "bronze.a": "full", "silver.b": "keys" },
      visible,
    );
    const field = edges.filter((e) => e.type === "fieldLineage");
    expect(field).toHaveLength(3);
    expect(edges.filter((e) => e.type === "lineage")).toHaveLength(0);
  });

  it("G9: one side sigil → 0 field edges, 1 aggregated with count 3", () => {
    const edges = buildLineageCanvasEdges(
      three,
      { "bronze.a": "sigil", "silver.b": "full" },
      visible,
    );
    expect(edges.filter((e) => e.type === "fieldLineage")).toHaveLength(0);
    const agg = edges.filter((e) => e.type === "lineage");
    expect(agg).toHaveLength(1);
    expect((agg[0].data as { count: number }).count).toBe(3);
  });
});
