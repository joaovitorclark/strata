import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { AppShell } from "@/features/shell/AppShell";
import { Inspector, type InspectorProps } from "@/features/shell/Inspector";
import type { TableMeta } from "@/features/canvas/actions";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import type { TableView } from "@/features/schema/model/parse";
import { useSchemaStore } from "@/features/schema/store";

function meta(partial: Partial<TableMeta> = {}): TableMeta {
  return {
    sources: [],
    sample: null,
    pks: [],
    fks: [],
    refsIn: [],
    columnNotes: [],
    has: false,
    ...partial,
  };
}

const pedido: TableView = {
  id: "loja.pedido",
  name: "pedido",
  schema: "loja",
  columns: [
    { name: "id", type: "bigint", pk: true, notNull: true },
    { name: "cliente_id", type: "bigint", pk: false, notNull: true },
  ],
};

const fullMeta = meta({
  sources: ["loja.raw_pedido"],
  sample: {
    columns: ["id", "cliente_id"],
    rows: [
      ["1", "10"],
      ["2", "11"],
      ["3", "12"],
      ["4", "13"],
      ["5", "14"],
      ["6", "15"],
    ],
  },
  pks: ["id"],
  fks: [{ column: "cliente_id", ref: "loja.cliente.id" }],
  refsIn: ["loja.item"],
  note: "pedidos da loja",
  columnNotes: [{ column: "id", note: "surrogate" }],
  resourceType: "model",
  materialization: "incremental",
  tags: ["pii"],
  has: true,
});

function renderInspector(overrides: Partial<InspectorProps> = {}) {
  const props: InspectorProps = {
    tableMeta: () => fullMeta,
    layerOf: () => "bronze",
    colorOf: () => undefined,
    onSetColor: vi.fn(),
    layers: [{ id: "bronze", name: "Bronze", color: "unused" }],
    tables: [pedido],
    ...overrides,
  };
  return {
    ...render(<AppShell inspector={<Inspector {...props} />} />),
    props,
  };
}

describe("Inspector", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("shows an empty state when no table is selected", () => {
    renderInspector();
    expect(screen.getByText("Selecione uma tabela")).toBeTruthy();
    expect(screen.queryByText("loja.pedido")).toBeNull();
  });

  it("renders table, layer chip, column count, PK, FK target, materialization, tags", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    const tableMeta = vi.fn(() => fullMeta);
    const { container } = renderInspector({ tableMeta });

    expect(tableMeta).toHaveBeenCalledWith("loja.pedido");
    expect(screen.getByText("loja.pedido").className).toMatch(/font-mono/);
    expect(screen.getByText("Bronze")).toBeTruthy();
    expect(container.querySelector("[data-field='columns']")?.textContent).toContain("2");
    expect(container.querySelector("[data-field='pks']")?.textContent).toContain("id");
    expect(screen.getByText("cliente_id → loja.cliente(id)")).toBeTruthy();
    expect(screen.getByText("incremental")).toBeTruthy();
    expect(screen.getByText("#pii")).toBeTruthy();
  });

  it("renders the remaining TableMeta fields and omits has", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    const { container } = renderInspector();

    expect(screen.getByText(/loja\.raw_pedido/)).toBeTruthy();
    expect(screen.getByText("pedidos da loja")).toBeTruthy();
    expect(screen.getByText(/surrogate/)).toBeTruthy();
    expect(screen.getByText("model")).toBeTruthy();
    expect(screen.getByText(/referenciada por/)).toBeTruthy();
    expect(screen.getByText("loja.item")).toBeTruthy();
    expect(container.querySelectorAll("[data-field='sample'] tbody tr")).toHaveLength(5);
    expect(container.querySelector("[data-field='has']")).toBeNull();
    expect(screen.queryByText(/^has$/i)).toBeNull();
  });

  it("picks a colour from TABLE_COLORS and can clear it", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    const onSetColor = vi.fn();
    renderInspector({ onSetColor });

    fireEvent.click(screen.getByRole("button", { name: TABLE_COLORS[0] }));
    expect(onSetColor).toHaveBeenCalledWith("loja.pedido", TABLE_COLORS[0]);

    fireEvent.click(screen.getByRole("button", { name: "Sem cor" }));
    expect(onSetColor).toHaveBeenCalledWith("loja.pedido", null);
  });

  it("shows the selected column from tableMeta", () => {
    useSchemaStore.getState().selectColumn({ table: "loja.pedido", column: "cliente_id" });
    const { container } = renderInspector();
    const columnField = container.querySelector("[data-field='column']");
    expect(columnField?.textContent).toContain("cliente_id");
    expect(columnField?.textContent).toContain("bigint");
    expect(screen.getByText("cliente_id → loja.cliente(id)")).toBeTruthy();
  });

  it("closes the inspector without editing AppShell", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    const { container } = renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Fechar inspetor" }));
    const middle = container.querySelector("[data-shell='middle']") as HTMLElement;
    expect(middle.style.gridTemplateColumns).toBe("46px 176px 1fr 0px");
  });
});
