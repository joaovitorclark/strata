import { describe, expect, it } from "vitest";

import { parseDbml } from "@/features/schema/model/parse";
import { detectPasteFormat, pasteToDbml } from "../pasteSource";

describe("S12 paste format detection", () => {
  it("detects DBML when the text contains Table x {", () => {
    expect(detectPasteFormat("Table sales.orders {\n  id int [pk]\n}\n")).toBe("dbml");
  });

  it("detects SQL CREATE TABLE", () => {
    expect(detectPasteFormat("CREATE TABLE sales.orders (id INT PRIMARY KEY);")).toBe("sql");
  });

  it("detects Rails create_table and leaves unknown text unknown", () => {
    expect(detectPasteFormat('create_table "orders" do |t|\n  t.integer :id\nend')).toBe("rails");
    expect(detectPasteFormat("lorem ipsum dolor")).toBe("unknown");
  });
});

describe("S12 pasteToDbml uses existing importers", () => {
  it("returns pasted DBML when parse finds tables", () => {
    const dbml = "Table foo {\n  id int [pk]\n}\n\nTable bar {\n  id int [pk]\n}\n";
    const result = pasteToDbml(dbml);
    expect(result).toEqual({ ok: true, dbml });
  });

  it("converts SQL CREATE TABLE through @dbml/core (not a new importer)", () => {
    const result = pasteToDbml(
      "CREATE TABLE analytics.events (id INT PRIMARY KEY, name VARCHAR(100));",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = parseDbml(result.dbml);
    expect(parsed.error).toBeUndefined();
    expect(parsed.tables.some((t) => t.name === "events")).toBe(true);
  });

  it("rejects Rails (no importer) and invalid text without throwing", () => {
    expect(pasteToDbml('create_table "orders" do |t|\nend')).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(pasteToDbml("this is not a schema")).toEqual({ ok: false, reason: "invalid" });
    expect(pasteToDbml("   ")).toEqual({ ok: false, reason: "empty" });
  });
});
