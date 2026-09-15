import { describe, expect, it } from "vitest";
import { tableLineageFrom } from "@/features/schema/model/lineage";
import { parseDbml } from "@/features/schema/model/parse";

describe("S01 field-lineage-only", () => {
  it("G1: tableLineageFrom empty", () => {
    expect(tableLineageFrom([])).toEqual([]);
  });

  it("G2: tableLineageFrom one mapping", () => {
    expect(
      tableLineageFrom([
        { sourceTable: "bronze.a", sourceColumn: "x", targetTable: "silver.b", targetColumn: "y" },
      ]),
    ).toEqual([{ target: "silver.b", sources: ["bronze.a"] }]);
  });

  it("G3: tableLineageFrom several mappings same pair collapse to one source", () => {
    expect(
      tableLineageFrom([
        { sourceTable: "bronze.a", sourceColumn: "x", targetTable: "silver.b", targetColumn: "y" },
        { sourceTable: "bronze.a", sourceColumn: "z", targetTable: "silver.b", targetColumn: "w" },
      ]),
    ).toEqual([{ target: "silver.b", sources: ["bronze.a"] }]);
  });

  it("G4: tableLineageFrom several sources for one target", () => {
    const out = tableLineageFrom([
      { sourceTable: "bronze.a", sourceColumn: "x", targetTable: "silver.b", targetColumn: "y" },
      { sourceTable: "bronze.c", sourceColumn: "z", targetTable: "silver.b", targetColumn: "w" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].target).toBe("silver.b");
    expect(out[0].sources.sort()).toEqual(["bronze.a", "bronze.c"]);
  });

  it("G5: tableLineageFrom self-mapping excluded", () => {
    expect(
      tableLineageFrom([
        { sourceTable: "silver.b", sourceColumn: "x", targetTable: "silver.b", targetColumn: "y" },
        { sourceTable: "bronze.a", sourceColumn: "x", targetTable: "silver.b", targetColumn: "z" },
      ]),
    ).toEqual([{ target: "silver.b", sources: ["bronze.a"] }]);
  });

  it("G6: parser drops Lineage {} and still parses", () => {
    const parsed = parseDbml(`
Table bronze.a {
  id bigint [pk]
  x string
}
Table silver.b {
  id bigint [pk]
  y string
}

Lineage {
  silver.b < bronze.a
}

LineageFields {
  silver.b.y < bronze.a.x
}
`);
    expect(parsed.error).toBeUndefined();
    expect(parsed.tables.map((t) => t.id).sort()).toEqual(["bronze.a", "silver.b"]);
    expect("lineage" in parsed).toBe(false);
    expect(parsed.lineageFields).toHaveLength(1);
    expect(parsed.lineageFields[0]).toMatchObject({
      sourceTable: "bronze.a",
      sourceColumn: "x",
      targetTable: "silver.b",
      targetColumn: "y",
    });
  });
});
