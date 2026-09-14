import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { SchemaTree, type SchemaTreeTable } from "@/features/shell/SchemaTree";
import { useSchemaStore } from "@/features/schema/store";

function table(
  partial: Partial<SchemaTreeTable> & Pick<SchemaTreeTable, "id" | "name">,
): SchemaTreeTable {
  return { columnCount: 1, ...partial };
}

describe("SchemaTree", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  afterEach(cleanup);

  it("groups tables by schema in a monospace list", () => {
    render(
      <SchemaTree
        tables={[
          table({ id: "gold.fato", name: "fato", schema: "gold", columnCount: 10 }),
          table({ id: "loja.pedido", name: "pedido", schema: "loja", columnCount: 4 }),
          table({ id: "loja.cliente", name: "cliente", schema: "loja", columnCount: 2 }),
        ]}
      />,
    );

    const text = screen.getByRole("navigation").textContent ?? "";
    expect(text.indexOf("gold")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("loja")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("gold")).toBeLessThan(text.indexOf("fato"));
    expect(text.indexOf("loja")).toBeLessThan(text.indexOf("cliente"));
    expect(text.indexOf("cliente")).toBeLessThan(text.indexOf("pedido"));

    const names = screen
      .getByRole("button", { name: "loja.pedido" })
      .querySelectorAll(".font-mono");
    expect(names.length).toBeGreaterThan(0);
  });

  it("shows a right-aligned tabular-nums column count", () => {
    render(
      <SchemaTree
        tables={[table({ id: "loja.pedido", name: "pedido", schema: "loja", columnCount: 187 })]}
      />,
    );

    const count = screen
      .getByRole("button", { name: "loja.pedido" })
      .querySelector(".tabular-nums");
    expect(count?.textContent).toBe("187");
    expect(count?.classList.contains("tabular-nums")).toBe(true);
    expect(count?.className).toMatch(/ml-auto|shrink-0/);
  });

  it("paints a layer-coloured edge per table row", () => {
    render(
      <SchemaTree
        tables={[
          table({ id: "loja.pedido", name: "pedido", schema: "loja", layerId: "bronze" }),
          table({ id: "gold.fato", name: "fato", schema: "gold", layerId: "ouro" }),
        ]}
        layerOf={(id) => (id === "gold.fato" ? "gold" : undefined)}
      />,
    );

    const pedido = screen.getByRole("button", { name: "loja.pedido" });
    const fato = screen.getByRole("button", { name: "gold.fato" });
    expect(pedido.querySelector(".bg-layer-bronze")).not.toBeNull();
    expect(fato.querySelector(".bg-layer-gold")).not.toBeNull();
  });

  it("fills the selected row with sidebar-accent and a primary left border", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    render(<SchemaTree tables={[table({ id: "loja.pedido", name: "pedido", schema: "loja" })]} />);

    const row = screen.getByRole("button", { name: "loja.pedido" });
    expect(row.classList.contains("bg-sidebar-accent")).toBe(true);
    expect(row.className).toMatch(/border-l-primary|bg-primary/);
  });

  it("selecting a row calls useSchemaStore.selectTable", () => {
    render(
      <SchemaTree
        tables={[
          table({ id: "loja.pedido", name: "pedido", schema: "loja" }),
          table({ id: "loja.cliente", name: "cliente", schema: "loja" }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "loja.cliente" }));
    expect(useSchemaStore.getState().selectedTable).toBe("loja.cliente");
    expect(useSchemaStore.getState().selectedTableIds).toEqual(["loja.cliente"]);
    expect(useSchemaStore.getState().selectedColumn).toBeNull();
  });

  it("renders 500 tables without throwing and only mounts a virtual window", () => {
    const tables: SchemaTreeTable[] = Array.from({ length: 500 }, (_, i) =>
      table({ id: `s.t${i}`, name: `t${i}`, schema: "s", columnCount: 3 }),
    );

    expect(() => render(<SchemaTree tables={tables} />)).not.toThrow();

    expect(screen.getByRole("button", { name: "s.t0" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "s.t499" })).toBeNull();
    expect(screen.getAllByRole("button").length).toBeLessThan(50);
  });

  it("G7: Enter calls onFocusTable; Space calls toggle", () => {
    const onFocusTable = vi.fn();
    render(
      <SchemaTree
        tables={[table({ id: "loja.pedido", name: "pedido", schema: "loja" })]}
        onFocusTable={onFocusTable}
      />,
    );

    const row = screen.getByRole("button", { name: "loja.pedido" });
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onFocusTable).toHaveBeenCalledWith("loja.pedido");

    fireEvent.keyDown(row, { key: " " });
    expect(useSchemaStore.getState().hiddenTableIds).toEqual(["loja.pedido"]);
  });
});
