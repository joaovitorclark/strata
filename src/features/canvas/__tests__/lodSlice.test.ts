import { beforeEach, describe, expect, it } from "vitest";
import { useSchemaStore } from "@/features/schema/store";

describe("lod slice", () => {
  beforeEach(() => useSchemaStore.setState(useSchemaStore.getInitialState(), true));

  it("pins and unpins a column", () => {
    const s = () => useSchemaStore.getState();
    s().pinColumn("vendas.pedido", "total_brl");
    expect(s().pinnedColumns("vendas.pedido")).toEqual(["total_brl"]);
    s().unpinColumn("vendas.pedido", "total_brl");
    expect(s().pinnedColumns("vendas.pedido")).toEqual([]);
  });

  it("writes Pins {} into dbml and removes the block when empty", () => {
    const s = () => useSchemaStore.getState();
    s().pinColumn("vendas.pedido", "total_brl");
    expect(s().dbml).toMatch(/Pins\s*\{/);
    expect(s().dbml).toContain("vendas.pedido.total_brl");
    s().unpinColumn("vendas.pedido", "total_brl");
    expect(s().dbml).not.toMatch(/Pins\s*\{/);
  });

  it("pins a per-node LOD state that survives zoom", () => {
    useSchemaStore.getState().setNodeLod("vendas.pedido", "full");
    expect(useSchemaStore.getState().nodeLod["vendas.pedido"]).toBe("full");
  });

  it("records which edge is being peeked", () => {
    useSchemaStore.getState().peekEdge("e1");
    expect(useSchemaStore.getState().peekedEdge).toBe("e1");
    useSchemaStore.getState().peekEdge(null);
    expect(useSchemaStore.getState().peekedEdge).toBeNull();
  });
});
