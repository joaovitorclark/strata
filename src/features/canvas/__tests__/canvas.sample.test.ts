import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDbml } from "@/features/schema/model/parse";
import { edgeTypes, nodeTypes } from "@/features/canvas";

const sample = readFileSync(join(process.cwd(), "fixtures/golden/sample.dbml"), "utf8");

describe("sample.dbml canvas shell", () => {
  const parsed = parseDbml(sample);

  it("parses two tables, one Ref, and field lineage", () => {
    expect(parsed.tables.map((t) => t.id)).toEqual(["loja.cliente", "loja.pedido"]);
    expect(parsed.refs).toHaveLength(1);
    expect(parsed.refs[0]).toMatchObject({
      source: "loja.pedido",
      fromCol: "cliente_id",
      target: "loja.cliente",
      toCol: "id",
    });
    expect(parsed.lineageFields).toHaveLength(1);
    expect(parsed.lineageFields[0]).toMatchObject({
      sourceTable: "loja.cliente",
      sourceColumn: "id",
      targetTable: "loja.pedido",
      targetColumn: "cliente_id",
    });
  });

  it("registers module-level nodeTypes and edgeTypes", () => {
    expect(Object.keys(nodeTypes).sort()).toEqual(["externalGroup", "group", "table"]);
    expect(Object.keys(edgeTypes).sort()).toEqual(["fieldLineage", "lineage", "relation"]);
  });

  // Full ReactFlow mount hung in jsdom (no measured layout). 1px handle geometry vs
  // columnHandleGeometry is deferred for the same reason.
});
