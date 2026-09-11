import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { ColumnPanel } from "@/features/panels/ColumnPanel";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import type { TableView } from "@/features/schema/model/parse";
import { useSchemaStore } from "@/features/schema/store";

const DBML = `Table loja.cliente {
  id bigint [pk]
  nome string
}

Table loja.pedido {
  id bigint [pk]
  cliente_id bigint
  status string
}
`;

const tables: TableView[] = [
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
    id: "loja.pedido",
    name: "pedido",
    schema: "loja",
    columns: [
      { name: "id", type: "bigint", pk: true, notNull: true },
      { name: "cliente_id", type: "bigint", pk: false, notNull: false },
      { name: "status", type: "string", pk: false, notNull: false },
    ],
  },
];

const mappingProps = {
  mappings: [],
  onAddMapping: vi.fn(),
  onUpdateMapping: vi.fn(),
  onRemoveMapping: vi.fn(),
};

function renderPanel(
  overrides: Partial<ComponentProps<typeof ColumnPanel>> = {},
  column = { table: "loja.pedido", column: "status" },
) {
  useSchemaStore.getState().selectColumn(column);
  const onApply = vi.fn();
  const onRenameColumn = vi.fn();
  const onGoToColumn = vi.fn();
  const result = render(
    <ColumnPanel
      dbml={DBML}
      tables={tables}
      onApply={onApply}
      onRenameColumn={onRenameColumn}
      onGoToColumn={onGoToColumn}
      {...mappingProps}
      {...overrides}
    />,
  );
  return { ...result, onApply, onRenameColumn, onGoToColumn };
}

describe("ColumnPanel", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders nothing without a selected column", () => {
    const { container } = render(
      <ColumnPanel dbml={DBML} tables={tables} onApply={vi.fn()} {...mappingProps} />,
    );
    expect(container.querySelector(".column-panel")).toBeNull();
  });

  it("collapses and expands, persisting to localStorage", () => {
    renderPanel();
    expect(screen.getByLabelText("Nome")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Recolher editor" }));
    expect(screen.queryByLabelText("Nome")).toBeNull();
    expect(localStorage.getItem("localdrawdb.columnPanelCollapsed")).toBe("1");
    expect(document.querySelector(".column-panel")?.className).toMatch(/is-collapsed/);

    fireEvent.click(screen.getByRole("button", { name: "Expandir editor" }));
    expect(screen.getByLabelText("Nome")).toBeTruthy();
    expect(localStorage.getItem("localdrawdb.columnPanelCollapsed")).toBe("0");
  });

  it("closes the editor and clears the selected column", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Fechar editor de coluna" }));
    expect(useSchemaStore.getState().selectedColumn).toBeNull();
  });

  it("renames the column via Nome on Enter and blur", () => {
    const { onRenameColumn } = renderPanel();
    const input = screen.getByLabelText("Nome") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "estado" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRenameColumn).toHaveBeenCalledWith("loja.pedido", "status", "estado");
    expect(useSchemaStore.getState().selectedColumn).toEqual({
      table: "loja.pedido",
      column: "estado",
    });

    onRenameColumn.mockClear();
    useSchemaStore.getState().selectColumn({ table: "loja.pedido", column: "status" });
    fireEvent.change(input, { target: { value: "situacao" } });
    fireEvent.blur(input);
    expect(onRenameColumn).toHaveBeenCalledWith("loja.pedido", "status", "situacao");
  });

  it("Editar no DBML jumps to the column", () => {
    const { onGoToColumn } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Editar no DBML" }));
    expect(onGoToColumn).toHaveBeenCalledWith("loja.pedido", "status");
  });

  it("sets field-name colour to Vermelho, Amarelo, or Verde from TABLE_COLORS", () => {
    const { onApply } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Vermelho" }));
    expect(onApply.mock.calls.at(-1)?.[0]).toContain(TABLE_COLORS[5]);
    fireEvent.click(screen.getByRole("button", { name: "Amarelo" }));
    expect(onApply.mock.calls.at(-1)?.[0]).toContain(TABLE_COLORS[3]);
    fireEvent.click(screen.getByRole("button", { name: "Verde" }));
    expect(onApply.mock.calls.at(-1)?.[0]).toContain(TABLE_COLORS[2]);
  });

  it("picks another TABLE_COLORS swatch instead of a free hex", () => {
    const { onApply } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: TABLE_COLORS[0] }));
    expect(onApply.mock.calls.at(-1)?.[0]).toContain(TABLE_COLORS[0]);
  });

  it("Sem cor clears the field-name colour", () => {
    const { onApply } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Sem cor" }));
    const next = onApply.mock.calls.at(-1)?.[0] as string;
    expect(next).not.toMatch(/loja\.pedido\.status/i);
  });

  it("toggles Primary key", () => {
    const { onApply } = renderPanel();
    fireEvent.click(screen.getByRole("checkbox", { name: "Primary key" }));
    expect(onApply.mock.calls.at(-1)?.[0]).toMatch(/status\s+string\s+\[pk\]/);
  });

  it("chooses a FK target or nenhuma from other table PKs", () => {
    const { onApply } = renderPanel(
      {
        dbml: `Table loja.cliente {
  id bigint [pk]
}

Table loja.pedido {
  cliente_id bigint
}
`,
      },
      { table: "loja.pedido", column: "cliente_id" },
    );
    const select = screen.getByLabelText("Referência (FK)") as HTMLSelectElement;
    expect(select.querySelector('option[value=""]')?.textContent).toMatch(/nenhuma/);
    fireEvent.change(select, { target: { value: "loja.cliente.id" } });
    expect(onApply.mock.calls.at(-1)?.[0]).toMatch(/ref:\s*>\s*loja\.cliente\.id/);
    fireEvent.change(select, { target: { value: "" } });
    const cleared = onApply.mock.calls.at(-1)?.[0] as string;
    expect(cleared).not.toMatch(/ref:\s*>\s*loja\.cliente\.id/);
  });

  it("toggles Not null", () => {
    const { onApply } = renderPanel();
    fireEvent.click(screen.getByRole("checkbox", { name: "Not null" }));
    expect(onApply.mock.calls.at(-1)?.[0]).toMatch(/status\s+string\s+\[not null\]/);
  });

  it("edits the column Note", () => {
    const { onApply } = renderPanel();
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "estado do pedido" } });
    expect(onApply.mock.calls.at(-1)?.[0]).toMatch(/note:\s*'estado do pedido'/);
  });

  it("edits the column Default", () => {
    const { onApply } = renderPanel();
    fireEvent.change(screen.getByLabelText("Default"), { target: { value: "'open'" } });
    expect(onApply.mock.calls.at(-1)?.[0]).toMatch(/default:\s*'open'/);
  });
});
