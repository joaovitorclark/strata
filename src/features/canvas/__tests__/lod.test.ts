import { describe, expect, it } from "vitest";
import {
  DOCS_NOTE_BLOCK_H,
  keyColumns,
  lodHeight,
  resolveLod,
  SIGIL_H,
  type DetailLevel,
  type LodState,
} from "@/features/canvas/utils/lod";
import {
  COLUMN_VIRTUAL_ROW_H,
  columnVirtualViewportCss,
  columnVirtualViewportPx,
} from "@/features/canvas/utils/scaleLimits";
import { TABLE_FOOTER_H, TABLE_HEADER_H } from "@/features/canvas/utils/columnHandleGeometry";

const LEVELS: readonly DetailLevel[] = ["name", "keys", "columns", "docs"];
const FROM_LEVEL: Record<DetailLevel, LodState> = {
  name: "sigil",
  keys: "keys",
  columns: "full",
  docs: "docs",
};

describe("resolveLod", () => {
  it("G1: 4 levels × {selected, pinned, none} = 12 cases", () => {
    const cases: Array<{
      name: string;
      opts: { level: DetailLevel; selected?: boolean; pinned?: LodState };
      expected: LodState;
    }> = LEVELS.flatMap((level) => [
      { name: `${level}/none`, opts: { level }, expected: FROM_LEVEL[level] },
      {
        name: `${level}/selected`,
        opts: { level, selected: true },
        expected: level === "name" || level === "keys" ? "full" : FROM_LEVEL[level],
      },
      {
        name: `${level}/pinned`,
        opts: { level, selected: true, pinned: "sigil" },
        expected: "sigil" as const,
      },
    ]);
    expect(cases).toHaveLength(12);
    for (const row of cases) {
      expect(resolveLod(1, row.opts).state, row.name).toBe(row.expected);
    }
  });

  it("G2: simplified true only below 0.35, independent of level", () => {
    for (const level of LEVELS) {
      expect(resolveLod(0.34, { level }).simplified, `${level} 0.34`).toBe(true);
      expect(resolveLod(0.35, { level }).simplified, `${level} 0.35`).toBe(false);
      expect(resolveLod(1, { level }).simplified, `${level} 1`).toBe(false);
      expect(resolveLod(0.2, { level, selected: true }).simplified, `${level} selected`).toBe(true);
      expect(resolveLod(0.2, { level, pinned: "full" }).simplified, `${level} pinned`).toBe(true);
    }
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

  it("G3: keyColumns includes a lineage column", () => {
    expect(keyColumns(data, [], ["nota"]).map((c) => c.name)).toEqual([
      "id",
      "cliente_id",
      "nota",
    ]);
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

  it('G4: lodHeight("docs") for a table with 3 notes', () => {
    const documented = {
      columns: [
        { name: "id", note: "pk" },
        { name: "cliente_id" },
        { name: "total_brl", note: "money" },
        { name: "nota", note: "comment" },
      ],
      meta: { pks: ["id"], fks: [] },
    } as never;
    const noted = 3;
    const expected =
      TABLE_HEADER_H + noted * (COLUMN_VIRTUAL_ROW_H + DOCS_NOTE_BLOCK_H) + TABLE_FOOTER_H;
    expect(lodHeight(documented, "docs")).toBe(expected);
    expect(lodHeight(documented, "docs")).toBe(34 + 3 * (25 + 22) + 26);
  });
});
