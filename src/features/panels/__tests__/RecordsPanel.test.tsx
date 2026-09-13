import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import "@/i18n";
import { RecordsPanel } from "@/features/panels/RecordsPanel";
import type { ParsedRecords } from "@/features/schema/model/records";
import type { ParsedFieldLineage, RefView, TableView } from "@/features/schema/model/parse";
import { useSchemaStore } from "@/features/schema/store";

const DBML = `Table loja.pedido {
  id bigint [pk]
  cliente_id bigint
}

Table loja.cliente {
  id bigint [pk]
  nome string
}

Table loja.raw_pedido {
  id bigint [pk]
}
`;

const tables: TableView[] = [
  {
    id: "loja.pedido",
    name: "pedido",
    schema: "loja",
    columns: [
      { name: "id", type: "bigint", pk: true, notNull: true },
      { name: "cliente_id", type: "bigint", pk: false, notNull: false },
    ],
  },
  {
    id: "loja.cliente",
    name: "cliente",
    schema: "loja",
    columns: [{ name: "id", type: "bigint", pk: true, notNull: true }],
  },
  {
    id: "loja.raw_pedido",
    name: "raw_pedido",
    schema: "loja",
    columns: [{ name: "id", type: "bigint", pk: true, notNull: true }],
  },
];

const records: ParsedRecords[] = [
  {
    table: "loja.pedido",
    columns: ["id", "cliente_id"],
    rows: [["1", "10"]],
    raw: "",
  },
];

const refs: RefView[] = [
  {
    id: "r1",
    source: "loja.pedido",
    target: "loja.cliente",
    label: "",
    fromCol: "cliente_id",
    toCol: "id",
    fromRel: "*",
    toRel: "1",
  },
  {
    id: "r2",
    source: "loja.raw_pedido",
    target: "loja.pedido",
    label: "",
    fromCol: "id",
    toCol: "id",
    fromRel: "*",
    toRel: "1",
  },
];

const lineageFields: ParsedFieldLineage[] = [
  {
    sourceTable: "loja.raw_pedido",
    sourceColumn: "id",
    targetTable: "loja.pedido",
    targetColumn: "cliente_id",
    note: "surrogate",
  },
];

type PanelProps = ComponentProps<typeof RecordsPanel>;

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const onApply = vi.fn();
  const onFocusTable = vi.fn();
  const onOpenChange = vi.fn();
  const props: PanelProps = {
    records,
    tables,
    refs,
    lineageFields,
    dbml: DBML,
    onApply,
    onFocusTable,
    onOpenChange,
    open: true,
    ...overrides,
  };
  return { ...render(<RecordsPanel {...props} />), onApply, onFocusTable, onOpenChange };
}

describe("RecordsPanel", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("toggles the sample-data panel open and closed", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    render(
      <RecordsPanel
        records={records}
        tables={tables}
        refs={refs}
        lineageFields={lineageFields}
        dbml={DBML}
        onApply={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("button", { name: /Dados \(amostra\)/ });
    expect(screen.queryByLabelText("Nota da tabela")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Nota da tabela")).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByLabelText("Nota da tabela")).toBeNull();
  });

  it("saves the table note on blur", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    const { onApply } = renderPanel();
    const field = screen.getByLabelText("Nota da tabela");
    fireEvent.change(field, { target: { value: "pedidos da loja" } });
    fireEvent.blur(field);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toContain("pedidos da loja");
  });

  it("saves the selected column note on blur", () => {
    useSchemaStore.getState().selectColumn({ table: "loja.pedido", column: "cliente_id" });
    const { onApply } = renderPanel();
    const field = screen.getByLabelText("Nota · cliente_id");
    fireEvent.change(field, { target: { value: "fk para cliente" } });
    fireEvent.blur(field);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatch(/note: 'fk para cliente'/);
  });

  it("focuses an L1 source table when its name is clicked", () => {
    useSchemaStore.getState().selectTable("loja.pedido");
    const { onFocusTable } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "loja.cliente" }));
    expect(onFocusTable).toHaveBeenCalledWith("loja.cliente");
    fireEvent.click(screen.getByRole("button", { name: "loja.raw_pedido" }));
    expect(onFocusTable).toHaveBeenCalledWith("loja.raw_pedido");
  });

  it("focuses the L2 source table when table.column is clicked", () => {
    useSchemaStore.getState().selectColumn({ table: "loja.pedido", column: "cliente_id" });
    const { onFocusTable } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "loja.raw_pedido.id" }));
    expect(onFocusTable).toHaveBeenCalledWith("loja.raw_pedido");
  });
});
