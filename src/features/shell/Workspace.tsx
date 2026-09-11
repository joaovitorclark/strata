import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CanvasActionsCtx } from "@/features/canvas/actions";
import { Canvas } from "@/features/canvas";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { ShortcutsOverlay } from "@/features/command-palette/ShortcutsOverlay";
import { GitPanel } from "@/features/domains/GitPanel";
import {
  ColumnPanel,
  LayersPanel,
  PageImportWizard,
  ProblemsPanel,
  RecordsPanel,
  StatusLog,
  TableInfoPopover,
  useDraggablePanel,
} from "@/features/panels";
import { ProjectSwitcher } from "@/features/projects/ProjectSwitcher";
import { useSchemaStore } from "@/features/schema/store";
import { AppShell, useShellLayout } from "@/features/shell/AppShell";
import { IconRail, type RailItem } from "@/features/shell/IconRail";
import { Inspector } from "@/features/shell/Inspector";
import { Navbar } from "@/features/shell/Navbar";
import { SchemaTree } from "@/features/shell/SchemaTree";
import { StatusBar } from "@/features/shell/StatusBar";
import { useWorkspace, type RailItemId, type WorkspaceProps } from "@/features/shell/useWorkspace";
import { SourceDrawer } from "@/features/source/SourceDrawer";
import { DbmlDiff } from "@/features/source/DbmlDiff";
import { cn } from "@/lib/utils";

export type { WorkspaceProps };

function DraggableOverlay({
  storageKey,
  className,
  children,
}: {
  storageKey: string;
  className?: string;
  children: ReactNode;
}) {
  const { panelRef, dragStyle, onDragStart } = useDraggablePanel(storageKey);
  return (
    <div
      ref={panelRef}
      className={cn("absolute z-20", className)}
      style={dragStyle ?? { left: 8, top: 8 }}
    >
      <div
        className="mb-0.5 h-3 cursor-grab rounded-t-md bg-border/50"
        onPointerDown={onDragStart}
      />
      {children}
    </div>
  );
}

