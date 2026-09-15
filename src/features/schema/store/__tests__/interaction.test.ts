import { beforeEach, describe, expect, it } from "vitest";
import { useSchemaStore } from "@/features/schema/store";

describe("schema interaction store", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  it("selectFieldLineageMapping focuses the mapping without RF-selecting the table", () => {
    useSchemaStore.getState().selectFieldLineageMapping({
      sourceTable: "vendas.pedido",
      sourceColumn: "id",
      targetTable: "vendas.resumo",
      targetColumn: "id",
    });
    const s = useSchemaStore.getState();
    expect(s.selectedTable).toBe("vendas.resumo");
    expect(s.selectedTableIds).toEqual([]);
    expect(s.selectedColumn).toEqual({ table: "vendas.resumo", column: "id" });
    expect(s.focusedFieldMapping).toMatchObject({
      targetTable: "vendas.resumo",
      targetColumn: "id",
    });
  });

  it("starts with no column selected", () => {
    expect(useSchemaStore.getState().selectedColumn).toBeNull();
  });

  it("records and clears the selected relation endpoints", () => {
    const ref = {
      fromTbl: "vendas.pedido",
      fromCol: "cliente_id",
      toTbl: "vendas.cliente",
      toCol: "id",
    };
    useSchemaStore.getState().setSelectedRef(ref);
    expect(useSchemaStore.getState().selectedRef).toEqual(ref);
    useSchemaStore.getState().clearCanvasSelection();
    expect(useSchemaStore.getState().selectedRef).toBeNull();
  });

  it("selects and clears a column immutably", () => {
    const before = useSchemaStore.getState();
    useSchemaStore.getState().selectColumn({ table: "loja.pedido", column: "id" });
    const after = useSchemaStore.getState();

    expect(after.selectedColumn).toEqual({ table: "loja.pedido", column: "id" });
    expect(after).not.toBe(before);

    useSchemaStore.getState().selectColumn(null);
    expect(useSchemaStore.getState().selectedColumn).toBeNull();
  });

  it("toggles a hidden layer immutably via Set", () => {
    const initial = useSchemaStore.getState().hiddenLayers;
    expect(initial.size).toBe(0);

    useSchemaStore.getState().toggleLayer("bronze");
    const once = useSchemaStore.getState().hiddenLayers;
    expect([...once]).toEqual(["bronze"]);
    expect(once).not.toBe(initial);

    useSchemaStore.getState().toggleLayer("bronze");
    const twice = useSchemaStore.getState().hiddenLayers;
    expect(twice.size).toBe(0);
    expect(twice.has("bronze")).toBe(false);
    expect(twice).not.toBe(once);
  });

  it("defaults detailLevel to keys and persists setDetailLevel", () => {
    localStorage.removeItem("strata.detailLevel");
    expect(useSchemaStore.getState().detailLevel).toBe("keys");
    useSchemaStore.getState().setDetailLevel("columns");
    expect(useSchemaStore.getState().detailLevel).toBe("columns");
    expect(localStorage.getItem("strata.detailLevel")).toBe("columns");
  });
});
