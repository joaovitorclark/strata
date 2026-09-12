import type { CanvasActions } from "@/features/canvas/actions";
import { lineOfColumn, lineOfTable } from "@/features/schema/model/lineLocate";
import { useSchemaStore } from "@/features/schema/store";
import { exportFormat, type ExportFormat } from "@/infrastructure/api";
import {
  buildCommands,
  type Command,
  type CommandAction,
  type CommandColumn,
  type CommandTable,
} from "./registry";

export type CommandContext = {
  dbml: string;
  renameModalOpen: boolean;
  save: () => void | Promise<void>;
  organizeDbml: () => void;
  organizeCanvas: () => void;
  importInput: () => void | Promise<void>;
  undo: () => void;
  redo: () => void;
  autoSave: boolean;
  setAutoSave: (value: boolean) => void;
  layersPanelCollapsed: boolean;
  setLayersPanelCollapsed: (value: boolean) => void;
  recordsPanelOpen: boolean;
  setRecordsPanelOpen: (value: boolean) => void;
  problemsPanelOpen: boolean;
  setProblemsPanelOpen: (value: boolean) => void;
  tables: CommandTable[];
  columns?: CommandColumn[];
  panToTable: (tableId: string) => void;
  goToLine: (line: number) => void;
  goToColumn?: (table: string, column: string) => void;
  openSourceDrawer?: () => void;
  removeSelectedRef?: () => boolean;
  closeModals?: () => void;
  onExport?: (files: string[]) => void;
  lineageMode?: boolean;
};

export type CommandDef = {
  /** Stable English id. Never translated; used in tests and telemetry. */
  id: string;
  labelKey: string;
  /** Toggles only: the label shown while active. */
  activeLabelKey?: string;
  shortcut?: string;
  kind: "action" | "toggle";
  run: (ctx: CommandContext) => void | Promise<void>;
};

export const EXPORTERS = [
  { id: "dbt", labelKey: "export.dbt", extension: "dbt" },
  { id: "spark-ddl", labelKey: "export.sparkDdl", extension: "sql" },
  { id: "oracle-ddl", labelKey: "export.oracleDdl", extension: "sql" },
  { id: "postgres-ddl", labelKey: "export.postgresDdl", extension: "sql" },
  { id: "erwin", labelKey: "export.erwin", extension: "xml" },
  { id: "mermaid", labelKey: "export.mermaid", extension: "mmd" },
  { id: "xlsx", labelKey: "export.xlsx", extension: "xlsx" },
  { id: "llm-context", labelKey: "export.llmContext", extension: "md" },
  { id: "localdrawdb", labelKey: "export.localdrawdbSpark", dialect: "spark" },
  { id: "localdrawdb", labelKey: "export.localdrawdbOracle", dialect: "oracle" },
] as const;

export type ExporterDef = (typeof EXPORTERS)[number];

export function exporterCommandId(exporter: ExporterDef): string {
  return "dialect" in exporter
    ? `export:${exporter.id}-${exporter.dialect}`
    : `export:${exporter.id}`;
}

function exporterDialect(exporter: ExporterDef): "spark" | "oracle" | undefined {
  return "dialect" in exporter ? exporter.dialect : undefined;
}

function exportCommands(): CommandDef[] {
  return EXPORTERS.map((exporter) => ({
    id: exporterCommandId(exporter),
    labelKey: exporter.labelKey,
    kind: "action" as const,
    run: async (ctx: CommandContext) => {
      const result = await exportFormat(
        ctx.dbml,
        exporter.id as ExportFormat,
        exporterDialect(exporter),
      );
      ctx.onExport?.(result.files);
    },
  }));
}

export function isToggleActive(def: CommandDef, ctx: CommandContext): boolean {
  switch (def.id) {
    case "toggle-autosave":
      return ctx.autoSave;
    case "toggle-lineage-mode":
      return ctx.lineageMode ?? useSchemaStore.getState().lineageMode;
    case "toggle-layers-panel":
      return !ctx.layersPanelCollapsed;
    case "toggle-records-panel":
      return ctx.recordsPanelOpen;
    case "toggle-problems-panel":
      return ctx.problemsPanelOpen;
    default:
      return false;
  }
}

