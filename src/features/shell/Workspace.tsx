import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CanvasActionsCtx } from "@/features/canvas/actions";
import { Canvas } from "@/features/canvas";
import { CanvasToolbar } from "@/features/canvas/toolbar";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { ShortcutsOverlay } from "@/features/command-palette/ShortcutsOverlay";
import { GitPanel } from "@/features/domains/GitPanel";
import {
  LayersPanel,
  PageImportWizard,
  ProblemsPanel,
  RecordsPanel,
  StatusLog,
} from "@/features/panels";
import { ProjectSwitcher } from "@/features/projects/ProjectSwitcher";
import { useSchemaStore } from "@/features/schema/store";
import { AppShell, useShellLayout } from "@/features/shell/AppShell";
import { EmptyState } from "@/features/shell/EmptyState";
import { IconRail, type RailItem } from "@/features/shell/IconRail";
import { DbtChangeLog } from "@/features/shell/DbtChangeLog";
import { Inspector } from "@/features/shell/Inspector";
import { LeftPanel, type LeftPanelTab } from "@/features/shell/LeftPanel";
import { Navbar } from "@/features/shell/Navbar";
import { SchemaTree } from "@/features/shell/SchemaTree";
import { StatusBar } from "@/features/shell/StatusBar";
import { useUrlSync } from "@/features/shell/useUrlSync";
import { useWorkspace, type RailItemId, type WorkspaceProps } from "@/features/shell/useWorkspace";
import { SourceDrawer } from "@/features/source/SourceDrawer";
import { DbmlDiff } from "@/features/source/DbmlDiff";
import { DbtCodePanel } from "@/features/source/DbtCodePanel";
import { DdlEditor } from "@/features/source/DdlEditor";
import { DbtFileDiff } from "@/features/source/DbtFileDiff";
import {
  isTabForFormat,
  readStoredDrawerTab,
  writeStoredDrawerTab,
  type DrawerTab,
} from "@/features/source/dbtDrawerTab";
import { noteDbtBaseline } from "@/features/source/dbtBaseline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type { WorkspaceProps };

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
    handleExportOption,
    handleDbmlChange,
    handleCreateRef,
    handleRemoveRef,
    handleRemoveTable,
    handleRemoveTables,
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
  useUrlSync({ focusTableWithPan, switchProject });
  const layoutAfterEmptyImport = useRef(false);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("tables");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(() => readStoredDrawerTab("dbml"));
  const [problemsOpen, setProblemsOpen] = useState(false);
  const toggleLineageMode = useSchemaStore((s) => s.toggleLineageMode);
  const documentFormat = useSchemaStore((s) => s.documentFormat);
  const dbtPastLen = useSchemaStore((s) => s.dbtPast.length);
  const dbtFutureLen = useSchemaStore((s) => s.dbtFuture.length);
  const hydratedProjectId = useSchemaStore((s) => s.hydratedProjectId);
  const dbtFiles = useSchemaStore((s) => s.files);
  const codeTab: DrawerTab = documentFormat === "dbt" ? "dbt" : "dbml";
  const activeDrawerTab: DrawerTab = isTabForFormat(drawerTab, documentFormat)
    ? drawerTab
    : readStoredDrawerTab(documentFormat);

  useEffect(() => {
    if (documentFormat !== "dbt" || !hydratedProjectId) return;
    if (Object.keys(dbtFiles).length === 0) return;
    noteDbtBaseline(hydratedProjectId, dbtFiles);
  }, [documentFormat, hydratedProjectId, dbtFiles]);

  const selectDrawerTab = (tab: DrawerTab) => {
    setDrawerTab(tab);
    writeStoredDrawerTab(tab);
  };

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

  useEffect(() => {
    if (!recordsPanelOpen) return;
    // Palette "abrir painel Dados" still flips recordsPanelOpen in useWorkspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync palette flag into the drawer tab
    setDrawerTab("records");
    setSourceDrawerOpen(true);
  }, [recordsPanelOpen, setSourceDrawerOpen]);

  useEffect(() => {
    if (!problemsPanelOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync palette flag into the status popover
    setProblemsOpen(true);
  }, [problemsPanelOpen]);

  useEffect(() => {
    if (!layoutAfterEmptyImport.current) return;
    if (activeModel.tables.length === 0) return;
    layoutAfterEmptyImport.current = false;
    handleAutolayout();
  }, [activeModel.tables, handleAutolayout]);

  // Store starts at dbml "". Treating that as "empty" unmounts React Flow before hydrate and
  // drops S06 URL focus. Only replace the canvas after a loaded document has zero tables.
  const showEmptyState = dbml.trim() !== "" && activeModel.tables.length === 0;

  const openDrawer = (tab: DrawerTab) => {
    selectDrawerTab(tab);
    setSourceDrawerOpen(true);
    setRecordsPanelOpen(tab === "records");
  };

  const toggleDrawer = (tab: DrawerTab) => {
    if (sourceDrawerOpen && activeDrawerTab === tab) {
      setSourceDrawerOpen(false);
      setRecordsPanelOpen(false);
      return;
    }
    openDrawer(tab);
  };

  return (
    <CanvasActionsCtx.Provider
      value={{
        ...actions,
        onGoToColumn: (table, column) => {
          selectDrawerTab(codeTab);
          actions.onGoToColumn?.(table, column);
        },
      }}
    >
      <div data-canvas-actions="ready" className="contents">
        <AppShell
          navbar={
            <Navbar
              domain={domain?.name}
              project={currentProject?.name}
              onSearch={() => setPaletteOpen(true)}
              onExportOption={handleExportOption}
              onBackToDomains={props.onBackToDomains ? handleBackToDomains : undefined}
              history={{
                canUndo: documentFormat === "dbt" ? dbtPastLen > 0 : past.length > 0,
                canRedo: documentFormat === "dbt" ? dbtFutureLen > 0 : future.length > 0,
                onUndo: undo,
                onRedo: redo,
              }}
              editActions={{
                onAddTable: handleAddTable,
                onAddMetadata: handleAddMetadata,
                onImport: handleImport,
                onOrganize: handleOrganize,
              }}
              save={{
                label: saveLabel,
                state: saveState,
                autoSave,
                onSave: () => handleSave(),
                onToggleAutoSave: () => useSchemaStore.getState().setAutoSave(!autoSave),
                onDiff: () => openDrawer("diff"),
              }}
              onHelp={() => setHelpOpen(true)}
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
              onTables={() => {
                setLeftTab("tables");
                setRailItem("tables");
              }}
              onLayers={() => {
                setLeftTab("layers");
                setLayersPanelCollapsed(false);
                setRailItem("layers");
              }}
              onLineage={() => {
                toggleLineageMode();
                setRailItem("lineage");
              }}
              onCode={() => {
                toggleDrawer(codeTab);
                setRailItem("code");
              }}
              onSearch={() => {
                setPaletteOpen(true);
                setRailItem("search");
              }}
              onSettings={() => setRailItem("settings")}
            />
          }
          tree={
            <LeftPanel
              tab={leftTab}
              onTab={(next) => {
                setLeftTab(next);
                setRailItem(next);
              }}
              tables={<SchemaTree tables={treeTables} layerOf={layerOf} />}
              onFocusTable={focusTableWithPan}
              layers={
                <LayersPanel
                  embedded
                  layers={layersArr}
                  tables={activeModel.tables.map((tbl) => ({ id: tbl.id }))}
                  onAddLayer={actions.onAddLayer}
                  onFocusTable={focusTableWithPan}
                  onAutolayout={handleAutolayout}
                  pages={canvasPages}
                  activePageIds={activePageIds}
                  onChangeActivePages={handleChangeActivePages}
                />
              }
            />
          }
          canvas={
            <div className="relative h-full min-h-0 w-full">
              {showEmptyState ? (
                <EmptyState
                  onApply={(next) => {
                    layoutAfterEmptyImport.current = true;
                    handleDbmlChange(next);
                    useSchemaStore.getState().setSaveState("dirty");
                  }}
                  onImport={() => {
                    layoutAfterEmptyImport.current = true;
                    handleImport();
                  }}
                  onAddTable={handleAddTable}
                />
              ) : (
                <>
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
                    onAddTable={handleAddTable}
                    staleWarning={!!parsed.error || canvasParsePending}
                    lineageFields={canvasActiveModel.lineageFields ?? []}
                    onRemoveFieldLineage={handleRemoveFieldLineage}
                    onCreateFieldLineage={handleCreateFieldLineage}
                    layerOf={layerOf}
                    collapsedGroups={collapsedGroups}
                    onToggleGroup={handleToggleGroup}
                    focusTableId={focusTableId}
                    focusNonce={focusNonce}
                    onFocusTableDone={clearFocusTable}
                    onTableClick={(id) => {
                      selectDrawerTab(codeTab);
                      focusTableInEditor(id);
                    }}
                    fitViewTrigger={fitViewTrigger}
                    externalStubs={canvasStubs}
                    crossRefs={canvasView.crossRefs}
                    density={density}
                    toolbar={<CanvasToolbar onAutolayout={handleAutolayout} />}
                  />
                  <DbtChangeLog />
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
                </>
              )}
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
              dbml={dbml}
              onApply={(next) => {
                markCommitted(next);
                handleDbmlChange(next);
              }}
              lineageFields={activeModel.lineageFields ?? []}
              problemCount={modelIssues.length}
              onFocusTable={focusTableWithPan}
              onSetLayer={actions.onSetLayer}
              onRenameTable={actions.onRenameTable}
              onRenameColumn={actions.onRenameColumn}
              onRemoveTables={handleRemoveTables}
              onGoToColumn={(table, column) => {
                selectDrawerTab(codeTab);
                goToColumn(table, column);
              }}
              onAddMapping={handleAddFieldLineage}
              onUpdateMapping={handleUpdateFieldLineage}
              onRemoveMapping={(st, sc, tc) => {
                const tt = useSchemaStore.getState().selectedTable;
                if (tt) handleRemoveFieldLineage(st, sc, tt, tc);
              }}
            />
          }
          drawer={
            <WorkspaceDrawer
              open={sourceDrawerOpen}
              tab={activeDrawerTab}
              format={documentFormat}
              onTab={(tab) => {
                selectDrawerTab(tab);
                setRecordsPanelOpen(tab === "records");
              }}
              code={
                documentFormat === "dbt" ? (
                  <DbtCodePanel open={sourceDrawerOpen} />
                ) : (
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
                    onGoToError={() => {
                      selectDrawerTab("dbml");
                      setSourceDrawerOpen(true);
                    }}
                    onRenameModalOpenChange={setRenameModalOpen}
                  />
                )
              }
              ddl={documentFormat === "dbt" ? <DdlEditor open={sourceDrawerOpen} /> : null}
              records={
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
                  open
                  onOpenChange={(open) => {
                    if (!open) setSourceDrawerOpen(false);
                    setRecordsPanelOpen(open);
                  }}
                />
              }
              diff={
                documentFormat === "dbt" ? (
                  <DbtFileDiff open={activeDrawerTab === "diff"} />
                ) : (
                  <DbmlDiff
                    open={activeDrawerTab === "diff"}
                    saved={savedDbml}
                    working={dbml}
                    onClose={() => setSourceDrawerOpen(false)}
                  />
                )
              }
            />
          }
          statusbar={
            <StatusBar
              problemCount={modelIssues.length}
              density={density}
              dbmlOpen={
                sourceDrawerOpen && (activeDrawerTab === "dbml" || activeDrawerTab === "dbt")
              }
              recordsOpen={sourceDrawerOpen && activeDrawerTab === "records"}
              problemsContent={
                <ProblemsPanel
                  variant="content"
                  issues={modelIssues}
                  onFocusTable={focusTableWithPan}
                  onGoToLine={(line) => {
                    selectDrawerTab(codeTab);
                    goToLine(line);
                  }}
                  open={problemsOpen}
                  onOpenChange={(open) => {
                    setProblemsOpen(open);
                    setProblemsPanelOpen(open);
                  }}
                />
              }
              problemsOpen={problemsOpen}
              onProblemsOpenChange={(open) => {
                setProblemsOpen(open);
                setProblemsPanelOpen(open);
              }}
              statusLog={<StatusLog status={status} saveState={saveState} logs={logs} />}
              onDbmlToggle={() => toggleDrawer(codeTab)}
              onRecordsToggle={() => toggleDrawer("records")}
              onDensityChange={setDensity}
            />
          }
        />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} context={commandContext} />
        <ShortcutsOverlay open={helpOpen} onOpenChange={setHelpOpen} context={commandContext} />
      </div>
    </CanvasActionsCtx.Provider>
  );
}

