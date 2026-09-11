import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import "@/i18n";
import { AppShell } from "@/features/shell/AppShell";
import { SourceDrawer, type SourceDrawerHandle } from "@/features/source/SourceDrawer";

vi.mock("@uiw/react-codemirror", () => ({
  default: () => <div data-testid="codemirror" />,
}));

const emptyHandlers = { value: "", onChange: () => {} };

describe("SourceDrawer", () => {
  afterEach(cleanup);

  it("renders nothing when closed", () => {
    const { container } = render(<SourceDrawer open={false} {...emptyHandlers} />);
    expect(container.querySelector("[data-source-drawer]")).toBeNull();
  });

  it("slides up with animate-drawer-up when open", () => {
    const { container } = render(
      <SourceDrawer open value="Table a { id int }" onChange={() => {}} />,
    );
    const el = container.querySelector("[data-source-drawer]");
    expect(el).not.toBeNull();
    expect(el?.className).toContain("animate-drawer-up");
    expect(screen.getByRole("button", { name: "Formatar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
  });

  it("does not change the AppShell grid when opening or closing", () => {
    const { container, rerender } = render(
      <AppShell drawer={<SourceDrawer open={false} {...emptyHandlers} />} />,
    );
    const root = container.querySelector("[data-shell='root']") as HTMLElement;
    const middle = container.querySelector("[data-shell='middle']") as HTMLElement;
    const rows = root.style.gridTemplateRows;
    const cols = middle.style.gridTemplateColumns;

    rerender(<AppShell drawer={<SourceDrawer open {...emptyHandlers} />} />);
    expect(root.style.gridTemplateRows).toBe(rows);
    expect(middle.style.gridTemplateColumns).toBe(cols);
    expect(rows).toBe("auto 1fr auto");
    expect(cols).toBe("46px 176px 1fr auto");
  });

  it("Format reorders the DBML via organize", () => {
    const onChange = vi.fn();
    const value = "Ref: a.x > b.id\n\nTable a {\n  x int\n}\n";
    render(<SourceDrawer open value={value} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Formatar" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as string;
    expect(next.indexOf("Table a")).toBeLessThan(next.indexOf("Ref:"));
  });

  it("Copy writes the current DBML to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SourceDrawer open value="Table a { id int }" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith("Table a { id int }");
  });

  it("commit with a column rename that has child FKs raises RenameConfirmModal", () => {
    const committed = `Table clientes {
  id int [pk]
}
Table pedidos {
  id int
}
Ref: pedidos.id > clientes.id
`;
    const value = `Table clientes {
  codigo int [pk]
}
Table pedidos {
  id int
}
Ref: pedidos.id > clientes.id
`;
    const ref = createRef<SourceDrawerHandle>();
    render(
      <SourceDrawer ref={ref} open value={value} committedValue={committed} onChange={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => {
      ref.current?.commit();
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manter separado" })).toBeTruthy();
  });
});