export function buildCommandDefs(): CommandDef[] {
  return [
    {
      id: "save",
      labelKey: "command.save",
      shortcut: "Cmd/Ctrl+S",
      kind: "action",
      run: (ctx) => {
        if (ctx.renameModalOpen) return;
        return ctx.save();
      },
    },
    {
      id: "organize-dbml",
      labelKey: "command.organizeDbml",
      kind: "action",
      run: (ctx) => ctx.organizeDbml(),
    },
    {
      id: "organize-canvas",
      labelKey: "command.organizeCanvas",
      kind: "action",
      run: (ctx) => ctx.organizeCanvas(),
    },
    ...exportCommands(),
    {
      id: "import-input",
      labelKey: "command.importInput",
      kind: "action",
      run: (ctx) => ctx.importInput(),
    },
    {
      id: "undo",
      labelKey: "command.undo",
      shortcut: "Cmd/Ctrl+Z",
      kind: "action",
      run: (ctx) => ctx.undo(),
    },
    {
      id: "redo",
      labelKey: "command.redo",
      shortcut: "Cmd/Ctrl+Shift+Z",
      kind: "action",
      run: (ctx) => ctx.redo(),
    },
    {
      id: "toggle-autosave",
      labelKey: "command.enableAutosave",
      activeLabelKey: "command.disableAutosave",
      kind: "toggle",
      run: (ctx) => ctx.setAutoSave(!ctx.autoSave),
    },
    {
      id: "toggle-lineage-mode",
      labelKey: "command.toggleLineageMode",
      activeLabelKey: "command.toggleLineageModeActive",
      kind: "toggle",
      run: () => {
        useSchemaStore.getState().toggleLineageMode();
      },
    },
    {
      id: "toggle-layers-panel",
      labelKey: "command.openLayersPanel",
      activeLabelKey: "command.closeLayersPanel",
      kind: "toggle",
      run: (ctx) => ctx.setLayersPanelCollapsed(!ctx.layersPanelCollapsed),
    },
    {
      id: "toggle-records-panel",
      labelKey: "command.openRecordsPanel",
      activeLabelKey: "command.closeRecordsPanel",
      kind: "toggle",
      run: (ctx) => ctx.setRecordsPanelOpen(!ctx.recordsPanelOpen),
    },
    {
      id: "toggle-problems-panel",
      labelKey: "command.openProblemsPanel",
      activeLabelKey: "command.closeProblemsPanel",
      kind: "toggle",
      run: (ctx) => ctx.setProblemsPanelOpen(!ctx.problemsPanelOpen),
    },
  ];
}

export function toCommandActions(
  defs: CommandDef[],
  t: (key: string) => string,
  ctx: CommandContext,
): CommandAction[] {
  return defs.map((def) => {
    const active = def.kind === "toggle" && def.activeLabelKey && isToggleActive(def, ctx);
    const label = t(active ? def.activeLabelKey! : def.labelKey);
    const keywords = [
      t(def.labelKey),
      def.activeLabelKey ? t(def.activeLabelKey) : "",
      def.id,
      ...def.id.split(/[-:]/),
    ].filter(Boolean);
    return {
      id: `action:${def.id}`,
      label,
      shortcut: def.shortcut,
      keywords,
      run: () => def.run(ctx),
    };
  });
}

export function focusTableFromPalette(ctx: CommandContext, tableId: string): void {
  useSchemaStore.getState().selectTable(tableId);
  ctx.panToTable(tableId);
  ctx.openSourceDrawer?.();
  const line = lineOfTable(ctx.dbml, tableId);
  if (line != null) ctx.goToLine(line);
}

export function focusColumnFromPalette(
  ctx: CommandContext,
  tableId: string,
  columnName: string,
  canvasActions?: CanvasActions | null,
): void {
  if (canvasActions) canvasActions.onSelectColumn(tableId, columnName);
  else useSchemaStore.getState().selectColumn({ table: tableId, column: columnName });
  ctx.panToTable(tableId);
  ctx.openSourceDrawer?.();
  if (ctx.goToColumn) ctx.goToColumn(tableId, columnName);
  else if (canvasActions?.onGoToColumn) canvasActions.onGoToColumn(tableId, columnName);
  else {
    const line = lineOfColumn(ctx.dbml, tableId, columnName);
    if (line != null) ctx.goToLine(line);
  }
}

export function commandsFromContext(
  ctx: CommandContext,
  t: (key: string) => string,
  canvasActions?: CanvasActions | null,
): Command[] {
  return buildCommands({
    tables: ctx.tables,
    columns: ctx.columns,
    actions: toCommandActions(buildCommandDefs(), t, ctx),
    onFocusTable: (tableId) => focusTableFromPalette(ctx, tableId),
    onFocusColumn: (tableId, columnName) =>
      focusColumnFromPalette(ctx, tableId, columnName, canvasActions),
  });
}
