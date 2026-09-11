import { beforeEach, describe, expect, it } from "vitest";
import { useSchemaStore } from "@/features/schema/store";

describe("schema interaction store", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  it("starts with no column selected", () => {
    expect(useSchemaStore.getState().selectedColumn).toBeNull();
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
});
