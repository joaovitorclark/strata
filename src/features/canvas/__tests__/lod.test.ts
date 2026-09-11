import { describe, expect, it } from "vitest";
import { keyColumns, resolveLod } from "@/features/canvas/utils/lod";

describe("resolveLod", () => {
  it("collapses to a sigil when zoomed out", () => {
    expect(resolveLod(0.4, {})).toBe("sigil");
  });

  it("shows keys at normal zoom", () => {
    expect(resolveLod(1, {})).toBe("keys");
    expect(resolveLod(0.55, {})).toBe("keys");
    expect(resolveLod(1.1, {})).toBe("keys");
  });

  it("opens fully past the threshold", () => {
    expect(resolveLod(1.3, {})).toBe("full");
  });

  it("lets a pinned state override the zoom", () => {
    expect(resolveLod(0.4, { pinned: "full" })).toBe("full");
    expect(resolveLod(1.5, { pinned: "sigil" })).toBe("sigil");
  });

  it("opens the selected node early", () => {
    expect(resolveLod(1, { selected: true })).toBe("full");
  });
});

describe("keyColumns", () => {
  const data = {
    columns: [{ name: "id" }, { name: "cliente_id" }, { name: "total_brl" }, { name: "nota" }],
    meta: { pks: ["id"], fks: [{ column: "cliente_id", ref: "vendas.cliente.id" }] },
  } as never;

  it("keeps primary and foreign keys with no pins", () => {
    expect(keyColumns(data).map((c) => c.name)).toEqual(["id", "cliente_id"]);
  });

  it("adds pinned columns without duplicating keys", () => {
    expect(keyColumns(data, ["total_brl", "id"]).map((c) => c.name)).toEqual([
      "id",
      "cliente_id",
      "total_brl",
    ]);
  });

  it("surfaces every column of a composite primary key", () => {
    const data = {
      columns: [{ name: "dia" }, { name: "regiao" }, { name: "receita_brl" }],
      compositePks: [["dia", "regiao"]],
      meta: { pks: [], fks: [] },
    } as never;
    expect(keyColumns(data).map((c) => c.name)).toEqual(["dia", "regiao"]);
  });
});
