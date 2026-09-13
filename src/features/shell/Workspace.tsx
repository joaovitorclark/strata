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
  const {
    domain,
    onRepoChanged,
    dbml,
    positions,
    sizes,
    collapsedGroups,
    canvasPages,
    activePageIds,
    past,
    future,
    saveState,
    autoSave,
    currentProjectId,
    projects,
    pinnedProjectId,
    currentProject,
    status,
    logs,
    paletteOpen,
    setPaletteOpen,
    helpOpen,
    setHelpOpen,
    sourceDrawerOpen,
    setSourceDrawerOpen,
    setRenameModalOpen,
    layersPanelCollapsed,
    setLayersPanelCollapsed,
    recordsPanelOpen,
    setRecordsPanelOpen,
    problemsPanelOpen,
    setProblemsPanelOpen,
    focusTableId,
    focusNonce,
    fitViewTrigger,
    pageWizardOpen,
    setPageWizardOpen,
    pageWizardTableCount,
    railItem,
    setRailItem,
    density,
    setDensity,
    committedDbml,
    savedDbml,
    markCommitted,
    parsed,
    activeModel,
    canvasActiveModel,
    canvasStubs,
    canvasView,
    canvasLineage,
    canvasParsePending,
    modelIssues,
    nodeExtras,
    actions,
    layerOf,
    layersArr,
    assignEditorRef,
    commandContext,
    treeTables,
    undo,
    redo,
    handleSave,
    handleAutolayout,
    handleImport,
    handleOrganize,
    handleAddTable,
    handleAddMetadata,
    bumpFitView,
    handleExportOption,
    handleDbmlChange,
    handleCreateRef,
    handleRemoveRef,
    handleRemoveTable,
    handleRemoveTables,
    handleCreateLineage,
    handleRemoveLineage,
    handleCreateFieldLineage,
    handleRemoveFieldLineage,
    handleAddFieldLineage,
    handleUpdateFieldLineage,
    handleToggleGroup,
    handleChangeActivePages,
    handleBackToDomains,
    switchProject,
    handleCreateProject,
    handleRenameProject,
    handleDuplicateProject,
    handleDeleteProject,
    focusTableWithPan,
    focusTableInEditor,
    handleEditorCursorLine,
    goToLine,
    goToColumn,
    clearFocusTable,
    migrateTableId,
  } = useWorkspace(props);
  const [diffOpen, setDiffOpen] = useState(false);
  const hoveredTableId = useSchemaStore((s) => s.hoveredTableId);
  const toggleLineageMode = useSchemaStore((s) => s.toggleLineageMode);
  const hoveredMeta = hoveredTableId ? actions.tableMeta(hoveredTableId) : null;

  const saveLabel =
    saveState === "saving"
      ? t("shell.saving")
      : saveState === "saved"
        ? t("shell.saved")
        : saveState === "error"
          ? t("shell.saveError")
          : t("shell.save");

  const pinnedLabel = pinnedProjectId
    ? projects.find((p) => p.id === pinnedProjectId)?.name
    : undefined;

  return (
    <CanvasActionsCtx.Provider value={actions}>
      <div data-canvas-actions="ready" className="contents">
        <AppShell
          navbar={
            <Navbar
              domain={domain?.name}
              project={currentProject?.name}
              onSearch={() => setPaletteOpen(true)}
              onExportOption={handleExportOption}
              onBackToDomains={props.onBackToDomains ? handleBackToDomains : undefined}
              leading={
                <>
                  {projects.length > 0 ? (
                    <ProjectSwitcher
                      projects={projects}
                      currentProjectId={currentProjectId}
                      saveState={saveState}
                      onSwitch={switchProject}
                      onCreate={handleCreateProject}
                      onRename={handleRenameProject}
                      onDuplicate={handleDuplicateProject}
                      onDelete={handleDeleteProject}
                      pinnedLabel={pinnedLabel}
                    />
                  ) : null}
                  {domain?.hasGit ? (
                    <GitPanel domain={domain} onRepoChanged={onRepoChanged} />
                  ) : null}
                </>
              }
            />
          }
          rail={
            <WorkspaceShellRail
              railItem={railItem}
              onTables={() => setRailItem("tables")}
              onLayers={() => {
                setLayersPanelCollapsed(false);
                setRailItem("layers");
              }}
              onLineage={() => {
                toggleLineageMode();
                setRailItem("lineage");
              }}
              onCode={() => {
                setSourceDrawerOpen(!sourceDrawerOpen);
                setRailItem("code");
              }}
              onSearch={() => {
                setPaletteOpen(true);
                setRailItem("search");
              }}
              onSettings={() => setRailItem("settings")}
            />
          }
          tree={<SchemaTree tables={treeTables} layerOf={layerOf} />}
          canvas={
            <div className="relative h-full min-h-0 w-full">
              <Canvas
                parsed={canvasActiveModel}
                nodeExtras={nodeExtras}
                positions={positions}
                sizes={sizes}
                onPositionsChange={(p) => useSchemaStore.getState().setPositions(p)}
                onCreateRef={handleCreateRef}
                onRemoveRef={handleRemoveRef}
                onRemoveTable={handleRemoveTable}
                onRemoveTables={handleRemoveTables}
                staleWarning={!!parsed.error || canvasParsePending}
                lineage={canvasLineage}
                lineageFields={canvasActiveModel.lineageFields ?? []}
                onCreateLineage={handleCreateLineage}
                onRemoveLineage={handleRemoveLineage}
                onRemoveFieldLineage={handleRemoveFieldLineage}
                onCreateFieldLineage={handleCreateFieldLineage}
                layerOf={layerOf}
                collapsedGroups={collapsedGroups}
                onToggleGroup={handleToggleGroup}
                focusTableId={focusTableId}
                focusNonce={focusNonce}
                onFocusTableDone={clearFocusTable}
                onTableClick={focusTableInEditor}
                fitViewTrigger={fitViewTrigger}
                externalStubs={canvasStubs}
                crossRefs={canvasView.crossRefs}
                density={density}
              />
              <EditorChrome
                past={past.length}
                future={future.length}
                saveState={saveState}
                autoSave={autoSave}
                saveLabel={saveLabel}
                onUndo={undo}
                onRedo={redo}
                onOrganize={handleOrganize}
                onAddTable={handleAddTable}
                onAddMetadata={handleAddMetadata}
                onImport={handleImport}
                onDiff={() => setDiffOpen((open) => !open)}
                onSave={() => handleSave()}
                onAutoSave={() => useSchemaStore.getState().setAutoSave(!autoSave)}
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
                onClick={() => setHelpOpen(true)}
              >
                ?
              </button>
              <div className="absolute right-3 top-12 z-20">
                <StatusLog status={status} saveState={saveState} logs={logs} />
              </div>
              {hoveredMeta?.has ? (
                <div className="pointer-events-none absolute right-3 top-24 z-20">
                  <TableInfoPopover meta={hoveredMeta} />
                </div>
              ) : null}
              <DraggableOverlay storageKey="ldb.panel.layers.pos" className="top-10">
                <LayersPanel
                  layers={layersArr}
                  tables={activeModel.tables.map((tbl) => ({ id: tbl.id }))}
                  onAddLayer={actions.onAddLayer}
                  onFocusTable={focusTableWithPan}
                  onAutolayout={handleAutolayout}
                  pages={canvasPages}
                  activePageIds={activePageIds}
                  onChangeActivePages={handleChangeActivePages}
                  collapsed={layersPanelCollapsed}
                  onCollapsedChange={setLayersPanelCollapsed}
                />
              </DraggableOverlay>
              <DraggableOverlay storageKey="ldb.panel.column.pos" className="left-64 top-10">
                <ColumnPanel
                  dbml={dbml}
                  tables={activeModel.tables}
                  onApply={(next) => {
                    markCommitted(next);
                    handleDbmlChange(next);
                  }}
                  onRenameColumn={(table, oldName, newName) =>
                    actions.onRenameColumn(table, oldName, newName)
                  }
                  onGoToColumn={goToColumn}
                  mappings={activeModel.lineageFields ?? []}
                  onAddMapping={handleAddFieldLineage}
                  onUpdateMapping={handleUpdateFieldLineage}
                  onRemoveMapping={(st, sc, tc) => {
                    const tt = useSchemaStore.getState().selectedTable;
                    if (tt) handleRemoveFieldLineage(st, sc, tt, tc);
                  }}
                />
              </DraggableOverlay>
              <div className="absolute bottom-0 left-0 right-0 z-20">
                <RecordsPanel
                  records={activeModel.records}
                  tables={activeModel.tables}
                  refs={activeModel.refs}
                  lineageFields={activeModel.lineageFields}
                  dbml={dbml}
                  onApply={(next) => {
                    markCommitted(next);
                    handleDbmlChange(next);
                    useSchemaStore.getState().setSaveState("dirty");
                  }}
                  onFocusTable={focusTableWithPan}
                  open={recordsPanelOpen}
                  onOpenChange={setRecordsPanelOpen}
                />
              </div>
              <div className="absolute bottom-10 right-3 z-20">
                <ProblemsPanel
                  issues={modelIssues}
                  onFocusTable={focusTableWithPan}
                  onGoToLine={goToLine}
                  open={problemsPanelOpen}
                  onOpenChange={setProblemsPanelOpen}
                />
              </div>
              {railItem === "settings" ? (
                <div className="absolute bottom-12 right-3 z-20 w-72 rounded-md border border-border bg-card p-2 shadow-md">
                  {projects.length > 0 ? (
                    <ProjectSwitcher
                      projects={projects}
                      currentProjectId={currentProjectId}
                      saveState={saveState}
                      onSwitch={switchProject}
                      onCreate={handleCreateProject}
                      onRename={handleRenameProject}
                      onDuplicate={handleDuplicateProject}
                      onDelete={handleDeleteProject}
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
                open={pageWizardOpen}
                tableCount={pageWizardTableCount}
                pages={canvasPages}
                onConfirm={(pageIds) => {
                  handleChangeActivePages(pageIds);
                  setPageWizardOpen(false);
                }}
                onDismiss={() => {
                  useSchemaStore.getState().setActivePageIds([]);
                  setPageWizardOpen(false);
                }}
              />
            </div>
          }
          inspector={
            <Inspector
              tableMeta={actions.tableMeta}
              layerOf={layerOf}
              colorOf={actions.colorOf}
              onSetColor={actions.onSetColor}
              layers={layersArr}
              tables={activeModel.tables}
            />
          }
          drawer={
            <SourceDrawer
              ref={assignEditorRef}
              open={sourceDrawerOpen}
              onOpenChange={setSourceDrawerOpen}
              value={dbml}
              onChange={handleDbmlChange}
              committedValue={committedDbml}
              savedValue={savedDbml}
              onCommitted={markCommitted}
              onTableRenamed={migrateTableId}
              error={parsed.error}
              errorLine={parsed.errorLine}
              onFocusTable={focusTableWithPan}
              onCursorLine={handleEditorCursorLine}
              onGoToError={() => setSourceDrawerOpen(true)}
              onRenameModalOpenChange={setRenameModalOpen}
            />
          }
          statusbar={
            <StatusBar
              problemCount={modelIssues.length}
              zoomPercent={100}
              density={density}
              dbmlOpen={sourceDrawerOpen}
              onProblemsClick={() => setProblemsPanelOpen(!problemsPanelOpen)}
              onDbmlToggle={() => setSourceDrawerOpen(!sourceDrawerOpen)}
              onFitView={bumpFitView}
              onDensityChange={setDensity}
            />
          }
        />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} context={commandContext} />
        <ShortcutsOverlay open={helpOpen} onOpenChange={setHelpOpen} context={commandContext} />
        <DbmlDiff
          open={diffOpen}
          saved={savedDbml}
          working={dbml}
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
