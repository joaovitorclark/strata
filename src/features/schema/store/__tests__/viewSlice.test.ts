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

  it("setActiveView hides tables outside the named view", () => {
    useSchemaStore.getState().setDbml(`Table vendas.cliente {
  id int
}
Table vendas.pedido {
  id int
}
Views {
  view_1 {
    tables: vendas.pedido
  }
}
`);
    useSchemaStore.getState().setActiveView("view_1");
    expect(useSchemaStore.getState().activeViewId).toBe("view_1");
    expect(useSchemaStore.getState().hiddenTableIds).toEqual(["vendas.cliente"]);
    useSchemaStore.getState().setActiveView("tudo");
    expect(useSchemaStore.getState().activeViewId).toBe("tudo");
    expect(useSchemaStore.getState().hiddenTableIds).toEqual([]);
  });
});
