import { describe, expect, it } from "vitest";

import { focusTables, traceField } from "./focusGraph";
import type { ParsedFieldLineage } from "@/features/schema/model/parse";

const chainRefs = [
  { source: "A", target: "B" },
  { source: "B", target: "C" },
  { source: "C", target: "D" },
];

function sorted(ids: Set<string>): string[] {
  return [...ids].sort();
}

describe("focusGraph", () => {
  it("G1: cadeia A→B→C→D com hops 1/2/all e direções up/down/both = 9 casos", () => {
    const cases: Array<{
      hops: 1 | 2 | "all";
      direction: "up" | "down" | "both";
      expected: string[];
    }> = [
      { hops: 1, direction: "up", expected: ["B", "C"] },
      { hops: 1, direction: "down", expected: ["A", "B"] },
      { hops: 1, direction: "both", expected: ["A", "B", "C"] },
      { hops: 2, direction: "up", expected: ["B", "C", "D"] },
      { hops: 2, direction: "down", expected: ["A", "B"] },
      { hops: 2, direction: "both", expected: ["A", "B", "C", "D"] },
      { hops: "all", direction: "up", expected: ["B", "C", "D"] },
      { hops: "all", direction: "down", expected: ["A", "B"] },
      { hops: "all", direction: "both", expected: ["A", "B", "C", "D"] },
    ];
    expect(cases).toHaveLength(9);
    for (const row of cases) {
      expect(
        sorted(
          focusTables({
            seeds: ["B"],
            hops: row.hops,
            direction: row.direction,
            kind: "fk",
            refs: chainRefs,
            lineageFields: [],
          }),
        ),
        `hops=${row.hops} dir=${row.direction}`,
      ).toEqual(row.expected);
    }
  });

  it("R4: both = union of up and down closures, never siblings via a shared parent", () => {
    // A and C both reference B. From A, "up" reaches B; "down" reaches nothing.
    const refs = [
      { source: "A", target: "B" },
      { source: "C", target: "B" },
    ];
    for (const hops of [2, "all"] as const) {
      expect(
        sorted(
          focusTables({ seeds: ["A"], hops, direction: "both", kind: "fk", refs, lineageFields: [] }),
        ),
        `hops=${hops}`,
      ).toEqual(["A", "B"]);
    }
  });

  it("G2: kind fk ignora linhagem e vice-versa", () => {
    const refs = [{ source: "A", target: "B" }];
    const lineageFields: ParsedFieldLineage[] = [
      {
        sourceTable: "A",
        sourceColumn: "x",
        targetTable: "C",
        targetColumn: "y",
      },
    ];
    const base = {
      seeds: ["A"],
      hops: 1 as const,
      direction: "both" as const,
      refs,
      lineageFields,
    };
    expect(sorted(focusTables({ ...base, kind: "fk" }))).toEqual(["A", "B"]);
    expect(sorted(focusTables({ ...base, kind: "lineage" }))).toEqual(["A", "C"]);
  });

  it("G3: traceField em bronze→silver→gold com um ramo lateral → 5 colunas, depths corretos", () => {
    const lineageFields: ParsedFieldLineage[] = [
      {
        sourceTable: "landing.raw",
        sourceColumn: "cust_id",
        targetTable: "bronze.raw",
        targetColumn: "cust_id",
      },
      {
        sourceTable: "bronze.raw",
        sourceColumn: "cust_id",
        targetTable: "silver.cliente",
        targetColumn: "id",
      },
      {
        sourceTable: "bronze.raw",
        sourceColumn: "cust_id",
        targetTable: "silver.aux",
        targetColumn: "cust_id",
      },
      {
        sourceTable: "silver.cliente",
        sourceColumn: "id",
        targetTable: "gold.dim_cliente",
        targetColumn: "cliente_id",
      },
    ];
    const result = traceField({
      table: "bronze.raw",
      column: "cust_id",
      lineageFields,
    });
    expect(result.cycle).toBe(false);
    expect(result.columns).toHaveLength(5);
    const byKey = Object.fromEntries(
      result.columns.map((c) => [`${c.table}.${c.column}`, c.depth]),
    );
    expect(byKey).toEqual({
      "bronze.raw.cust_id": 0,
      "landing.raw.cust_id": -1,
      "silver.cliente.id": 1,
      "silver.aux.cust_id": 1,
      "gold.dim_cliente.cliente_id": 2,
    });
  });

  it("G4: ciclo A.x→B.y→A.x → cycle: true, termina", () => {
    const lineageFields: ParsedFieldLineage[] = [
      { sourceTable: "A", sourceColumn: "x", targetTable: "B", targetColumn: "y" },
      { sourceTable: "B", sourceColumn: "y", targetTable: "A", targetColumn: "x" },
    ];
    const result = traceField({ table: "A", column: "x", lineageFields });
    expect(result.cycle).toBe(true);
    expect(result.columns.length).toBeLessThanOrEqual(2);
    expect(result.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "A", column: "x", depth: 0 }),
        expect.objectContaining({ table: "B", column: "y" }),
      ]),
    );
  });

  it("G5: 200 tabelas / 2000 mapeamentos em < 20ms", () => {
    const refs = Array.from({ length: 199 }, (_, i) => ({
      source: `t${i}`,
      target: `t${i + 1}`,
    }));
    const lineageFields: ParsedFieldLineage[] = Array.from({ length: 2000 }, (_, i) => ({
      sourceTable: `t${i % 200}`,
      sourceColumn: "x",
      targetTable: `t${(i + 1) % 200}`,
      targetColumn: "y",
    }));
    const input = {
      seeds: ["t0"],
      hops: "all" as const,
      direction: "both" as const,
      kind: "both" as const,
      refs,
      lineageFields,
    };
    focusTables(input);
    const samples: number[] = [];
    let lastSize = 0;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const ids = focusTables(input);
      samples.push(performance.now() - t0);
      lastSize = ids.size;
    }
    expect(lastSize).toBeGreaterThan(1);
    expect(Math.min(...samples)).toBeLessThan(20);
  });
});
