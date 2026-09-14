import { beforeEach, describe, expect, it } from "vitest";
import { useSchemaStore } from "@/features/schema/store";

describe("viewSlice", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  it("G6: toggle, setHidden, showAll", () => {
    expect(useSchemaStore.getState().hiddenTableIds).toEqual([]);

    useSchemaStore.getState().toggleTableHidden("vendas.pedido");
    expect(useSchemaStore.getState().hiddenTableIds).toEqual(["vendas.pedido"]);

    useSchemaStore.getState().toggleTableHidden("vendas.pedido");
    expect(useSchemaStore.getState().hiddenTableIds).toEqual([]);

    useSchemaStore.getState().setHiddenTables(["vendas.pedido", "vendas.item"]);
    expect(useSchemaStore.getState().hiddenTableIds).toEqual(["vendas.pedido", "vendas.item"]);

    useSchemaStore.getState().showAllTables();
    expect(useSchemaStore.getState().hiddenTableIds).toEqual([]);
  });
});
