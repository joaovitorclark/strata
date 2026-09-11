import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { Outline } from "@/features/source/Outline";

const DBML = `Table loja.cliente {
  id bigint [pk]
}

Table loja.pedido {
  id bigint [pk]
}
`;

describe("Outline interactions", () => {
  afterEach(cleanup);

  it("collapses and expands via the chevron", () => {
    render(<Outline dbml={DBML} onGoToLine={vi.fn()} />);
    expect(screen.getByPlaceholderText("Filtrar blocos…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Outline/ }));
    expect(screen.queryByPlaceholderText("Filtrar blocos…")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Outline/ }));
    expect(screen.getByPlaceholderText("Filtrar blocos…")).toBeTruthy();
  });

  it("filters blocks by label", () => {
    render(<Outline dbml={DBML} onGoToLine={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Filtrar blocos…"), {
      target: { value: "pedido" },
    });
    expect(screen.getByText("loja.pedido")).toBeTruthy();
    expect(screen.queryByText("loja.cliente")).toBeNull();
  });

  it("clicking a table row jumps the editor and focuses the canvas", () => {
    const onGoToLine = vi.fn();
    const onFocusTable = vi.fn();
    render(<Outline dbml={DBML} onGoToLine={onGoToLine} onFocusTable={onFocusTable} />);
    fireEvent.click(screen.getByText("loja.cliente"));
    expect(onGoToLine).toHaveBeenCalled();
    expect(onFocusTable).toHaveBeenCalledWith("loja.cliente");
  });

  it("exposes a horizontal resize handle", () => {
    render(<Outline dbml={DBML} onGoToLine={vi.fn()} />);
    expect(screen.getByRole("separator", { name: "Redimensionar painel de outline" })).toBeTruthy();
  });
});
