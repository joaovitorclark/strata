import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { Navbar } from "@/features/shell/Navbar";
import { useSchemaStore } from "@/features/schema/store";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { buildCommands, filterCommands, type Command } from "@/features/command-palette/registry";
import type { CommandContext } from "@/features/command-palette/actions";

const SAMPLE_DBML = `Table gold.dim_customer {
  id int
  name string
}
`;

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    dbml: SAMPLE_DBML,
    renameModalOpen: false,
    save: vi.fn(),
    organizeDbml: vi.fn(),
    organizeCanvas: vi.fn(),
    importInput: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    autoSave: false,
    setAutoSave: vi.fn(),
    layersPanelCollapsed: true,
    setLayersPanelCollapsed: vi.fn(),
    recordsPanelOpen: false,
    setRecordsPanelOpen: vi.fn(),
    problemsPanelOpen: false,
    setProblemsPanelOpen: vi.fn(),
    tables: [{ id: "gold.dim_customer" }, { id: "silver.fact_orders" }],
    columns: [
      { tableId: "gold.dim_customer", columnName: "id" },
      { tableId: "gold.dim_customer", columnName: "customer_id" },
    ],
    panToTable: vi.fn(),
    goToLine: vi.fn(),
    goToColumn: vi.fn(),
    openSourceDrawer: vi.fn(),
    removeSelectedRef: vi.fn(),
    closeModals: vi.fn(),
    ...overrides,
  };
}

