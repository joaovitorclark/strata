import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { SelectionBar } from "@/features/panels/SelectionBar";
import { useSchemaStore } from "@/features/schema/store";

describe("SelectionBar", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders nothing without a multi-table selection or when a column is selected", () => {
    const { container, rerender } = render(<SelectionBar />);
    expect(container.querySelector(".selection-bar")).toBeNull();

    useSchemaStore.getState().setSelectedTableIds(["loja.pedido"]);
    rerender(<SelectionBar />);
    expect(screen.getByText("1 tabela selecionada")).toBeTruthy();

    useSchemaStore.getState().selectColumn({ table: "loja.pedido", column: "id" });
    rerender(<SelectionBar />);
    expect(container.querySelector(".selection-bar")).toBeNull();
  });

  it("removes one table from the multi-selection via the chip ×", () => {
    useSchemaStore.getState().setSelectedTableIds(["loja.pedido", "loja.cliente"]);
    render(<SelectionBar />);
    fireEvent.click(screen.getByRole("button", { name: "Remover loja.pedido da seleção" }));
    expect(useSchemaStore.getState().selectedTableIds).toEqual(["loja.cliente"]);
  });

  it("Apagar selecionadas confirms then deletes all selected tables", () => {
    const onRemoveTables = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    useSchemaStore.getState().setSelectedTableIds(["loja.pedido", "loja.cliente"]);
    render(<SelectionBar onRemoveTables={onRemoveTables} />);
    fireEvent.click(screen.getByRole("button", { name: "Apagar selecionadas" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(onRemoveTables).toHaveBeenCalledWith(["loja.pedido", "loja.cliente"]);
  });

  it("does not delete when the confirm is cancelled", () => {
    const onRemoveTables = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    useSchemaStore.getState().setSelectedTableIds(["loja.pedido"]);
    render(<SelectionBar onRemoveTables={onRemoveTables} />);
    fireEvent.click(screen.getByRole("button", { name: "Apagar selecionadas" }));
    expect(onRemoveTables).not.toHaveBeenCalled();
  });

  it("Limpar clears a multi-table selection", () => {
    useSchemaStore.getState().setSelectedTableIds(["loja.pedido", "loja.cliente"]);
    render(<SelectionBar />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(useSchemaStore.getState().selectedTableIds).toEqual([]);
    expect(useSchemaStore.getState().selectedTable).toBeNull();
  });
});
