import { describe, expect, it } from "vitest";
import { keyColumns, lodHeight, resolveLod, SIGIL_H } from "@/features/canvas/utils/lod";
import {
  COLUMN_VIRTUAL_ROW_H,
  columnVirtualViewportCss,
  columnVirtualViewportPx,
} from "@/features/canvas/utils/scaleLimits";

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

describe("lodHeight", () => {
  const data = {
    columns: [{ name: "id" }, { name: "cliente_id" }, { name: "total_brl" }, { name: "nota" }],
    meta: { pks: ["id"], fks: [{ column: "cliente_id", ref: "vendas.cliente.id" }] },
  } as never;

  it("uses compact row height 21 instead of cozy 25", () => {
    const cozy = lodHeight(data, "full");
    const compact = lodHeight(data, "full", [], 21);
    expect(cozy).not.toBe(compact);
    expect(cozy).toBe(lodHeight(data, "full", [], COLUMN_VIRTUAL_ROW_H));
    expect(cozy - compact).toBe(4 * (25 - 21));
  });

  it("applies the same row height in keys state", () => {
    expect(lodHeight(data, "keys", [], 21)).not.toBe(lodHeight(data, "keys", [], 25));
  });

  it("keeps sigil height independent of row density", () => {
    expect(lodHeight(data, "sigil", [], 21)).toBe(SIGIL_H);
    expect(lodHeight(data, "sigil", [], 25)).toBe(SIGIL_H);
  });

  it("columnVirtualViewportPx is 14×rowH and the CSS uses --row-h", () => {
    expect(columnVirtualViewportPx(25)).toBe(350);
    expect(columnVirtualViewportPx(21)).toBe(294);
    expect(columnVirtualViewportCss()).toBe("calc(var(--row-h) * 14)");
  });

  it("full virtualised height is header + 14×rowH + footer (Task 43)", () => {
    const wide = {
      columns: Array.from({ length: 187 }, (_, i) => ({ name: `c${i}` })),
      meta: { pks: ["c0"], fks: [] },
    } as never;
    expect(lodHeight(wide, "full")).toBe(34 + 14 * 25 + 26);
    expect(lodHeight(wide, "full")).toBe(410);
    expect(lodHeight(wide, "full", [], 21)).toBe(34 + 14 * 21 + 26);
    expect(lodHeight(wide, "full", [], 21)).toBe(354);
  });

  it("keys with a +N more row is header + (keys+1)×rowH + footer", () => {
    const hub = {
      columns: [{ name: "id" }, ...Array.from({ length: 186 }, (_, i) => ({ name: `c${i}` }))],
      meta: { pks: ["id"], fks: [] },
    } as never;
    expect(lodHeight(hub, "keys")).toBe(34 + 2 * 25 + 26);
    expect(lodHeight(hub, "keys")).toBe(110);
    expect(lodHeight(hub, "keys", [], 21)).toBe(34 + 2 * 21 + 26);
    expect(lodHeight(hub, "keys", [], 21)).toBe(102);
  });
});
