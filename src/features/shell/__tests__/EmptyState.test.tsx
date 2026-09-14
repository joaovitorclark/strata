import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@/i18n";
import { EmptyState } from "../EmptyState";

describe("S12 EmptyState", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the empty-model copy and the three actions", () => {
    render(<EmptyState onApply={vi.fn()} onImport={vi.fn()} onAddTable={vi.fn()} />);
    expect(screen.getByTestId("workspace-empty-state")).toBeTruthy();
    expect(screen.getByText("Comece seu modelo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Colar SQL / DBML / schema.rb" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Importar projeto dbt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Tabela" })).toBeTruthy();
    expect(screen.getByText(/arraste um arquivo \.sql, \.dbml, \.rb, \.yml/i)).toBeTruthy();
  });

  it("pasting DBML applies through onApply", async () => {
    const onApply = vi.fn();
    render(<EmptyState onApply={onApply} onImport={vi.fn()} onAddTable={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Colar SQL / DBML / schema.rb" }));
    const input = await screen.findByTestId("empty-paste-input");
    fireEvent.change(input, {
      target: { value: "Table foo {\n  id int [pk]\n}\n\nTable bar {\n  id int [pk]\n}\n" },
    });
    fireEvent.click(screen.getByTestId("empty-paste-apply"));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply.mock.calls[0]?.[0]).toMatch(/Table\s+foo/);
    expect(onApply.mock.calls[0]?.[0]).toMatch(/Table\s+bar/);
  });

  it("pasting invalid text shows an error and does not apply", async () => {
    const onApply = vi.fn();
    render(<EmptyState onApply={onApply} onImport={vi.fn()} onAddTable={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Colar SQL / DBML / schema.rb" }));
    fireEvent.change(await screen.findByTestId("empty-paste-input"), {
      target: { value: "not a schema at all" },
    });
    fireEvent.click(screen.getByTestId("empty-paste-apply"));
    expect(await screen.findByTestId("empty-paste-error")).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("Importar projeto dbt and + Tabela call the workspace handlers", () => {
    const onImport = vi.fn();
    const onAddTable = vi.fn();
    render(<EmptyState onApply={vi.fn()} onImport={onImport} onAddTable={onAddTable} />);
    fireEvent.click(screen.getByRole("button", { name: "Importar projeto dbt" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Tabela" }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onAddTable).toHaveBeenCalledTimes(1);
  });

  it("dropping a .dbml file uses the same path as paste", async () => {
    const onApply = vi.fn();
    render(<EmptyState onApply={onApply} onImport={vi.fn()} onAddTable={vi.fn()} />);
    const file = new File(["Table dropped {\n  id int [pk]\n}\n"], "schema.dbml", {
      type: "text/plain",
    });
    fireEvent.drop(screen.getByTestId("workspace-empty-state"), {
      dataTransfer: { files: [file], types: ["Files"] },
    });
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply.mock.calls[0]?.[0]).toMatch(/Table\s+dropped/);
  });
});
