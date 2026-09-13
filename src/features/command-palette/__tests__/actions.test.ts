import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { organize } from "@/features/schema/model/organize";
import { useSchemaStore } from "@/features/schema/store";
import { exportFormat } from "@/infrastructure/api";
import {
  EXPORTERS,
  buildCommandDefs,
  commandsFromContext,
  exporterCommandId,
  focusColumnFromPalette,
  focusTableFromPalette,
  isToggleActive,
  type CommandContext,
} from "@/features/command-palette/actions";
import { formatShortcut, shortcutsFromCommands } from "@/features/command-palette/gestures";

vi.mock("@/infrastructure/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/api")>();
  return {
    ...actual,
    exportFormat: vi.fn().mockResolvedValue({ files: ["out.sql"] }),
  };
});

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
    tables: [
      { id: "gold.dim_customer", name: "dim_customer", schema: "gold" },
      { id: "silver.fact_orders" },
    ],
    columns: [
      { tableId: "gold.dim_customer", columnName: "id" },
      { tableId: "gold.dim_customer", columnName: "name" },
    ],
    panToTable: vi.fn(),
    goToLine: vi.fn(),
    goToColumn: vi.fn(),
    openSourceDrawer: vi.fn(),
    removeSelectedRef: vi.fn(),
    closeModals: vi.fn(),
    onExport: vi.fn(),
    ...overrides,
  };
}

const t = (key: string) => i18n.t(key);

describe("EXPORTERS", () => {
  it("lists ten export commands over nine formats", () => {
    expect(EXPORTERS).toHaveLength(10);
    const localdrawdb = EXPORTERS.filter((e) => e.id === "localdrawdb");
    expect(localdrawdb).toHaveLength(2);
    expect(localdrawdb.map((e) => ("dialect" in e ? e.dialect : undefined)).sort()).toEqual([
      "oracle",
      "spark",
    ]);
    const ids = new Set(EXPORTERS.map((e) => e.id));
    expect(ids.size).toBe(9);
  });
});

