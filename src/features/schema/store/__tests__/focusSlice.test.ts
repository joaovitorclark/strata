import { beforeEach, describe, expect, it } from "vitest";
import { useSchemaStore } from "@/features/schema/store";

describe("focusSlice", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  it("starts with no table or field focus", () => {
    expect(useSchemaStore.getState().focus).toBeNull();
  });

  it("enterTableFocus snapshots seeds at hops 1 both and exitFocus clears", () => {
    useSchemaStore.getState().enterTableFocus(["vendas.pedido", "vendas.cliente"]);
    const on = useSchemaStore.getState().focus;
    expect(on).toEqual({
      kind: "tables",
      seeds: ["vendas.pedido", "vendas.cliente"],
      hops: 1,
      direction: "both",
    });
    expect(useSchemaStore.getState().focusFitToken).toBeGreaterThan(0);

    useSchemaStore.getState().exitFocus();
    expect(useSchemaStore.getState().focus).toBeNull();
  });

  it("setFocusHops and setFocusDirection only apply during table focus", () => {
    useSchemaStore.getState().setFocusHops(2);
    useSchemaStore.getState().setFocusDirection("up");
    expect(useSchemaStore.getState().focus).toBeNull();

    useSchemaStore.getState().enterTableFocus(["A"]);
    const token = useSchemaStore.getState().focusFitToken;
    useSchemaStore.getState().setFocusHops(2);
    useSchemaStore.getState().setFocusDirection("down");
    expect(useSchemaStore.getState().focus).toMatchObject({
      kind: "tables",
      hops: 2,
      direction: "down",
    });
    expect(useSchemaStore.getState().focusFitToken).toBe(token);

    useSchemaStore.getState().enterFieldTrace("bronze.raw", "cust_id");
    useSchemaStore.getState().setFocusHops("all");
    expect(useSchemaStore.getState().focus).toEqual({
      kind: "field",
      table: "bronze.raw",
      column: "cust_id",
    });
  });

  it("exitFocus does not write nodeLod or dbml", () => {
    useSchemaStore.getState().setNodeLod("vendas.pedido", "full");
    useSchemaStore.getState().setDbml("Table t { id int }");
    const dbml = useSchemaStore.getState().dbml;
    const nodeLod = { ...useSchemaStore.getState().nodeLod };

    useSchemaStore.getState().enterFieldTrace("t", "id");
    useSchemaStore.getState().exitFocus();

    expect(useSchemaStore.getState().dbml).toBe(dbml);
    expect(useSchemaStore.getState().nodeLod).toEqual(nodeLod);
  });
});