function PaletteHarness({
  context,
  initiallyOpen = false,
}: {
  context: CommandContext;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <Navbar onSearch={() => setOpen(true)} />
      <CommandPalette open={open} onOpenChange={setOpen} context={context} />
    </>
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
  });

  it("opens from the navbar Buscar chip", () => {
    render(<PaletteHarness context={makeContext()} />);
    expect(screen.queryByTestId("command-palette")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByTestId("command-palette")).toBeTruthy();
  });

  it("filters tables, columns, and actions together and caps at 12", () => {
    const tables = Array.from({ length: 20 }, (_, idx) => ({ id: `gold.table_${idx}` }));
    const ctx = makeContext({
      tables,
      columns: tables.map((table) => ({ tableId: table.id, columnName: "id" })),
    });
    render(<CommandPalette open context={ctx} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Buscar tabela, coluna ou ação…");
    fireEvent.change(input, { target: { value: "table" } });
    expect(screen.getAllByRole("option")).toHaveLength(12);
  });

  it("Arrow Down/Up moves the highlighted result", () => {
    const ctx = makeContext();
    render(<CommandPalette open context={ctx} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Buscar tabela, coluna ou ação…");
    const first = screen.getAllByRole("option")[0];
    expect(first.getAttribute("data-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options[1].getAttribute("data-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0].getAttribute("data-selected")).toBe("true");
  });

  it("Enter runs the highlighted command and closes the palette", () => {
    const run = vi.fn();
    const onOpenChange = vi.fn();
    const commands: Command[] = [{ id: "action:save", kind: "action", label: "Salvar", run }];
    render(
      <CommandPalette
        open
        context={makeContext()}
        commands={commands}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText("Buscar tabela, coluna ou ação…"), {
      key: "Enter",
    });
    expect(run).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clicking a result runs it and closes the palette", () => {
    const run = vi.fn();
    const onOpenChange = vi.fn();
    const commands: Command[] = [{ id: "action:save", kind: "action", label: "Salvar", run }];
    render(
      <CommandPalette
        open
        context={makeContext()}
        commands={commands}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByRole("option", { name: /Salvar/ }));
    expect(run).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Escape closes the palette", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open context={makeContext()} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("click outside the palette closes it", () => {
    const onOpenChange = vi.fn();
    render(
      <div>
        <button type="button">fora</button>
        <CommandPalette open context={makeContext()} onOpenChange={onOpenChange} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByRole("button", { name: "fora" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("choosing a table command focuses, pans, and scrolls the editor", () => {
    const ctx = makeContext();
    const commands = buildCommands({
      tables: ctx.tables,
      columns: ctx.columns,
      actions: [],
      onFocusTable: (id) => {
        useSchemaStore.getState().selectTable(id);
        ctx.panToTable(id);
        ctx.goToLine(0);
      },
      onFocusColumn: vi.fn(),
    });
    render(<CommandPalette open context={ctx} commands={commands} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("option", { name: /gold\.dim_customer/ }));
    expect(useSchemaStore.getState().selectedTable).toBe("gold.dim_customer");
    expect(ctx.panToTable).toHaveBeenCalledWith("gold.dim_customer");
    expect(ctx.goToLine).toHaveBeenCalledWith(0);
  });

  it("choosing a column command focuses the table, selects the column, and scrolls", () => {
    const ctx = makeContext();
    const onFocusColumn = vi.fn((table: string, column: string) => {
      useSchemaStore.getState().selectColumn({ table, column });
      ctx.panToTable(table);
      ctx.goToColumn?.(table, column);
    });
    const commands = buildCommands({
      tables: ctx.tables,
      columns: ctx.columns,
      actions: [],
      onFocusTable: vi.fn(),
      onFocusColumn,
    });
    render(<CommandPalette open context={ctx} commands={commands} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Buscar tabela, coluna ou ação…");
    fireEvent.change(input, { target: { value: "customer_id" } });
    fireEvent.click(screen.getByRole("option", { name: /customer_id/ }));
    expect(onFocusColumn).toHaveBeenCalledWith("gold.dim_customer", "customer_id");
    expect(useSchemaStore.getState().selectedColumn).toEqual({
      table: "gold.dim_customer",
      column: "customer_id",
    });
    expect(ctx.panToTable).toHaveBeenCalledWith("gold.dim_customer");
    expect(ctx.goToColumn).toHaveBeenCalledWith("gold.dim_customer", "customer_id");
  });

  it("empty query omits columns", () => {
    const ctx = makeContext();
    render(<CommandPalette open context={ctx} onOpenChange={vi.fn()} />);
    const options = screen.getAllByRole("option").map((el) => el.textContent);
    expect(options.some((text) => text?.includes("customer_id"))).toBe(false);
    expect(
      filterCommands(
        buildCommands({
          tables: ctx.tables,
          columns: ctx.columns,
          actions: [],
          onFocusTable: vi.fn(),
        }),
        "",
        12,
      ).every((c) => c.kind !== "column"),
    ).toBe(true);
  });
});

describe("global palette shortcuts", () => {
  afterEach(cleanup);

  it("⌘K opens the palette", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={false} context={makeContext()} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("⌘S saves, and is blocked while the rename modal is open", () => {
    const ctx = makeContext();
    const { unmount } = render(
      <CommandPalette open={false} context={ctx} onOpenChange={vi.fn()} />,
    );
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    expect(ctx.save).toHaveBeenCalledOnce();
    unmount();
    const blocked = makeContext({ renameModalOpen: true });
    render(<CommandPalette open={false} context={blocked} onOpenChange={vi.fn()} />);
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    expect(blocked.save).not.toHaveBeenCalled();
  });

  it("⌘Z undoes and ⌘⇧Z / ⌘Y redo", () => {
    const ctx = makeContext();
    render(<CommandPalette open={false} context={ctx} onOpenChange={vi.fn()} />);
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "y", metaKey: true });
    expect(ctx.undo).toHaveBeenCalledOnce();
    expect(ctx.redo).toHaveBeenCalledTimes(2);
  });

  it("Delete removes the selected ref", () => {
    const ctx = makeContext();
    render(<CommandPalette open={false} context={ctx} onOpenChange={vi.fn()} />);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(ctx.removeSelectedRef).toHaveBeenCalledOnce();
  });

  it("Escape with the palette closed does not steal canvas selection", () => {
    const ctx = makeContext();
    useSchemaStore.getState().selectTable("gold.dim_customer");
    render(<CommandPalette open={false} context={ctx} onOpenChange={vi.fn()} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useSchemaStore.getState().selectedTable).toBe("gold.dim_customer");
    expect(ctx.closeModals).not.toHaveBeenCalled();
  });
});