export function Workspace(props: WorkspaceProps) {
  const { t } = useTranslation();
  const ws = useWorkspace(props);
  const [diffOpen, setDiffOpen] = useState(false);
  const hoveredTableId = useSchemaStore((s) => s.hoveredTableId);
  const toggleLineageMode = useSchemaStore((s) => s.toggleLineageMode);
  const hoveredMeta = hoveredTableId ? ws.actions.tableMeta(hoveredTableId) : null;

  const saveLabel =
    ws.saveState === "saving"
      ? t("shell.saving")
      : ws.saveState === "saved"
        ? t("shell.saved")
        : ws.saveState === "error"
          ? t("shell.saveError")
          : t("shell.save");

  const pinnedLabel = ws.pinnedProjectId
    ? ws.projects.find((p) => p.id === ws.pinnedProjectId)?.name
    : undefined;

  return (
    <CanvasActionsCtx.Provider value={ws.actions}>
      <div data-canvas-actions="ready" className="contents">
        <AppShell
          navbar={
            <Navbar
              domain={ws.domain?.name}
              project={ws.currentProject?.name}
              onSearch={() => ws.setPaletteOpen(true)}
              onExportOption={ws.handleExportOption}
              onBackToDomains={props.onBackToDomains ? ws.handleBackToDomains : undefined}
              leading={
                <>
                  {ws.projects.length > 0 ? (
                    <ProjectSwitcher
                      projects={ws.projects}
                      currentProjectId={ws.currentProjectId}
                      saveState={ws.saveState}
                      onSwitch={ws.switchProject}
                      onCreate={ws.handleCreateProject}
                      onRename={ws.handleRenameProject}
                      onDuplicate={ws.handleDuplicateProject}
                      onDelete={ws.handleDeleteProject}
                      pinnedLabel={pinnedLabel}
                    />
                  ) : null}
                  {ws.domain?.hasGit ? (
                    <GitPanel domain={ws.domain} onRepoChanged={ws.onRepoChanged} />
                  ) : null}
                </>
              }
            />
          }
          rail={
            <WorkspaceShellRail
              railItem={ws.railItem}
              onTables={() => ws.setRailItem("tables")}
              onLayers={() => {
                ws.setLayersPanelCollapsed(false);
                ws.setRailItem("layers");
              }}
              onLineage={() => {
                toggleLineageMode();
                ws.setRailItem("lineage");
              }}
              onCode={() => {
                ws.setSourceDrawerOpen(!ws.sourceDrawerOpen);
                ws.setRailItem("code");
              }}
              onSearch={() => {
                ws.setPaletteOpen(true);
                ws.setRailItem("search");
              }}
              onSettings={() => ws.setRailItem("settings")}
            />
          }
          tree={<SchemaTree tables={ws.treeTables} layerOf={ws.layerOf} />}
          canvas={
            <div className="relative h-full min-h-0 w-full">
              <Canvas
                parsed={ws.canvasActiveModel}
                nodeExtras={ws.nodeExtras}
                positions={ws.positions}
                sizes={ws.sizes}
                onPositionsChange={(p) => useSchemaStore.getState().setPositions(p)}
                onCreateRef={ws.handleCreateRef}
                onRemoveRef={ws.handleRemoveRef}
                onRemoveTable={ws.handleRemoveTable}
                onRemoveTables={ws.handleRemoveTables}
                staleWarning={!!ws.parsed.error || ws.canvasParsePending}
                lineage={ws.canvasLineage}
                lineageFields={ws.canvasActiveModel.lineageFields ?? []}
                onCreateLineage={ws.handleCreateLineage}
                onRemoveLineage={ws.handleRemoveLineage}
                onRemoveFieldLineage={ws.handleRemoveFieldLineage}
                onCreateFieldLineage={ws.handleCreateFieldLineage}
                layerOf={ws.layerOf}
                collapsedGroups={ws.collapsedGroups}
                onToggleGroup={ws.handleToggleGroup}
                focusTableId={ws.focusTableId}
                focusNonce={ws.focusNonce}
                onFocusTableDone={ws.clearFocusTable}
                onTableClick={ws.focusTableInEditor}
                fitViewTrigger={ws.fitViewTrigger}
                externalStubs={ws.canvasStubs}
                crossRefs={ws.canvasView.crossRefs}
                density={ws.density}
              />
              <EditorChrome
                past={ws.past.length}
                future={ws.future.length}
                saveState={ws.saveState}
                autoSave={ws.autoSave}
                saveLabel={saveLabel}
                onUndo={ws.undo}
                onRedo={ws.redo}
                onOrganize={ws.handleOrganize}
                onAddTable={ws.handleAddTable}
                onAddMetadata={ws.handleAddMetadata}
                onImport={ws.handleImport}
                onDiff={() => setDiffOpen((open) => !open)}
                onSave={() => ws.handleSave()}
                onAutoSave={() => useSchemaStore.getState().setAutoSave(!ws.autoSave)}
              />
              <button
                type="button"
                className={cn(
                  "absolute right-3 top-3 z-20 inline-flex size-8 items-center justify-center",
                  "rounded-md border border-border bg-card text-sm text-foreground shadow-md",
                  "hover:bg-accent",
                )}
                title={t("shell.help")}
                aria-label={t("shell.help")}
                onClick={() => ws.setHelpOpen(true)}
              >
                ?
              </button>
              <div className="absolute right-3 top-12 z-20">
                <StatusLog status={ws.status} saveState={ws.saveState} logs={ws.logs} />
              </div>
              {hoveredMeta?.has ? (
                <div className="pointer-events-none absolute right-3 top-24 z-20">
                  <TableInfoPopover meta={hoveredMeta} />
                </div>
              ) : null}
              <DraggableOverlay storageKey="ldb.panel.layers.pos" className="top-10">
                <LayersPanel
                  layers={ws.layersArr}
                  tables={ws.activeModel.tables.map((tbl) => ({ id: tbl.id }))}
                  onAddLayer={ws.actions.onAddLayer}
                  onFocusTable={ws.focusTableWithPan}
                  onAutolayout={ws.handleAutolayout}
                  pages={ws.canvasPages}
                  activePageIds={ws.activePageIds}
                  onChangeActivePages={ws.handleChangeActivePages}
                  collapsed={ws.layersPanelCollapsed}
                  onCollapsedChange={ws.setLayersPanelCollapsed}
                />
              </DraggableOverlay>
              <DraggableOverlay storageKey="ldb.panel.column.pos" className="left-64 top-10">
                <ColumnPanel
                  dbml={ws.dbml}
                  tables={ws.activeModel.tables}
                  onApply={(next) => {
                    ws.markCommitted(next);
                    ws.handleDbmlChange(next);
                  }}
                  onRenameColumn={(table, oldName, newName) =>
                    ws.actions.onRenameColumn(table, oldName, newName)
                  }
                  onGoToColumn={ws.goToColumn}
                  mappings={ws.activeModel.lineageFields ?? []}
                  onAddMapping={ws.handleAddFieldLineage}
                  onUpdateMapping={ws.handleUpdateFieldLineage}
                  onRemoveMapping={(st, sc, tc) => {
                    const tt = useSchemaStore.getState().selectedTable;
                    if (tt) ws.handleRemoveFieldLineage(st, sc, tt, tc);
                  }}
                />
              </DraggableOverlay>
              <div className="absolute bottom-0 left-0 right-0 z-20">
                <RecordsPanel
                  records={ws.activeModel.records}
                  tables={ws.activeModel.tables}
                  refs={ws.activeModel.refs}
                  lineageFields={ws.activeModel.lineageFields}
                  dbml={ws.dbml}
                  onApply={(next) => {
                    ws.markCommitted(next);
                    ws.handleDbmlChange(next);
                    useSchemaStore.getState().setSaveState("dirty");
                  }}
                  onFocusTable={ws.focusTableWithPan}
                  open={ws.recordsPanelOpen}
                  onOpenChange={ws.setRecordsPanelOpen}
                />
              </div>
              <div className="absolute bottom-10 right-3 z-20">
                <ProblemsPanel
                  issues={ws.modelIssues}
                  onFocusTable={ws.focusTableWithPan}
                  onGoToLine={ws.goToLine}
                  open={ws.problemsPanelOpen}
                  onOpenChange={ws.setProblemsPanelOpen}
                />
              </div>
              {ws.railItem === "settings" ? (
                <div className="absolute bottom-12 right-3 z-20 w-72 rounded-md border border-border bg-card p-2 shadow-md">
                  {ws.projects.length > 0 ? (
                    <ProjectSwitcher
                      projects={ws.projects}
                      currentProjectId={ws.currentProjectId}
                      saveState={ws.saveState}
                      onSwitch={ws.switchProject}
                      onCreate={ws.handleCreateProject}
                      onRename={ws.handleRenameProject}
                      onDuplicate={ws.handleDuplicateProject}
                      onDelete={ws.handleDeleteProject}
                      pinnedLabel={pinnedLabel}
                    />
                  ) : (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      {t("shell.rail.settings")}
                    </p>
                  )}
                </div>
              ) : null}
              <PageImportWizard
                open={ws.pageWizardOpen}
                tableCount={ws.pageWizardTableCount}
                pages={ws.canvasPages}
                onConfirm={(pageIds) => {
                  ws.handleChangeActivePages(pageIds);
                  ws.setPageWizardOpen(false);
                }}
                onDismiss={() => {
                  useSchemaStore.getState().setActivePageIds([]);
                  ws.setPageWizardOpen(false);
                }}
              />
            </div>
          }
          inspector={
            <Inspector
              tableMeta={ws.actions.tableMeta}
              layerOf={ws.layerOf}
              colorOf={ws.actions.colorOf}
              onSetColor={ws.actions.onSetColor}
              layers={ws.layersArr}
              tables={ws.activeModel.tables}
            />
          }
          drawer={
            <SourceDrawer
              ref={ws.editorRef}
              open={ws.sourceDrawerOpen}
              onOpenChange={ws.setSourceDrawerOpen}
              value={ws.dbml}
              onChange={ws.handleDbmlChange}
              committedValue={ws.committedDbml}
              savedValue={ws.savedDbml}
              onCommitted={ws.markCommitted}
              onTableRenamed={ws.migrateTableId}
              error={ws.parsed.error}
              errorLine={ws.parsed.errorLine}
              onFocusTable={ws.focusTableWithPan}
              onCursorLine={ws.handleEditorCursorLine}
              onGoToError={() => ws.setSourceDrawerOpen(true)}
              onRenameModalOpenChange={ws.setRenameModalOpen}
            />
          }
          statusbar={
            <StatusBar
              problemCount={ws.modelIssues.length}
              zoomPercent={100}
              density={ws.density}
              dbmlOpen={ws.sourceDrawerOpen}
              onProblemsClick={() => ws.setProblemsPanelOpen(!ws.problemsPanelOpen)}
              onDbmlToggle={() => ws.setSourceDrawerOpen(!ws.sourceDrawerOpen)}
              onFitView={ws.bumpFitView}
              onDensityChange={ws.setDensity}
            />
          }
        />
        <CommandPalette
          open={ws.paletteOpen}
          onOpenChange={ws.setPaletteOpen}
          context={ws.commandContext}
        />
        <ShortcutsOverlay
          open={ws.helpOpen}
          onOpenChange={ws.setHelpOpen}
          context={ws.commandContext}
        />
        <DbmlDiff
          open={diffOpen}
          saved={ws.savedDbml}
          working={ws.dbml}
          onClose={() => setDiffOpen(false)}
        />
      </div>
    </CanvasActionsCtx.Provider>
  );
}

