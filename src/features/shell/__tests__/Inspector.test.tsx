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

const cliente: TableView = {
  id: "loja.cliente",
  name: "cliente",
  schema: "loja",
  columns: [
    { name: "id", type: "bigint", pk: true, notNull: true },
    { name: "nome", type: "string", pk: false, notNull: false },
  ],
};

const item: TableView = {
  id: "loja.item",
  name: "item",
  schema: "loja",
  columns: [{ name: "id", type: "bigint", pk: true, notNull: true }],
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

const DBML = `Table loja.cliente {
  id bigint [pk]
  nome string
}

Table loja.pedido {
  id bigint [pk]
  cliente_id bigint [not null]
  Note: 'pedidos da loja'
}

Table loja.item {
  id bigint [pk]
}

Ref: loja.pedido.cliente_id > loja.cliente.id
`;

function renderInspector(overrides: Partial<InspectorProps> = {}) {
  const props: InspectorProps = {
    tableMeta: () => fullMeta,
    layerOf: () => "bronze",
    colorOf: () => undefined,
    onSetColor: vi.fn(),
    layers: [{ id: "bronze", name: "Bronze", color: "unused" }],
    tables: [pedido, cliente, item],
    dbml: DBML,
    onApply: vi.fn(),
    lineageFields: [
      {
        targetTable: "loja.pedido",
        targetColumn: "cliente_id",
        sourceTable: "loja.cliente",
        sourceColumn: "id",
      },
    ],
    problemCount: 2,
    onFocusTable: vi.fn(),
    onSetLayer: vi.fn(),
    onRenameTable: vi.fn(),
    onRenameColumn: vi.fn(),
    onRemoveTables: vi.fn(),
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

  it("shows a project summary and Selecione uma tabela when nothing is selected", () => {
    renderInspector();
    expect(screen.getByText("Selecione uma tabela")).toBeTruthy();
    const summary = screen.getByTestId("inspector-summary");
    expect(summary.textContent).toMatch(/3/);
    expect(summary.textContent).toMatch(/2/);
  });

  it("opens Tabela and Colunas when a table is selected", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    renderInspector();
    expect(screen.getByTestId("inspector-section-table").getAttribute("data-state")).toBe("open");
    expect(screen.getByTestId("inspector-section-columns").getAttribute("data-state")).toBe("open");
    expect(screen.getByTestId("inspector-header-name").textContent).toMatch(/loja/);
    expect(screen.getByTestId("inspector-header-name").textContent).toMatch(/pedido/);
    expect(screen.getByTestId("inspector-layer-chip").textContent).toMatch(/Bronze/);
    expect(screen.getByTestId("inspector").textContent).toContain("loja.pedido");
  });

  it("keeps tableMeta fields visible for the selected table", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    const { container } = renderInspector();
    expect(screen.getByText(/loja\.raw_pedido/)).toBeTruthy();
    expect(screen.getByText("pedidos da loja")).toBeTruthy();
    expect(screen.getByText(/surrogate/)).toBeTruthy();
    expect(screen.getByText("incremental")).toBeTruthy();
    expect(screen.getByText("#pii")).toBeTruthy();
    expect(screen.getByText("model")).toBeTruthy();
    expect(container.querySelector("[data-field='has']")).toBeNull();
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

  it("expands the selected column and shows lineage comes-from", () => {
    useSchemaStore.getState().selectColumn({ table: "loja.pedido", column: "cliente_id" });
    renderInspector();
    const detail = screen.getByTestId("inspector-column-cliente_id");
    expect(detail.textContent).toContain("cliente_id");
    expect(detail.textContent).toContain("bigint");
    expect(screen.getByTestId("inspector-comes-from").textContent).toContain("loja.cliente.id");
    fireEvent.click(screen.getByText("Rastrear"));
    expect(useSchemaStore.getState().focus).toEqual({
      kind: "field",
      table: "loja.pedido",
      column: "cliente_id",
    });
  });

  it("shows batch actions for multiple selected tables", () => {
    useSchemaStore.getState().setSelectedTableIds(["loja.pedido", "loja.cliente", "loja.item"]);
    renderInspector();
    expect(screen.getByText("3 tabelas selecionadas")).toBeTruthy();
    expect(screen.getByTestId("inspector-batch-layer")).toBeTruthy();
  });

  it("closes the inspector without editing AppShell", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    const { container } = renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Fechar inspetor" }));
    const middle = container.querySelector("[data-shell='middle']") as HTMLElement;
    expect(middle.style.gridTemplateColumns).toBe("46px 176px 1fr 0px");
  });
});