function WorkspaceDrawer({
  open,
  tab,
  onTab,
  format,
  code,
  ddl,
  records,
  diff,
}: {
  open: boolean;
  tab: DrawerTab;
  onTab: (tab: DrawerTab) => void;
  format: "dbml" | "dbt";
  code: ReactNode;
  ddl: ReactNode;
  records: ReactNode;
  diff: ReactNode;
}) {
  const { t } = useTranslation();
  const dbt = format === "dbt";
  if (!open) return null;
  return (
    <div
      data-testid="workspace-drawer"
      className="flex max-h-[50vh] min-h-0 w-full flex-col border-t border-border bg-card pl-[46px]"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => onTab(value as DrawerTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="h-8 w-full justify-start rounded-none bg-transparent px-2">
          {dbt ? (
            <>
              <TabsTrigger value="dbt" data-testid="drawer-tab-dbt" className="text-xs">
                {t("shell.dbtTab")}
              </TabsTrigger>
              <TabsTrigger value="ddl" data-testid="drawer-tab-ddl" className="text-xs">
                {t("shell.ddl")}
              </TabsTrigger>
            </>
          ) : (
            <TabsTrigger value="dbml" data-testid="drawer-tab-dbml" className="text-xs">
              {t("shell.dbml")}
            </TabsTrigger>
          )}
          <TabsTrigger value="records" data-testid="drawer-tab-records" className="text-xs">
            {t("shell.records")}
          </TabsTrigger>
          <TabsTrigger value="diff" data-testid="drawer-tab-diff" className="text-xs">
            {t("shell.diff")}
          </TabsTrigger>
        </TabsList>
        {dbt ? (
          <>
            <TabsContent value="dbt" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {tab === "dbt" ? code : null}
            </TabsContent>
            <TabsContent value="ddl" className="mt-0 min-h-0 flex-1 overflow-hidden">
              {tab === "ddl" ? ddl : null}
            </TabsContent>
          </>
        ) : (
          <TabsContent value="dbml" className="mt-0 min-h-0 flex-1 overflow-hidden">
            {tab === "dbml" ? code : null}
          </TabsContent>
        )}
        <TabsContent value="records" className="mt-0 min-h-0 flex-1 overflow-auto">
          {tab === "records" ? records : null}
        </TabsContent>
        <TabsContent value="diff" className="mt-0 min-h-0 flex-1 overflow-auto">
          {tab === "diff" ? diff : null}
        </TabsContent>
      </Tabs>
    </div>
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
        } else if (item === "layers") {
          setTreeCollapsed(false);
          onLayers();
        } else if (item === "lineage") onLineage();
        else if (item === "code") onCode();
        else if (item === "search") onSearch();
        else onSettings();
      }}
    />
  );
}
