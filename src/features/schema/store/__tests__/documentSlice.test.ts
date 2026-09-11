import { beforeEach, describe, expect, it } from "vitest";
import { useSchemaStore } from "@/features/schema/store";

describe("documentSlice", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  it("hydrates dbml/positions/colors and clears history", () => {
    useSchemaStore.getState().pushHistory({ dbml: "old", positions: {}, colors: {} });
    useSchemaStore.getState().hydrateDocument({
      dbml: "Table a { id int }",
      positions: { a: { x: 1, y: 2 } },
      sizes: { a: { width: 200 } },
      colors: { a: "hsl(var(--primary))" },
      collapsedGroups: ["g"],
      canvasPages: [{ id: "__all__", name: "Todas", tableGroups: ["__all__"] }],
      activePageIds: ["__all__"],
      currentProjectId: "p1",
    });
    const s = useSchemaStore.getState();
    expect(s.dbml).toBe("Table a { id int }");
    expect(s.positions.a).toEqual({ x: 1, y: 2 });
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.currentProjectId).toBe("p1");
  });

  it("hydrates pinnedByTable onto the lod slice and replaces prior pins", () => {
    useSchemaStore.getState().pinColumn("old.t", "x");
    useSchemaStore.getState().hydrateDocument({
      dbml: "Table a { id int }",
      positions: {},
      sizes: {},
      colors: {},
      collapsedGroups: [],
      canvasPages: [{ id: "__all__", name: "Todas", tableGroups: ["__all__"] }],
      activePageIds: ["__all__"],
      pinnedByTable: { "loja.pedido": ["total"] },
    });
    expect(useSchemaStore.getState().pinnedByTable).toEqual({ "loja.pedido": ["total"] });
    expect(useSchemaStore.getState().pinnedColumns("loja.pedido")).toEqual(["total"]);
    expect(useSchemaStore.getState().pinnedColumns("old.t")).toEqual([]);
  });

  it("hydrateDocument without pinnedByTable clears pins", () => {
    useSchemaStore.getState().pinColumn("loja.pedido", "total");
    useSchemaStore.getState().hydrateDocument({
      dbml: "Table a { id int }",
      positions: {},
      sizes: {},
      colors: {},
      collapsedGroups: [],
      canvasPages: [{ id: "__all__", name: "Todas", tableGroups: ["__all__"] }],
      activePageIds: ["__all__"],
    });
    expect(useSchemaStore.getState().pinnedByTable).toEqual({});
  });

  it("undo/redo restores {dbml,positions,colors} snapshots", () => {
    const s = useSchemaStore.getState();
    s.setDbml("A");
    s.pushHistory({ dbml: "A", positions: {}, colors: {} });
    s.setDbml("B");
    s.setPositions({ t: { x: 3, y: 4 } });
    s.undo();
    expect(useSchemaStore.getState().dbml).toBe("A");
    expect(useSchemaStore.getState().positions).toEqual({});
    useSchemaStore.getState().redo();
    expect(useSchemaStore.getState().dbml).toBe("B");
    expect(useSchemaStore.getState().positions.t).toEqual({ x: 3, y: 4 });
  });
});