function WorkspaceShellRail({
  railItem,
  onTables,
  onLayers,
  onLineage,
  onCode,
  onSearch,
  onSettings,
}: {
  railItem: RailItemId;
  onTables: () => void;
  onLayers: () => void;
  onLineage: () => void;
  onCode: () => void;
  onSearch: () => void;
  onSettings: () => void;
}) {
  const { setTreeCollapsed } = useShellLayout();
  return (
    <IconRail
      active={railItem}
      onSelect={(item: RailItem) => {
        if (item === "tables") {
          setTreeCollapsed(false);
          onTables();
        } else if (item === "layers") onLayers();
        else if (item === "lineage") onLineage();
        else if (item === "code") onCode();
        else if (item === "search") onSearch();
        else onSettings();
      }}
    />
  );
}

function EditorChrome({
  past,
  future,
  saveState,
  autoSave,
  saveLabel,
  onUndo,
  onRedo,
  onOrganize,
  onAddTable,
  onAddMetadata,
  onImport,
  onDiff,
  onSave,
  onAutoSave,
}: {
  past: number;
  future: number;
  saveState: string;
  autoSave: boolean;
  saveLabel: string;
  onUndo: () => void;
  onRedo: () => void;
  onOrganize: () => void;
  onAddTable: () => void;
  onAddMetadata: () => void;
  onImport: () => void;
  onDiff: () => void;
  onSave: () => void;
  onAutoSave: () => void;
}) {
  const { t } = useTranslation();
  const btn =
    "inline-flex h-7 items-center rounded-md px-2 text-2xs text-foreground " +
    "hover:bg-accent disabled:opacity-40";
  return (
    <div className="absolute left-3 top-3 z-20 flex max-w-[min(100%,42rem)] flex-wrap gap-1 rounded-md border border-border bg-card/95 p-1 shadow-md">
      <button
        type="button"
        className={btn}
        onClick={onUndo}
        disabled={!past}
        aria-label={t("shell.undo")}
      >
        {t("shell.undo")}
      </button>
      <button
        type="button"
        className={btn}
        onClick={onRedo}
        disabled={!future}
        aria-label={t("shell.redo")}
      >
        {t("shell.redo")}
      </button>
      <button type="button" className={btn} onClick={onOrganize}>
        {t("shell.organizeDbml")}
      </button>
      <button type="button" className={btn} onClick={onAddTable}>
        {t("shell.addTable")}
      </button>
      <button type="button" className={btn} onClick={onAddMetadata}>
        {t("shell.addMetadata")}
      </button>
      <button type="button" className={btn} onClick={onImport}>
        {t("shell.importInput")}
      </button>
      <button type="button" className={btn} onClick={onDiff} aria-label={t("shell.diff")}>
        {t("shell.diff")}
      </button>
      <button
        type="button"
        className={btn}
        onClick={onSave}
        aria-label={t("shell.save")}
        disabled={saveState === "saving" || saveState === "saved"}
      >
        {saveLabel}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={autoSave}
        aria-label={t("shell.autosave")}
        className={btn}
        onClick={onAutoSave}
      >
        {t("shell.autosave")}
      </button>
    </div>
  );
}
