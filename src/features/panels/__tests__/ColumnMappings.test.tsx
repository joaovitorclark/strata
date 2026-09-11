import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import "@/i18n";
import { ColumnMappings } from "@/features/panels/ColumnMappings";
import type { ParsedFieldLineage, TableView } from "@/features/schema/model/parse";

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
    columns: [
      { name: "id", type: "bigint", pk: true, notNull: true },
      { name: "nome", type: "string", pk: false, notNull: false },
    ],
  },
  {
    id: "loja.raw_pedido",
    name: "raw_pedido",
    schema: "loja",
    columns: [{ name: "id", type: "bigint", pk: true, notNull: true }],
  },
];

const existing: ParsedFieldLineage[] = [
  {
    sourceTable: "loja.raw_pedido",
    sourceColumn: "id",
    targetTable: "loja.pedido",
    targetColumn: "cliente_id",
    note: "surrogate",
    ref: "jobs/transform.sql",
  },
];

type MappingProps = ComponentProps<typeof ColumnMappings>;

function renderMappings(overrides: Partial<MappingProps> = {}) {
  const onAdd = vi.fn();
  const onUpdate = vi.fn();
  const onRemove = vi.fn();
  const props: MappingProps = {
    tables,
    mappings: existing,
    targetTable: "loja.pedido",
    targetColumn: "cliente_id",
    onAdd,
    onUpdate,
    onRemove,
    ...overrides,
  };
  return { ...render(<ColumnMappings {...props} />), onAdd, onUpdate, onRemove };
}

describe("ColumnMappings", () => {
  afterEach(cleanup);

  it("loads an existing L2 mapping into the edit form", () => {
    renderMappings();
    fireEvent.click(screen.getByRole("button", { name: /loja\.raw_pedido\.id/ }));
    expect(screen.getByLabelText("Tabela origem")).toHaveProperty("value", "loja.raw_pedido");
    expect(screen.getByLabelText("Coluna origem")).toHaveProperty("value", "id");
    expect(screen.getByLabelText("Nota ETL")).toHaveProperty("value", "surrogate");
    expect(screen.getByLabelText("Ref (sql/py)")).toHaveProperty("value", "jobs/transform.sql");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
  });

  it("removes a mapping with the delete control", () => {
    const { onRemove } = renderMappings();
    fireEvent.click(screen.getByRole("button", { name: "Remover mapeamento" }));
    expect(onRemove).toHaveBeenCalledWith("loja.raw_pedido", "id", "cliente_id");
  });

  it("+ resets the form to create a new mapping", () => {
    renderMappings();
    fireEvent.click(screen.getByRole("button", { name: /loja\.raw_pedido\.id/ }));
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByLabelText("Tabela origem")).toHaveProperty("value", "");
    expect(screen.getByLabelText("Nota ETL")).toHaveProperty("value", "");
    expect(screen.getByRole("button", { name: "+ mapeamento" })).toBeTruthy();
  });

  it("chooses the source table and source column", () => {
    renderMappings({ mappings: [] });
    fireEvent.change(screen.getByLabelText("Tabela origem"), {
      target: { value: "loja.cliente" },
    });
    expect(screen.getByLabelText("Coluna origem")).toHaveProperty("disabled", false);
    fireEvent.change(screen.getByLabelText("Coluna origem"), { target: { value: "nome" } });
    expect(screen.getByLabelText("Coluna origem")).toHaveProperty("value", "nome");
  });

  it("edits Nota ETL and Ref (sql/py) then saves a new mapping", () => {
    const { onAdd } = renderMappings({ mappings: [] });
    fireEvent.change(screen.getByLabelText("Tabela origem"), {
      target: { value: "loja.cliente" },
    });
    fireEvent.change(screen.getByLabelText("Coluna origem"), { target: { value: "id" } });
    fireEvent.change(screen.getByLabelText("Nota ETL"), { target: { value: "regra x" } });
    fireEvent.change(screen.getByLabelText("Ref (sql/py)"), {
      target: { value: "jobs/load.py" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ mapeamento" }));
    expect(onAdd).toHaveBeenCalledWith(
      "loja.cliente",
      "id",
      "cliente_id",
      "regra x",
      "jobs/load.py",
    );
  });

  it("Salvar updates the loaded mapping", () => {
    const { onUpdate } = renderMappings();
    fireEvent.click(screen.getByRole("button", { name: /loja\.raw_pedido\.id/ }));
    fireEvent.change(screen.getByLabelText("Nota ETL"), { target: { value: "nova regra" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onUpdate).toHaveBeenCalledWith(
      {
        sourceTable: "loja.raw_pedido",
        sourceColumn: "id",
        targetTable: "loja.pedido",
        targetColumn: "cliente_id",
      },
      {
        sourceTable: "loja.raw_pedido",
        sourceColumn: "id",
        targetColumn: "cliente_id",
        note: "nova regra",
        ref: "jobs/transform.sql",
      },
    );
  });
});
