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

  it("S05 hotfix: docs + empty notes → 0 fieldLineage, 1 aggregated", () => {
    const one: ParsedFieldLineage[] = [three[0]];
    const edges = buildLineageCanvasEdges(
      one,
      { "bronze.a": "docs", "silver.b": "docs" },
      {
        ...visible,
        notedColumnsByTable: {
          "bronze.a": new Set(),
          "silver.b": new Set(),
        },
      },
    );
    expect(edges.filter((e) => e.type === "fieldLineage")).toHaveLength(0);
    const agg = edges.filter((e) => e.type === "lineage");
    expect(agg).toHaveLength(1);
    expect((agg[0].data as { count: number }).count).toBe(1);
  });

  it("S05 hotfix: docs mapping whose target has no note aggregates", () => {
    const one: ParsedFieldLineage[] = [three[0]];
    const edges = buildLineageCanvasEdges(
      one,
      { "bronze.a": "docs", "silver.b": "docs" },
      {
        ...visible,
        notedColumnsByTable: {
          "bronze.a": new Set(["x"]),
          "silver.b": new Set(),
        },
      },
    );
    expect(edges.filter((e) => e.type === "fieldLineage")).toHaveLength(0);
    const agg = edges.filter((e) => e.type === "lineage");
    expect(agg).toHaveLength(1);
    expect((agg[0].data as { count: number }).count).toBe(1);
  });

  it("S05 hotfix: docs emits fieldLineage only when both ends are noted", () => {
    const one: ParsedFieldLineage[] = [three[0]];
    const edges = buildLineageCanvasEdges(
      one,
      { "bronze.a": "docs", "silver.b": "docs" },
      {
        ...visible,
        notedColumnsByTable: {
          "bronze.a": new Set(["x"]),
          "silver.b": new Set(["y"]),
        },
      },
    );
    expect(edges.filter((e) => e.type === "fieldLineage")).toHaveLength(1);
    expect(edges.filter((e) => e.type === "lineage")).toHaveLength(0);
  });

  it("S05 hotfix: mixed noted/unnoted mappings → field + aggregated leftover", () => {
    const edges = buildLineageCanvasEdges(
      three.slice(0, 2),
      { "bronze.a": "docs", "silver.b": "docs" },
      {
        ...visible,
        notedColumnsByTable: {
          "bronze.a": new Set(["x", "z"]),
          "silver.b": new Set(["y"]),
        },
      },
    );
    const field = edges.filter((e) => e.type === "fieldLineage");
    const agg = edges.filter((e) => e.type === "lineage");
    expect(field).toHaveLength(1);
    expect(field[0].id).toBe("fl:bronze.a.x->silver.b.y");
    expect(agg).toHaveLength(1);
    expect((agg[0].data as { count: number }).count).toBe(1);
  });
});