describe("buildCommandDefs", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    vi.mocked(exportFormat).mockClear();
  });

  it("declares save, organize, ten exports, import, undo/redo, and five toggles", () => {
    const defs = buildCommandDefs();
    expect(defs.map((d) => d.id)).toEqual([
      "save",
      "organize-dbml",
      "organize-canvas",
      ...EXPORTERS.map(exporterCommandId),
      "import-input",
      "undo",
      "redo",
      "toggle-autosave",
      "toggle-lineage-mode",
      "toggle-layers-panel",
      "toggle-records-panel",
      "toggle-problems-panel",
    ]);
    expect(defs).toHaveLength(21);
    expect(defs.filter((d) => d.kind === "toggle")).toHaveLength(5);
  });

  it("blocks save while the rename modal is open", async () => {
    const ctx = makeContext({ renameModalOpen: true });
    await buildCommandDefs()
      .find((d) => d.id === "save")!
      .run(ctx);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("saves when the rename modal is closed", async () => {
    const ctx = makeContext();
    await buildCommandDefs()
      .find((d) => d.id === "save")!
      .run(ctx);
    expect(ctx.save).toHaveBeenCalledOnce();
  });

  it("organize-dbml rewrites tables before refs", () => {
    let dbml = `Ref: a.x > b.x\n\nTable a {\n  x int\n}\n\nTable b {\n  x int\n}\n`;
    const ctx = makeContext({
      dbml,
      organizeDbml: () => {
        dbml = organize(dbml);
      },
    });
    buildCommandDefs()
      .find((d) => d.id === "organize-dbml")!
      .run(ctx);
    expect(dbml.indexOf("Table")).toBeGreaterThanOrEqual(0);
    expect(dbml.indexOf("Table")).toBeLessThan(dbml.indexOf("Ref:"));
  });

  it("organize-canvas runs the canvas autolayout callback", () => {
    const ctx = makeContext();
    buildCommandDefs()
      .find((d) => d.id === "organize-canvas")!
      .run(ctx);
    expect(ctx.organizeCanvas).toHaveBeenCalledOnce();
  });

  it("derives each export from EXPORTERS and calls exportFormat", async () => {
    const ctx = makeContext();
    const defs = buildCommandDefs();
    for (const exporter of EXPORTERS) {
      const def = defs.find((d) => d.id === exporterCommandId(exporter));
      expect(def, exporter.labelKey).toBeDefined();
      await def!.run(ctx);
      const dialect = "dialect" in exporter ? exporter.dialect : undefined;
      expect(exportFormat).toHaveBeenCalledWith(ctx.dbml, exporter.id, dialect);
    }
    expect(exportFormat).toHaveBeenCalledTimes(10);
  });

  it("import-input, undo, and redo call through to context", async () => {
    const ctx = makeContext();
    const defs = buildCommandDefs();
    await defs.find((d) => d.id === "import-input")!.run(ctx);
    defs.find((d) => d.id === "undo")!.run(ctx);
    defs.find((d) => d.id === "redo")!.run(ctx);
    expect(ctx.importInput).toHaveBeenCalledOnce();
    expect(ctx.undo).toHaveBeenCalledOnce();
    expect(ctx.redo).toHaveBeenCalledOnce();
  });

  it("toggles flip autosave, lineage, and the three panels", () => {
    const ctx = makeContext({
      autoSave: false,
      layersPanelCollapsed: true,
      recordsPanelOpen: false,
      problemsPanelOpen: false,
    });
    const defs = Object.fromEntries(buildCommandDefs().map((d) => [d.id, d]));
    defs["toggle-autosave"].run(ctx);
    expect(ctx.setAutoSave).toHaveBeenCalledWith(true);
    defs["toggle-lineage-mode"].run(ctx);
    expect(useSchemaStore.getState().lineageMode).toBe(true);
    defs["toggle-layers-panel"].run(ctx);
    expect(ctx.setLayersPanelCollapsed).toHaveBeenCalledWith(false);
    defs["toggle-records-panel"].run(ctx);
    expect(ctx.setRecordsPanelOpen).toHaveBeenCalledWith(true);
    defs["toggle-problems-panel"].run(ctx);
    expect(ctx.setProblemsPanelOpen).toHaveBeenCalledWith(true);
  });

  it("toggle labels swap with state via labelKey/activeLabelKey", () => {
    const off = makeContext({
      autoSave: false,
      recordsPanelOpen: false,
      layersPanelCollapsed: true,
    });
    const on = makeContext({
      autoSave: true,
      recordsPanelOpen: true,
      layersPanelCollapsed: false,
    });
    const autosave = buildCommandDefs().find((d) => d.id === "toggle-autosave")!;
    const records = buildCommandDefs().find((d) => d.id === "toggle-records-panel")!;
    expect(isToggleActive(autosave, off)).toBe(false);
    expect(isToggleActive(autosave, on)).toBe(true);
    expect(isToggleActive(records, off)).toBe(false);
    expect(isToggleActive(records, on)).toBe(true);
    const commandsOff = commandsFromContext(off, t);
    const commandsOn = commandsFromContext(on, t);
    expect(commandsOff.find((c) => c.id === "action:toggle-autosave")?.label).toBe(
      "Ligar Auto-save",
    );
    expect(commandsOn.find((c) => c.id === "action:toggle-autosave")?.label).toBe(
      "Desligar Auto-save",
    );
    expect(commandsOff.find((c) => c.id === "action:toggle-records-panel")?.label).toBe(
      "Abrir painel Dados",
    );
    expect(commandsOn.find((c) => c.id === "action:toggle-records-panel")?.label).toBe(
      "Fechar painel Dados",
    );
  });
});

describe("palette navigation", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  it("focusing a table selects it, pans, and scrolls the editor to its line", () => {
    const ctx = makeContext();
    focusTableFromPalette(ctx, "gold.dim_customer");
    expect(useSchemaStore.getState().selectedTable).toBe("gold.dim_customer");
    expect(ctx.panToTable).toHaveBeenCalledWith("gold.dim_customer");
    expect(ctx.openSourceDrawer).toHaveBeenCalledOnce();
    expect(ctx.goToLine).toHaveBeenCalledWith(0);
  });

  it("focusing a column selects it, pans the table, and scrolls to the column line", () => {
    const ctx = makeContext({ goToColumn: undefined });
    focusColumnFromPalette(ctx, "gold.dim_customer", "id");
    expect(useSchemaStore.getState().selectedColumn).toEqual({
      table: "gold.dim_customer",
      column: "id",
    });
    expect(ctx.panToTable).toHaveBeenCalledWith("gold.dim_customer");
    expect(ctx.goToLine).toHaveBeenCalledWith(1);
  });
});

describe("shortcutsFromCommands vs ⌘Y", () => {
  it("does not emit ⌘Y from the registry; Y is an explicit overlay extra", () => {
    const commands = commandsFromContext(makeContext(), t);
    const rows = shortcutsFromCommands(commands, true);
    expect(rows.some((row) => row.keys === "⌘Y")).toBe(false);
    expect(rows.some((row) => row.keys === "⌘⇧Z")).toBe(true);
    expect(formatShortcut(true, { mod: true, key: "Y" })).toBe("⌘Y");
    expect(formatShortcut(false, { mod: true, key: "Y" })).toBe("Ctrl+Y");
  });
});
