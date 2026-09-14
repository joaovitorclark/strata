import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import "@/i18n";
import {
  ColumnGlyph,
  columnRowHint,
  resolveGlyphKind,
  type ColumnGlyphFlags,
} from "@/features/canvas/components/columnGlyphs";

afterEach(cleanup);

const PRIORITY: Array<{
  name: string;
  flags: ColumnGlyphFlags;
  kind: ReturnType<typeof resolveGlyphKind>;
  label: string;
}> = [
  { name: "PK", flags: { pk: true, fk: true, notNull: true }, kind: "pk", label: "Chave primária" },
  {
    name: "FK",
    flags: { fk: true, lineage: true, notNull: true },
    kind: "fk",
    label: "Chave estrangeira",
  },
  {
    name: "linhagem",
    flags: { lineage: true, unique: true, notNull: true },
    kind: "lineage",
    label: "Tem linhagem",
  },
  { name: "único", flags: { unique: true, notNull: true }, kind: "unique", label: "Único" },
  { name: "não nulo", flags: { notNull: true }, kind: "notNull", label: "Não nulo" },
  { name: "anulável", flags: {}, kind: "nullable", label: "Anulável" },
];

describe("columnGlyphs", () => {
  it("G1: priority table — 6 cases", () => {
    expect(PRIORITY).toHaveLength(6);
    for (const row of PRIORITY) {
      expect(resolveGlyphKind(row.flags), row.name).toBe(row.kind);
      const { getByLabelText, queryByLabelText } = render(<ColumnGlyph flags={row.flags} />);
      expect(getByLabelText(row.label)).toBeTruthy();
      const others = PRIORITY.filter((p) => p.label !== row.label);
      for (const other of others) {
        expect(
          queryByLabelText(other.label),
          `${row.name} must not show ${other.label}`,
        ).toBeNull();
      }
      cleanup();
    }
  });

  it('G2: FK+notnull → one FK glyph and tooltip contains "not null"', () => {
    const flags: ColumnGlyphFlags = { fk: true, notNull: true };
    expect(resolveGlyphKind(flags)).toBe("fk");
    const { getByLabelText, queryByLabelText } = render(<ColumnGlyph flags={flags} />);
    expect(getByLabelText("Chave estrangeira")).toBeTruthy();
    expect(queryByLabelText("Não nulo")).toBeNull();
    expect(
      columnRowHint({
        type: "bigint",
        flags,
        fkRef: "cliente.id",
      }),
    ).toContain("not null");
  });
});
