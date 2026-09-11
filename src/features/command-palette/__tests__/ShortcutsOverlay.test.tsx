import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import "@/i18n";
import i18n from "@/i18n";
import { ShortcutsOverlay } from "@/features/command-palette/ShortcutsOverlay";
import { commandsFromContext, type CommandContext } from "@/features/command-palette/actions";
import { CANVAS_GESTURES, shortcutsFromCommands } from "@/features/command-palette/gestures";

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    dbml: "",
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
    tables: [],
    panToTable: vi.fn(),
    goToLine: vi.fn(),
    ...overrides,
  };
}

function OverlayHarness({ context }: { context: CommandContext }) {
  const [open, setOpen] = useState(false);
  return <ShortcutsOverlay open={open} onOpenChange={setOpen} context={context} />;
}

describe("ShortcutsOverlay", () => {
  afterEach(cleanup);

  it("? toggles the shortcuts-and-gestures overlay", () => {
    render(<OverlayHarness context={makeContext()} />);
    expect(screen.queryByTestId("shortcuts-overlay")).toBeNull();
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByTestId("shortcuts-overlay")).toBeTruthy();
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.queryByTestId("shortcuts-overlay")).toBeNull();
  });

  it("renders CANVAS_GESTURES plus shortcutsFromCommands and an explicit ⌘Y redo row", () => {
    const ctx = makeContext();
    const commands = commandsFromContext(ctx, (key) => i18n.t(key));
    expect(shortcutsFromCommands(commands, true).some((row) => row.keys === "⌘Y")).toBe(false);

    render(<ShortcutsOverlay open context={ctx} commands={commands} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("shortcuts-overlay")).toBeTruthy();
    expect(screen.getAllByText("Atalhos e gestos").length).toBeGreaterThan(0);
    const keys = [...document.querySelectorAll("kbd")].map((el) => el.textContent);
    expect(keys.some((k) => k === "⌘Y" || k === "Ctrl+Y")).toBe(true);
    expect(keys.some((k) => k === "⌘⇧Z" || k === "Ctrl+Shift+Z")).toBe(true);
    expect(keys.some((k) => k === "⌘S" || k === "Ctrl+S")).toBe(true);
    expect(keys.some((k) => k === "⌘K" || k === "Ctrl+K")).toBe(true);
    expect(keys).toContain("Delete");
    expect(keys).toContain("Escape");
    expect(keys).toContain("?");
    for (const gesture of CANVAS_GESTURES) {
      expect(screen.getAllByText(gesture.gesture).length).toBeGreaterThan(0);
    }
  });

  it("Escape and click-outside close the overlay", () => {
    const onOpenChange = vi.fn();
    render(
      <div>
        <button type="button">fora</button>
        <ShortcutsOverlay open context={makeContext()} onOpenChange={onOpenChange} />
      </div>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    fireEvent.mouseDown(screen.getByRole("button", { name: "fora" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
