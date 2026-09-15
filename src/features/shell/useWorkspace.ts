import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { CanvasActions, TableMeta } from "@/features/canvas/actions";
import type { CommandContext } from "@/features/command-palette/actions";
import {
  autolayoutLineagePositions,
  autolayoutPositions,
} from "@/features/canvas/utils/autolayout";
import { lodStateForLevel } from "@/features/canvas/utils/lod";
import { defaultTablePosition } from "@/features/canvas/utils/defaultTablePosition";
import {
  allTablesPage,
  buildCanvasViewModel,
  defaultExternalStubPosition,
  isExternalStubNodeId,
  layoutExternalStubsOnTop,
  pagesFromTableGroups,
  stubsWithLinkCounts,
} from "@/features/canvas/utils/pageFilter";
import {
  ALL_PAGE_ID,
  LARGE_DIAGRAM_HINT,
  PAGE_WIZARD_THRESHOLD,
} from "@/features/canvas/utils/scaleLimits";
import { loadRecordsOpen } from "@/features/panels/RecordsPanel";
import type { StatusLogEntry } from "@/features/panels/StatusLog";
import { splitDbmlBlocks } from "@/features/schema/model/blocks";
import {
  addColumn,
  addFieldLineageEntry,
  addLayerGroup,
  appendRef,
  removeFieldLineageEntry,
  removeRef,
  removeTable,
  renameColumnAllRefs,
  renameTable,
  setGroupColor,
  setTableColor,
  setTableLayer,
  updateFieldLineageEntry,
} from "@/features/schema/model/edit";
import { tableLineageFrom } from "@/features/schema/model/lineage";
import { exportInputL2Warning } from "@/features/schema/model/exportWarnings";
import { layerColorOf, layersFromGroups, tableLayerMap } from "@/features/schema/model/layers";
import { lineOfTable, resolveTableId, tableAtLine } from "@/features/schema/model/lineLocate";
import { organize } from "@/features/schema/model/organize";
import {
  findDuplicateColumnName,
  findDuplicateTableId,
  METADATA_SNIPPET,
  newTableTemplate,
  parseDbml,
  type ParseResult,
} from "@/features/schema/model/parse";
import { pinnedCreatedMessage } from "@/features/schema/model/projectMessages";
import { validateModel } from "@/features/schema/model/validateModel";
import { useSchemaStore } from "@/features/schema/store";
import type { Snapshot } from "@/features/schema/store/documentSlice";
import {
  shouldPanToTable,
  shouldSyncCursorLine,
  shouldSyncEditorTable,
  type FocusTableOptions,
} from "@/features/source/syncEditorCanvas";
import type { SourceDrawerHandle } from "@/features/source/SourceDrawer";
import * as api from "@/infrastructure/api";
import type { DomainMeta, ExportFormat, LineageLink } from "@/infrastructure/api";
import {
  buildNodeExtras,
  EMPTY_PARSE,
  externalLinksMap,
  hydrateFromProject,
  loadStatusMessage,
  SAMPLE_DBML,
  useStable,
} from "@/features/shell/workspaceModel";
import { fromDbtProject, toDisplayDbml, toParseResult } from "@/features/dbt-source";
import type { DbtAction } from "@/features/dbt-source/mutations";
import { pinnedByTableFromList } from "@/features/schema/model/dbmlClean";
import { toast } from "sonner";
import i18n from "@/i18n";

function loadStoredFlag(key: string, fallback: boolean): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return fallback;
  }
}

export type WorkspaceProps = {
  domain?: DomainMeta;
  onBackToDomains?: () => void;
  onRepoChanged?: () => void;
};

export type RailItemId = "tables" | "layers" | "lineage" | "code" | "search" | "settings";

export type WorkspaceController = ReturnType<typeof useWorkspace>;

export function useWorkspace({ domain, onBackToDomains, onRepoChanged }: WorkspaceProps) {
  const dbml = useSchemaStore((s) => s.dbml);
  const positions = useSchemaStore((s) => s.positions);
  const sizes = useSchemaStore((s) => s.sizes);
  const colors = useSchemaStore((s) => s.colors);
  const collapsedGroups = useSchemaStore((s) => s.collapsedGroups);
  const canvasPages = useSchemaStore((s) => s.canvasPages);
  const activePageIds = useSchemaStore((s) => s.activePageIds);
  const past = useSchemaStore((s) => s.past);
  const future = useSchemaStore((s) => s.future);
  const saveState = useSchemaStore((s) => s.saveState);
  const autoSave = useSchemaStore((s) => s.autoSave);
  const currentProjectId = useSchemaStore((s) => s.currentProjectId);
  const projects = useSchemaStore((s) => s.projects);
  const pinnedProjectId = useSchemaStore((s) => s.pinnedProjectId);

  const [status, setStatus] = useState("Carregando…");
  const [logs, setLogs] = useState<StatusLogEntry[]>([]);
  const pushStatus = useCallback((msg: string) => {
    setStatus(msg);
    if (msg) setLogs((l) => [{ ts: Date.now(), msg }, ...l].slice(0, 100));
  }, []);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [layersPanelCollapsed, setLayersPanelCollapsed] = useState(() =>
    loadStoredFlag("localdrawdb.layersPanelCollapsed", false),
  );
  const [recordsPanelOpen, setRecordsPanelOpen] = useState(() => loadRecordsOpen());
  const [problemsPanelOpen, setProblemsPanelOpen] = useState(false);
  const [focusTableId, setFocusTableId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [fitViewTrigger, setFitViewTrigger] = useState(0);
  const [pageWizardOpen, setPageWizardOpen] = useState(false);
  const [pageWizardTableCount, setPageWizardTableCount] = useState(0);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [railItem, setRailItem] = useState<RailItemId>("tables");
  const [committedDbml, setCommittedDbml] = useState("");
  const [savedDbml, setSavedDbml] = useState("");
  const [density, setDensity] = useState<"compact" | "cozy">("cozy");

  const loadedRef = useRef(false);
  const prevDbmlRef = useRef("");
  const editorRef = useRef<SourceDrawerHandle | null>(null);
  const assignEditorRef = useCallback((handle: SourceDrawerHandle | null) => {
    editorRef.current = handle;
  }, []);
  const baselineRef = useRef<Snapshot | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastPanTableRef = useRef<string | null>(null);
  const editorCursorLineRef = useRef(-1);
  const editingTableRef = useRef<string | null>(null);

  const dbtParsed = useSchemaStore((s) => s.dbtParsed);
  const dbtPersistGen = useSchemaStore((s) => s.dbtPersistGen);
  const dbtProblems = useSchemaStore((s) => s.dbtProblems);
  const selectColumn = useSchemaStore((s) => s.selectColumn);

  const runDbt = useCallback((action: DbtAction): boolean => {
    const s = useSchemaStore.getState();
    if (s.documentFormat !== "dbt") return false;
    s.applyDbtOp(action);
    return true;
  }, []);

  const guardReadOnly = useCallback((): boolean => {
    if (!useSchemaStore.getState().readOnly) return false;
    toast.message(i18n.t("shell.dbtReadOnly"));
    return true;
  }, []);

  const applyHydrated = useCallback(
    (p: api.Project, projectId: string, statusOverride?: string) => {
      const store = useSchemaStore.getState();
      if (p.format === "dbt") {
        const slug = store.projects.find((proj) => proj.id === projectId)?.slug;
        if (!slug) {
          pushStatus("Projeto dbt sem slug — não foi possível hidratar");
          return;
        }
        const model = fromDbtProject(p.files, slug);
        const parsed0 = toParseResult(model);
        const dbml0 = toDisplayDbml(model);
        const pos0 = model.canvas?.positions ?? {};
        const groupPages = pagesFromTableGroups(parsed0);
        const pages0 = groupPages.length ? [allTablesPage(), ...groupPages] : [allTablesPage()];
        startTransition(() => {
          store.hydrateDocument({
            dbml: dbml0,
            positions: pos0,
            sizes: api.normalizeSizes(model.canvas?.sizes),
            colors: model.colors,
            collapsedGroups: model.canvas?.collapsedGroups ?? [],
            canvasPages: pages0,
            activePageIds: [ALL_PAGE_ID],
            currentProjectId: projectId || store.currentProjectId,
            pinnedByTable: pinnedByTableFromList(model.pins),
            readOnly: false,
            files: p.files,
            documentFormat: "dbt",
            dbtProject: slug,
            dbtParsed: parsed0,
          });
          store.setAutoSave(true);
        });
        prevDbmlRef.current = dbml0;
        setCommittedDbml(dbml0);
        setSavedDbml(dbml0);
        baselineRef.current = { dbml: dbml0, positions: pos0, colors: model.colors };
        pushStatus(loadStatusMessage(parsed0.tables.length, [ALL_PAGE_ID], statusOverride));
        store.setSaveState("saved");
        store.setHydratedProjectId(projectId);
        return;
      }
      const loaded = hydrateFromProject({ dbml: p.dbml, canvas: p.canvas }, projectId);
      startTransition(() => {
        store.hydrateDocument({
          dbml: loaded.dbml,
          positions: loaded.positions,
          sizes: api.normalizeSizes(loaded.sizes),
          colors: loaded.colors,
          collapsedGroups: loaded.collapsedGroups,
          canvasPages: loaded.pages0,
          activePageIds: loaded.active0,
          currentProjectId: loaded.projectId || store.currentProjectId,
          pinnedByTable: loaded.pinnedByTable,
          readOnly: false,
          documentFormat: "dbml",
          files: {},
          dbtProject: "",
          dbtParsed: null,
        });
      });
      prevDbmlRef.current = loaded.dbml;
      setCommittedDbml(loaded.dbml);
      setSavedDbml(loaded.dbml);
      baselineRef.current = loaded.snapshot;
      pushStatus(loadStatusMessage(loaded.tableCount, loaded.active0, statusOverride));
      store.setSaveState("saved");
      store.setHydratedProjectId(projectId);
    },
    [pushStatus],
  );

  useEffect(() => {
    try {
      localStorage.setItem("localdrawdb.layersPanelCollapsed", layersPanelCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [layersPanelCollapsed]);

  useEffect(() => {
    let cancelled = false;
    api
      .listProjects()
      .then(async ({ activeId, projects: list }) => {
        if (cancelled) return;
        const store = useSchemaStore.getState();
        store.setProjects(list);
        store.setCurrentProjectId(activeId);
        const p = await api.loadProjectById(activeId);
        if (cancelled) return;
        applyHydrated(p, activeId);
      })
      .catch(() => {
        api
          .loadProject()
          .then((p) => {
            if (cancelled) return;
            applyHydrated(p, useSchemaStore.getState().currentProjectId);
          })
          .catch(() => {
            if (cancelled) return;
            applyHydrated(
              { dbml: SAMPLE_DBML, canvas: {} },
              "",
              "Backend offline — editando localmente",
            );
          });
      })
      .finally(() => {
        loadedRef.current = true;
      });
    api
      .getMeta()
      .then((m) => {
        if (!cancelled) useSchemaStore.getState().setPinnedProjectId(m.pinnedProjectId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applyHydrated]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (useSchemaStore.getState().documentFormat === "dbt") return;
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      const base = baselineRef.current;
      const cur: Snapshot = { dbml, positions, colors };
      if (
        base &&
        (base.dbml !== cur.dbml || base.positions !== cur.positions || base.colors !== cur.colors)
      ) {
        useSchemaStore.getState().pushHistory(base);
        baselineRef.current = cur;
      }
    }, 400);
    return () => clearTimeout(commitTimer.current);
  }, [dbml, positions, colors]);

  const undo = useCallback(() => {
    clearTimeout(commitTimer.current);
    const s = useSchemaStore.getState();
    if (s.documentFormat === "dbt") {
      s.undo();
      prevDbmlRef.current = useSchemaStore.getState().dbml;
      setCommittedDbml(useSchemaStore.getState().dbml);
      return;
    }
    if (!s.past.length) return;
    const prev = s.past[s.past.length - 1];
    s.undo();
    prevDbmlRef.current = prev.dbml;
    setCommittedDbml(prev.dbml);
    baselineRef.current = prev;
  }, []);

  const redo = useCallback(() => {
    clearTimeout(commitTimer.current);
    const s = useSchemaStore.getState();
    if (s.documentFormat === "dbt") {
      s.redo();
      prevDbmlRef.current = useSchemaStore.getState().dbml;
      setCommittedDbml(useSchemaStore.getState().dbml);
      return;
    }
    if (!s.future.length) return;
    const next = s.future[0];
    s.redo();
    prevDbmlRef.current = next.dbml;
    setCommittedDbml(next.dbml);
    baselineRef.current = next;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (useSchemaStore.getState().readOnly) return;
    useSchemaStore.getState().setSaveState((s) => {
      if (s === "saving" || s === "saved") return s;
      return "dirty";
    });
  }, [dbml, positions, sizes, colors, collapsedGroups, canvasPages, activePageIds]);

  const handleSave = useCallback((explicitDbml?: string) => {
    if (useSchemaStore.getState().readOnly) {
      toast.message(i18n.t("shell.dbtReadOnly"));
      return;
    }
    const s = useSchemaStore.getState();
    if (s.documentFormat === "dbt") {
      s.setSaveState("saved");
      return;
    }
    s.setSaveState("saving");
    const dbmlToSave = explicitDbml !== undefined ? explicitDbml : s.dbml;
    const canvas = {
      positions: s.positions,
      sizes: s.sizes,
      colors: s.colors,
      collapsedGroups: s.collapsedGroups,
      pages: s.canvasPages,
      activePageIds: s.activePageIds,
    };
    const saveCall = s.currentProjectId
      ? api.saveProjectById(s.currentProjectId, dbmlToSave, canvas)
      : api.saveProject(dbmlToSave, canvas);
    saveCall
      .then(() => {
        const now = useSchemaStore.getState();
        now.setSaveState("saved");
        setSavedDbml(dbmlToSave);
        baselineRef.current = { dbml: dbmlToSave, positions: now.positions, colors: now.colors };
      })
      .catch(() => useSchemaStore.getState().setSaveState("error"));
  }, []);

  useEffect(() => {
    if (!autoSave || saveState !== "dirty") return;
    const id = setTimeout(() => handleSave(), 1500);
    return () => clearTimeout(id);
  }, [autoSave, saveState, handleSave]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const id = setTimeout(() => useSchemaStore.getState().setSaveState("idle"), 1500);
    return () => clearTimeout(id);
  }, [saveState]);

  const parsed = useMemo(() => dbtParsed ?? parseDbml(dbml), [dbml, dbtParsed]);
  const dbmlBlocks = useMemo(() => splitDbmlBlocks(dbml), [dbml]);
  const dbmlDeferred = useDeferredValue(dbml);
  const parsedDeferred = useMemo(
    () => dbtParsed ?? parseDbml(dbmlDeferred),
    [dbmlDeferred, dbtParsed],
  );
  const canvasParsePending = dbml !== dbmlDeferred;

  const [canvasModel, setCanvasModel] = useState<ParseResult>(EMPTY_PARSE);
  useEffect(() => {
    if (!parsed.error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- last valid parse; render-time setState tripped ResizeObserver on undo
      setCanvasModel(parsed);
    }
  }, [parsed]);

  const [canvasModelDeferred, setCanvasModelDeferred] = useState<ParseResult>(EMPTY_PARSE);
  useEffect(() => {
    if (!parsedDeferred.error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- same last-good-parse hold for the deferred canvas model
      setCanvasModelDeferred(parsedDeferred);
    }
  }, [parsedDeferred]);

  const activeModel = useMemo(() => (parsed.error ? canvasModel : parsed), [parsed, canvasModel]);
  const canvasBaseModel = useMemo(
    () => (parsedDeferred.error ? canvasModelDeferred : parsedDeferred),
    [parsedDeferred, canvasModelDeferred],
  );
  const canvasView = useMemo(
    () => buildCanvasViewModel(canvasBaseModel, canvasPages, activePageIds),
    [canvasBaseModel, canvasPages, activePageIds],
  );
  const canvasActiveModel = canvasView.model;
  const canvasStubs = useMemo(
    () => stubsWithLinkCounts(canvasView.stubs, canvasView.crossRefs),
    [canvasView.stubs, canvasView.crossRefs],
  );
  const externalLinksByTable = useMemo(
    () => externalLinksMap(canvasView.crossRefs, canvasView.stubs),
    [canvasView.crossRefs, canvasView.stubs],
  );

  const tableIdsKey = useMemo(
    () => activeModel.tables.map((t) => t.id).join("\0"),
    [activeModel.tables],
  );

  useEffect(() => {
    const ids = new Set(activeModel.tables.map((t) => t.id));
    useSchemaStore.getState().setPositions((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of Object.keys(next)) {
        if (!ids.has(id) && !isExternalStubNodeId(id)) {
          delete next[id];
          changed = true;
        }
      }
      activeModel.tables.forEach((t, i) => {
        if (next[t.id]) return;
        next[t.id] = defaultTablePosition(next, i);
        changed = true;
      });
      return changed ? next : prev;
    });
    useSchemaStore.getState().setColors((prev) => {
      const stale = Object.keys(prev).filter((id) => !ids.has(id));
      if (!stale.length) return prev;
      const next = { ...prev };
      for (const id of stale) delete next[id];
      return next;
    });
  }, [activeModel.tables]);

  useEffect(() => {
    if (!canvasView.stubs.length) return;
    useSchemaStore.getState().setPositions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const stub of canvasStubs) {
        if (next[stub.id]) continue;
        next[stub.id] = defaultExternalStubPosition(stub.id, canvasView.crossRefs, next);
        changed = true;
      }
      const stubIds = new Set(canvasStubs.map((s) => s.id));
      for (const id of Object.keys(next)) {
        if (isExternalStubNodeId(id) && !stubIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [canvasStubs, canvasView.crossRefs, canvasView.stubs.length]);

  const markCommitted = useCallback((next: string) => {
    prevDbmlRef.current = next;
    setCommittedDbml(next);
  }, []);

  useEffect(() => {
    const s = useSchemaStore.getState();
    if (s.documentFormat !== "dbt" || !s.currentProjectId) return;
    const changes = s.lastDbtChanges;
    if (!changes || !Object.keys(changes).length) return;
    s.setSaveState("saving");
    void api
      .saveDbtChanges(s.currentProjectId, changes)
      .then(() => useSchemaStore.getState().setSaveState("saved"))
      .catch(() => useSchemaStore.getState().setSaveState("error"));
  }, [dbtPersistGen]);

  const mutateDbml = useCallback(
    (fn: (d: string) => string) => {
      if (useSchemaStore.getState().documentFormat === "dbt") return;
      if (guardReadOnly()) return;
      useSchemaStore.getState().setDbml((d) => {
        const next = fn(d);
        prevDbmlRef.current = next;
        setCommittedDbml(next);
        return next;
      });
    },
    [guardReadOnly],
  );

  const modelIssues = useMemo(() => {
    const issues = validateModel(activeModel, dbml, dbmlBlocks);
    const parseIssues = parsed.error
      ? [{ severity: "error" as const, message: parsed.error, line: parsed.errorLine }]
      : [];
    const fromImport = importWarnings.map((message) => ({
      severity: "error" as const,
      message,
    }));
    const dbt = dbtProblems.map((message) => ({ severity: "error" as const, message }));
    return [...parseIssues, ...fromImport, ...issues, ...dbt];
  }, [activeModel, dbml, dbmlBlocks, parsed.error, parsed.errorLine, importWarnings, dbtProblems]);

  const pruneCanvasState = useCallback((removedIds: string[]) => {
    const gone = new Set(removedIds);
    useSchemaStore.getState().setPositions((prev) => {
      const next = { ...prev };
      for (const id of gone) delete next[id];
      return next;
    });
    useSchemaStore.getState().setColors((prev) => {
      const next = { ...prev };
      for (const id of gone) delete next[id];
      return next;
    });
    const st = useSchemaStore.getState();
    if (st.selectedTable && gone.has(st.selectedTable)) st.selectTable(null);
    const nextIds = st.selectedTableIds.filter((id) => !gone.has(id));
    if (nextIds.length !== st.selectedTableIds.length) {
      if (nextIds.length) st.setSelectedTableIds(nextIds);
      else st.clearCanvasSelection();
    }
    if (
      st.focusedFieldMapping &&
      (gone.has(st.focusedFieldMapping.sourceTable) || gone.has(st.focusedFieldMapping.targetTable))
    ) {
      st.setFocusedFieldMapping(null);
    }
    setFocusTableId((id) => (id && gone.has(id) ? null : id));
  }, []);

  const migrateTableId = useCallback((oldId: string, newId: string) => {
    useSchemaStore.getState().setPositions((prev) => {
      if (!prev[oldId]) return prev;
      const next = { ...prev };
      next[newId] = prev[oldId];
      delete next[oldId];
      return next;
    });
    useSchemaStore.getState().setColors((prev) => {
      if (!prev[oldId]) return prev;
      const next = { ...prev };
      next[newId] = prev[oldId];
      delete next[oldId];
      return next;
    });
    const st = useSchemaStore.getState();
    if (st.selectedTable === oldId) st.selectTable(newId);
    else if (st.selectedTableIds.includes(oldId)) {
      st.setSelectedTableIds(st.selectedTableIds.map((id) => (id === oldId ? newId : id)));
    }
    if (
      st.focusedFieldMapping?.sourceTable === oldId ||
      st.focusedFieldMapping?.targetTable === oldId
    ) {
      st.setFocusedFieldMapping(null);
    }
  }, []);

  const handleDbmlChange = useCallback(
    (next: string) => {
      if (useSchemaStore.getState().documentFormat === "dbt") return;
      if (guardReadOnly()) return;
      useSchemaStore.getState().setDbml(next);
    },
    [guardReadOnly],
  );

  const goToLine = useCallback((line: number) => {
    setSourceDrawerOpen(true);
    requestAnimationFrame(() => editorRef.current?.goToLine(line));
  }, []);

  const goToColumn = useCallback((table: string, column: string) => {
    setSourceDrawerOpen(true);
    requestAnimationFrame(() => editorRef.current?.goToColumn(table, column));
  }, []);

  const clearFocusTable = useCallback(() => setFocusTableId(null), []);

  const focusTable = useCallback((tableId: string, options?: FocusTableOptions) => {
    setFocusTableId(tableId);
    useSchemaStore.getState().selectTable(tableId);
    if (shouldPanToTable(lastPanTableRef.current, tableId, options)) {
      lastPanTableRef.current = tableId;
      setFocusNonce((n) => n + 1);
    }
  }, []);

  const focusTableWithPan = useCallback(
    (tableId: string) => focusTable(tableId, { pan: true }),
    [focusTable],
  );

  const focusTableInEditor = useCallback(
    (tableId: string) => {
      focusTableWithPan(tableId);
      setSourceDrawerOpen(true);
      const line = lineOfTable(useSchemaStore.getState().dbml, tableId);
      if (line == null) return;
      let attempt = 0;
      const tryGo = () => {
        if (editorRef.current) {
          editorRef.current.goToLine(line);
          return;
        }
        if (++attempt < 8) requestAnimationFrame(tryGo);
      };
      requestAnimationFrame(tryGo);
    },
    [focusTableWithPan],
  );

  const syncCanvasToEditorLine = useCallback(
    (line0: number) => {
      if (!shouldSyncCursorLine(line0)) return;
      if (!sourceDrawerOpen) return;
      editorCursorLineRef.current = line0;
      const blockName = tableAtLine(dbml, line0);
      if (!blockName) return;
      const tableIds = activeModel.tables.map((t) => t.id);
      const tableId = resolveTableId(blockName, tableIds);
      if (!tableId || !shouldSyncEditorTable(editingTableRef.current, tableId)) return;
      editingTableRef.current = tableId;
      focusTable(tableId);
    },
    [dbml, activeModel.tables, sourceDrawerOpen, focusTable],
  );

  const handleEditorCursorLine = useCallback(
    (line0: number) => syncCanvasToEditorLine(line0),
    [syncCanvasToEditorLine],
  );

  useEffect(() => {
    syncCanvasToEditorLine(editorCursorLineRef.current);
  }, [tableIdsKey, syncCanvasToEditorLine]);

  const handleAutolayout = useCallback(() => {
    const lineageMode = useSchemaStore.getState().lineageMode;
    const lodState = lodStateForLevel(useSchemaStore.getState().detailLevel);
    const layoutModel = activePageIds.includes(ALL_PAGE_ID) ? canvasBaseModel : canvasActiveModel;
    const base = lineageMode
      ? autolayoutLineagePositions(layoutModel, density, lodState)
      : autolayoutPositions(layoutModel, false, density, lodState);
    const next = canvasStubs.length ? layoutExternalStubsOnTop(base, canvasStubs) : base;
    useSchemaStore.getState().setPositions(next);
    setFitViewTrigger((n) => n + 1);
    pushStatus(
      lineageMode
        ? `Canvas reorganizado para linhagem (${layoutModel.tables.length} tabelas)`
        : canvasStubs.length
          ? `Canvas reorganizado (${layoutModel.tables.length} tabelas, ${canvasStubs.length} grupo(s) externo(s) no topo)`
          : `Canvas reorganizado (${layoutModel.tables.length} tabelas)`,
    );
    useSchemaStore.getState().setSaveState("dirty");
  }, [activePageIds, canvasBaseModel, canvasActiveModel, canvasStubs, density, pushStatus]);

  const lineage = useMemo<LineageLink[]>(() => {
    const out: LineageLink[] = [];
    for (const entry of tableLineageFrom(activeModel.lineageFields ?? [])) {
      for (const s of entry.sources) out.push({ source: s, target: entry.target });
    }
    return out;
  }, [activeModel.lineageFields]);

  const canvasLineage = useMemo<LineageLink[]>(() => {
    const out: LineageLink[] = [];
    for (const entry of tableLineageFrom(canvasActiveModel.lineageFields ?? [])) {
      for (const s of entry.sources) out.push({ source: s, target: entry.target });
    }
    return out;
  }, [canvasActiveModel.lineageFields]);

  const tableGroupsKey = useMemo(() => {
    const groups = new Set<string>();
    let ungrouped = false;
    for (const t of activeModel.tables) {
      if (t.group) groups.add(t.group);
      else ungrouped = true;
    }
    return `${[...groups].sort().join("\0")}|${ungrouped ? 1 : 0}`;
  }, [activeModel.tables]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const groupPages = pagesFromTableGroups(activeModel);
    if (!groupPages.length) return;
    useSchemaStore.getState().setCanvasPages((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      let changed = false;
      const next = [...prev];
      if (!ids.has(ALL_PAGE_ID)) {
        next.unshift(allTablesPage());
        changed = true;
      }
      for (const gp of groupPages) {
        if (!ids.has(gp.id)) {
          next.push(gp);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tableGroupsKey, activeModel]);

  const layersArr = useStable(
    useMemo(() => layersFromGroups(activeModel.layerGroups), [activeModel.layerGroups]),
  );
  const layerMembership = useStable(
    useMemo(() => tableLayerMap(activeModel.layerGroups), [activeModel.layerGroups]),
  );
  const layerOf = useCallback(
    (id: string) => {
      if (layerMembership[id]) return layerMembership[id];
      const schema = id.includes(".") ? id.split(".")[0] : undefined;
      return schema && layersArr.some((l) => l.id === schema) ? schema : undefined;
    },
    [layerMembership, layersArr],
  );

  const handleRemoveTable = useCallback(
    (tableId: string) => {
      if (runDbt({ op: "removeTable", tableId })) {
        pruneCanvasState([tableId]);
        pushStatus(`Tabela removida: ${tableId}`);
        return;
      }
      mutateDbml((d) => removeTable(d, tableId));
      pruneCanvasState([tableId]);
      pushStatus(`Tabela removida: ${tableId}`);
      useSchemaStore.getState().setSaveState("dirty");
    },
    [mutateDbml, pruneCanvasState, pushStatus, runDbt],
  );

  const handleRemoveTables = useCallback(
    (tableIds: string[]) => {
      if (!tableIds.length) return;
      if (useSchemaStore.getState().documentFormat === "dbt") {
        for (const id of tableIds) runDbt({ op: "removeTable", tableId: id });
        pruneCanvasState(tableIds);
        pushStatus(`${tableIds.length} tabela(s) removida(s)`);
        return;
      }
      mutateDbml((d) => tableIds.reduce((acc, id) => removeTable(acc, id), d));
      pruneCanvasState(tableIds);
      pushStatus(`${tableIds.length} tabela(s) removida(s)`);
      useSchemaStore.getState().setSaveState("dirty");
    },
    [mutateDbml, pruneCanvasState, pushStatus, runDbt],
  );

  const colorsRef = useRef(colors);
  const modelRef = useRef(activeModel);
  const lineageRef = useRef(lineage);
  const layersArrRef = useRef(layersArr);
  const layerMembershipRef = useRef<Record<string, string>>(layerMembership);
  useLayoutEffect(() => {
    colorsRef.current = colors;
    modelRef.current = activeModel;
    lineageRef.current = lineage;
    layersArrRef.current = layersArr;
    layerMembershipRef.current = layerMembership;
  });

  const nodeExtras = useMemo(
    () =>
      buildNodeExtras({
        model: canvasActiveModel,
        canvasLineage,
        colors,
        layers: layersArr,
        layerOf,
        externalLinksByTable,
      }),
    [canvasActiveModel, canvasLineage, colors, layersArr, layerOf, externalLinksByTable],
  );

  const actions = useMemo<CanvasActions>(
    () => ({
      onSelectColumn: (table, column) => selectColumn({ table, column }),
      onRenameColumn: (table, oldName, newName) => {
        if (guardReadOnly()) return;
        const trimmed = newName.trim();
        const existing =
          modelRef.current.tables
            .find((t) => t.id === table)
            ?.columns.map((c) => c.name)
            .filter((n) => n !== oldName) ?? [];
        const dup = findDuplicateColumnName(trimmed, existing);
        if (dup) {
          pushStatus(`Coluna "${dup}" já existe em "${table}" — escolha outro nome.`);
          return;
        }
        if (runDbt({ op: "renameColumn", tableId: table, oldName, newName: trimmed })) {
          const sel = useSchemaStore.getState().selectedColumn;
          if (sel?.table === table && sel?.column === oldName) {
            selectColumn({ table, column: trimmed });
          }
          return;
        }
        useSchemaStore.getState().setDbml((d) => {
          const next = renameColumnAllRefs(d, table, oldName, trimmed);
          prevDbmlRef.current = next;
          setCommittedDbml(next);
          return next;
        });
        const sel = useSchemaStore.getState().selectedColumn;
        if (sel?.table === table && sel?.column === oldName) {
          selectColumn({ table, column: trimmed });
        }
      },
      onGoToColumn: goToColumn,
      onRenameTable: (tableId, newName) => {
        if (guardReadOnly()) return;
        const trimmed = newName.trim();
        const dup = findDuplicateTableId(
          trimmed,
          modelRef.current.tables.map((t) => t.id).filter((id) => id !== tableId),
        );
        if (dup) {
          pushStatus(`Tabela "${dup}" já existe — escolha outro nome.`);
          return;
        }
        if (runDbt({ op: "renameTable", tableId, newId: trimmed })) {
          migrateTableId(tableId, trimmed);
          return;
        }
        useSchemaStore.getState().setDbml((d) => {
          const next = renameTable(d, tableId, trimmed);
          prevDbmlRef.current = next;
          setCommittedDbml(next);
          return next;
        });
        migrateTableId(tableId, trimmed);
      },
      onRemoveTable: handleRemoveTable,
      onAddColumn: (table, name, dataType) => {
        if (guardReadOnly()) return;
        const colName = name?.trim() || "nova_coluna";
        const colType = dataType?.trim() || "string";
        if (runDbt({ op: "addColumn", tableId: table, name: colName, dataType: colType })) return;
        useSchemaStore.getState().setDbml((d) => addColumn(d, table, colName, colType));
      },
      onRemoveColumn: (table, column) => {
        if (guardReadOnly()) return;
        if (runDbt({ op: "removeColumn", tableId: table, column })) return;
      },
      colorOf: (id) => colorsRef.current[id],
      onSetColor: (id, color) => {
        if (guardReadOnly()) return;
        if (runDbt({ op: "setColor", key: id, color })) return;
        useSchemaStore.getState().setDbml((d) => setTableColor(d, id, color));
      },
      onSetGroupColor: (group, color) => {
        if (guardReadOnly()) return;
        if (runDbt({ op: "setColor", key: group, color })) return;
        useSchemaStore.getState().setDbml((d) => setGroupColor(d, group, color));
      },
      onResizeTable: (id, width, height) => {
        if (
          runDbt({
            op: "setSize",
            tableId: id,
            size: {
              width: Math.round(width),
              ...(height != null ? { height: Math.round(height) } : {}),
            },
          })
        ) {
          return;
        }
        useSchemaStore.getState().setSizes((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            width: Math.round(width),
            ...(height != null ? { height: Math.round(height) } : {}),
          },
        }));
      },
      layerOf: (id) => {
        const membership = layerMembershipRef.current;
        if (membership[id]) return membership[id];
        const arr = layersArrRef.current;
        const schema = id.includes(".") ? id.split(".")[0] : undefined;
        return schema && arr.some((l) => l.id === schema) ? schema : undefined;
      },
      layerColorOf: (layerId) => layerColorOf(layersArrRef.current, layerId),
      onSetLayer: (id, layerId) => {
        if (guardReadOnly()) return;
        if (runDbt({ op: "setLayer", tableId: id, layer: layerId })) return;
        useSchemaStore
          .getState()
          .setDbml((d) =>
            setTableLayer(d, id, layerId, layerColorOf(layersArrRef.current, layerId ?? undefined)),
          );
      },
      layers: layersArr,
      onAddLayer: (name, color) => {
        if (guardReadOnly()) return;
        if (runDbt({ op: "addLayerGroup" })) return;
        useSchemaStore.getState().setDbml((d) => addLayerGroup(d, name, color));
      },
      onToggleGroup: (name) => {
        const s = useSchemaStore.getState();
        const next = s.collapsedGroups.includes(name)
          ? s.collapsedGroups.filter((g) => g !== name)
          : [...s.collapsedGroups, name];
        if (runDbt({ op: "setCollapsedGroups", groups: next })) return;
        s.setCollapsedGroups(next);
      },
      tableMeta: (id) => tableMetaOf(id, modelRef, lineageRef),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read refs; layers is the one render-time field
    [layersArr, guardReadOnly, runDbt],
  );

  const handleAddFieldLineage = useCallback(
    (
      sourceTable: string,
      sourceColumn: string,
      targetColumn: string,
      note?: string,
      ref?: string,
    ) => {
      const targetTable = useSchemaStore.getState().selectedTable;
      if (!targetTable) return;
      if (
        runDbt({
          op: "addLineage",
          targetTable,
          targetColumn,
          from: `${sourceTable}.${sourceColumn}`,
          expr: note,
        })
      )
        return;
      mutateDbml((d) =>
        addFieldLineageEntry(d, sourceTable, sourceColumn, targetTable, targetColumn, {
          note,
          ref,
        }),
      );
    },
    [mutateDbml, runDbt],
  );
  const handleCreateFieldLineage = useCallback(
    (sourceTable: string, sourceColumn: string, targetTable: string, targetColumn: string) => {
      if (
        runDbt({
          op: "addLineage",
          targetTable,
          targetColumn,
          from: `${sourceTable}.${sourceColumn}`,
        })
      )
        return;
      mutateDbml((d) =>
        addFieldLineageEntry(d, sourceTable, sourceColumn, targetTable, targetColumn),
      );
    },
    [mutateDbml, runDbt],
  );
  const handleRemoveFieldLineage = useCallback(
    (sourceTable: string, sourceColumn: string, targetTable: string, targetColumn: string) => {
      if (
        runDbt({
          op: "removeLineage",
          targetTable,
          targetColumn,
          from: `${sourceTable}.${sourceColumn}`,
        })
      )
        return;
      mutateDbml((d) =>
        removeFieldLineageEntry(d, sourceTable, sourceColumn, targetTable, targetColumn),
      );
    },
    [mutateDbml, runDbt],
  );
  const handleUpdateFieldLineage = useCallback(
    (
      prev: {
        sourceTable: string;
        sourceColumn: string;
        targetTable: string;
        targetColumn: string;
      },
      next: {
        sourceTable: string;
        sourceColumn: string;
        targetColumn: string;
        note?: string;
        ref?: string;
      },
    ) => {
      const targetTable = useSchemaStore.getState().selectedTable;
      if (!targetTable) return;
      if (
        runDbt({
          op: "updateLineage",
          targetTable,
          targetColumn: prev.targetColumn,
          from: `${prev.sourceTable}.${prev.sourceColumn}`,
          nextFrom: `${next.sourceTable}.${next.sourceColumn}`,
          expr: next.note ?? next.ref,
        })
      )
        return;
      mutateDbml((d) => updateFieldLineageEntry(d, prev, { ...next, targetTable }));
    },
    [mutateDbml, runDbt],
  );
  const handleToggleGroup = useCallback(
    (name: string) => {
      const s = useSchemaStore.getState();
      const next = s.collapsedGroups.includes(name)
        ? s.collapsedGroups.filter((g) => g !== name)
        : [...s.collapsedGroups, name];
      if (runDbt({ op: "setCollapsedGroups", groups: next })) return;
      s.setCollapsedGroups(next);
    },
    [runDbt],
  );

  const handleCreateRef = useCallback(
    (fromTbl: string, fromCol: string, toTbl: string, toCol: string) => {
      if (guardReadOnly()) return;
      if (!fromCol || !toCol) return;
      const fromTable = activeModel.tables.find((t) => t.id === fromTbl);
      const toTable = activeModel.tables.find((t) => t.id === toTbl);
      const fromIsPk = !!fromTable?.columns.find((c) => c.name === fromCol)?.pk;
      const toIsPk = !!toTable?.columns.find((c) => c.name === toCol)?.pk;
      if (fromIsPk && !toIsPk) {
        if (
          runDbt({
            op: "addRef",
            fromTable: toTbl,
            fromCol: toCol,
            toTable: fromTbl,
            toCol: fromCol,
          })
        ) {
          pushStatus(`Relação criada: ${toTbl}.${toCol} → ${fromTbl}.${fromCol}`);
          return;
        }
        mutateDbml((d) => appendRef(d, toTbl, toCol, fromTbl, fromCol));
        pushStatus(`Relação criada: ${toTbl}.${toCol} → ${fromTbl}.${fromCol}`);
      } else {
        if (runDbt({ op: "addRef", fromTable: fromTbl, fromCol, toTable: toTbl, toCol })) {
          pushStatus(`Relação criada: ${fromTbl}.${fromCol} → ${toTbl}.${toCol}`);
          return;
        }
        mutateDbml((d) => appendRef(d, fromTbl, fromCol, toTbl, toCol));
        pushStatus(`Relação criada: ${fromTbl}.${fromCol} → ${toTbl}.${toCol}`);
      }
    },
    [activeModel.tables, mutateDbml, pushStatus, guardReadOnly, runDbt],
  );
  const handleRemoveRef = useCallback(
    (fromTbl: string, fromCol: string, toTbl: string, toCol: string) => {
      if (runDbt({ op: "removeRef", fromTable: fromTbl, fromCol, toTable: toTbl, toCol })) {
        pushStatus(`Relação removida: ${fromTbl}.${fromCol} → ${toTbl}.${toCol}`);
        return;
      }
      mutateDbml((d) => removeRef(d, fromTbl, fromCol, toTbl, toCol));
      pushStatus(`Relação removida: ${fromTbl}.${fromCol} → ${toTbl}.${toCol}`);
    },
    [mutateDbml, pushStatus, runDbt],
  );
  const handleRemoveSelectedRef = useCallback((): boolean => {
    const ref = useSchemaStore.getState().selectedRef;
    if (!ref) return false;
    handleRemoveRef(ref.fromTbl, ref.fromCol, ref.toTbl, ref.toCol);
    useSchemaStore.getState().setSelectedRef(null);
    return true;
  }, [handleRemoveRef]);

  const run = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      pushStatus(`${label}…`);
      try {
        pushStatus(await fn());
      } catch (e: unknown) {
        pushStatus(`Erro: ${(e as Error)?.message ?? e}`);
      }
    },
    [pushStatus],
  );

  const handleChangeActivePages = useCallback(
    (ids: string[]) => {
      useSchemaStore.getState().setActivePageIds(ids);
      const names = ids.includes(ALL_PAGE_ID)
        ? "Todas"
        : ids.map((id) => canvasPages.find((p) => p.id === id)?.name ?? id).join(", ");
      pushStatus(
        ids.length ? `Canvas: ${names}` : "Canvas vazio — marque assuntos no painel Páginas",
      );
      useSchemaStore.getState().setSaveState("dirty");
    },
    [canvasPages, pushStatus],
  );

  const handleImport = useCallback(() => {
    if (guardReadOnly()) return;
    void run("Importando", async () => {
      const s = useSchemaStore.getState();
      const importCall = s.currentProjectId
        ? api.importFromInputForProject(s.currentProjectId, s.dbml)
        : api.importFromInput(s.dbml);
      const { dbml: merged, imported, warnings, lineageFieldCount } = await importCall;
      const parsedMerged = parseDbml(merged);
      const groupPages = pagesFromTableGroups(parsedMerged.error ? activeModel : parsedMerged);
      const pagesNext = groupPages.length ? [allTablesPage(), ...groupPages] : [allTablesPage()];
      const tableCount = parsedMerged.tables.length;
      startTransition(() => {
        s.setDbml(merged);
        setImportWarnings(warnings ?? []);
        s.setCanvasPages(pagesNext);
        if (tableCount > PAGE_WIZARD_THRESHOLD) {
          s.setActivePageIds([]);
          if (groupPages.length > 0) {
            setPageWizardTableCount(tableCount);
            setPageWizardOpen(true);
          }
        } else {
          s.setActivePageIds([ALL_PAGE_ID]);
        }
      });
      prevDbmlRef.current = merged;
      setCommittedDbml(merged);
      const warnNote = warnings?.length ? ` — ${warnings.length} aviso(s) no painel Problemas` : "";
      const l2Note =
        lineageFieldCount != null && lineageFieldCount > 0
          ? ` — ${lineageFieldCount} mapeamento(s) L2`
          : "";
      const scaleNote =
        tableCount >= LARGE_DIAGRAM_HINT
          ? ` — ${tableCount} tabelas: use páginas/camadas para navegar`
          : "";
      return imported.length
        ? `Importado: ${imported.join(", ")}${l2Note}${warnNote}${scaleNote}`
        : "Nenhum .sql em data/input/";
    });
  }, [activeModel, run, guardReadOnly]);

  const switchProject = useCallback(
    async (id: string) => {
      const s = useSchemaStore.getState();
      if (id === s.currentProjectId) return;
      s.setHydratedProjectId(null);
      if (s.currentProjectId && s.documentFormat !== "dbt") {
        try {
          await api.saveProjectById(s.currentProjectId, s.dbml, {
            positions: s.positions,
            colors: s.colors,
            collapsedGroups: s.collapsedGroups,
            pages: s.canvasPages,
            activePageIds: s.activePageIds,
          });
        } catch {
          /* ignore */
        }
      }
      loadedRef.current = false;
      try {
        await api.activateProject(id);
        const p = await api.loadProjectById(id);
        applyHydrated(p, id, "Projeto carregado");
        useSchemaStore.getState().setSaveState("idle");
      } catch (e: unknown) {
        pushStatus(`Erro ao trocar projeto: ${(e as Error)?.message ?? e}`);
      } finally {
        loadedRef.current = true;
      }
    },
    [applyHydrated, pushStatus],
  );

  const refreshProjects = useCallback(async () => {
    try {
      const { projects: list } = await api.listProjects();
      useSchemaStore.getState().setProjects(list);
    } catch {
      /* ignore */
    }
  }, []);

  const handleCreateProject = useCallback(
    async (name: string) => {
      try {
        await api.createProject(name);
        if (useSchemaStore.getState().pinnedProjectId) {
          await refreshProjects();
          pushStatus(pinnedCreatedMessage(name));
          return;
        }
        const { activeId, projects: list } = await api.listProjects();
        useSchemaStore.getState().setProjects(list);
        const current = useSchemaStore.getState().currentProjectId;
        await switchProject(
          activeId !== current ? activeId : (list[list.length - 1]?.id ?? activeId),
        );
      } catch (e: unknown) {
        pushStatus(`Erro ao criar projeto: ${(e as Error)?.message ?? e}`);
      }
    },
    [switchProject, refreshProjects, pushStatus],
  );

  const handleRenameProject = useCallback(
    async (id: string, name: string) => {
      try {
        await api.renameProject(id, name);
        await refreshProjects();
      } catch (e: unknown) {
        pushStatus(`Erro ao renomear projeto: ${(e as Error)?.message ?? e}`);
      }
    },
    [refreshProjects, pushStatus],
  );

  const handleDuplicateProject = useCallback(
    async (id: string, name?: string) => {
      try {
        const meta = await api.duplicateProject(id, name);
        await refreshProjects();
        await switchProject(meta.id);
      } catch (e: unknown) {
        pushStatus(`Erro ao duplicar projeto: ${(e as Error)?.message ?? e}`);
      }
    },
    [refreshProjects, switchProject, pushStatus],
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      try {
        await api.deleteProject(id);
        const { activeId, projects: list } = await api.listProjects();
        useSchemaStore.getState().setProjects(list);
        if (id === useSchemaStore.getState().currentProjectId) await switchProject(activeId);
      } catch (e: unknown) {
        pushStatus(`Erro ao excluir projeto: ${(e as Error)?.message ?? e}`);
      }
    },
    [switchProject, pushStatus],
  );

  const handleBackToDomains = useCallback(async () => {
    const s = useSchemaStore.getState();
    if (s.currentProjectId && s.documentFormat !== "dbt") {
      try {
        await api.saveProjectById(s.currentProjectId, s.dbml, {
          positions: s.positions,
          colors: s.colors,
          collapsedGroups: s.collapsedGroups,
          pages: s.canvasPages,
          activePageIds: s.activePageIds,
        });
      } catch {
        /* ignore */
      }
    }
    onBackToDomains?.();
  }, [onBackToDomains]);

  const handleExportOption = useCallback(
    (format: ExportFormat, dialect?: "spark" | "oracle", label?: string) => {
      void run(`Exportando ${label ?? format}`, async () => {
        const s = useSchemaStore.getState();
        const result = await api.exportFormat(s.dbml, format, dialect);
        const files = result.files.join(", ");
        if (format === "localdrawdb") {
          const l2Warn = exportInputL2Warning(activeModel.tables, activeModel.lineageFields ?? []);
          return l2Warn ? `${l2Warn} — Gerado: ${files}` : `Gerado: ${files}`;
        }
        return `Gerado: ${files}`;
      });
    },
    [activeModel, run],
  );

  const handleOrganize = useCallback(() => {
    if (guardReadOnly()) return;
    if (runDbt({ op: "organize" })) {
      pushStatus("Organizar YAML é no-op em projeto dbt");
      return;
    }
    useSchemaStore.getState().setDbml((d) => organize(d));
    pushStatus("Organizado: tabelas → refs → records");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pushStatus is a stable []-deps callback
  }, [guardReadOnly, runDbt]);

  const bumpFitView = useCallback(() => setFitViewTrigger((n) => n + 1), []);

  const handleAddTable = useCallback(() => {
    if (guardReadOnly()) return;
    const name = window.prompt("Nome da nova tabela (schema.tabela):", "novo_schema.nova_tabela");
    if (!name?.trim()) return;
    const tableId = name.trim();
    const dup = findDuplicateTableId(
      tableId,
      activeModel.tables.map((t) => t.id),
    );
    if (dup) {
      pushStatus(`Tabela "${dup}" já existe — escolha outro nome.`);
      return;
    }
    const position = defaultTablePosition(useSchemaStore.getState().positions);
    if (runDbt({ op: "addTable", tableId, position })) {
      focusTableWithPan(tableId);
      pushStatus(`Tabela criada: ${tableId}`);
      return;
    }
    mutateDbml((d) => d + newTableTemplate(tableId));
    useSchemaStore.getState().setPositions((prev) => ({
      ...prev,
      [tableId]: defaultTablePosition(prev),
    }));
    focusTableWithPan(tableId);
    pushStatus(`Tabela criada: ${tableId}`);
    useSchemaStore.getState().setSaveState("dirty");
  }, [activeModel.tables, mutateDbml, focusTableWithPan, pushStatus, guardReadOnly, runDbt]);

  const handleAddMetadata = useCallback(() => {
    if (guardReadOnly()) return;
    if (useSchemaStore.getState().documentFormat === "dbt") return;
    useSchemaStore
      .getState()
      .setDbml(
        (d) =>
          d + `\n// metadados padrão (cole dentro de uma Table):\n/*\n${METADATA_SNIPPET}\n*/\n`,
      );
  }, [guardReadOnly]);

  const saveFromPalette = useCallback(() => {
    const committed = editorRef.current?.commit?.();
    if (renameModalOpen || committed?.openedModal) {
      pushStatus("Confirme a renomeação antes de salvar");
      return;
    }
    handleSave(committed?.reconciledDbml ?? undefined);
  }, [handleSave, pushStatus, renameModalOpen]);

  const commandContext: CommandContext = useMemo(
    () => ({
      dbml,
      renameModalOpen,
      save: saveFromPalette,
      organizeDbml: handleOrganize,
      organizeCanvas: handleAutolayout,
      importInput: handleImport,
      undo,
      redo,
      autoSave,
      setAutoSave: (value) => useSchemaStore.getState().setAutoSave(value),
      layersPanelCollapsed,
      setLayersPanelCollapsed,
      recordsPanelOpen,
      setRecordsPanelOpen,
      problemsPanelOpen,
      setProblemsPanelOpen,
      tables: activeModel.tables.map((table) => ({
        id: table.id,
        name: table.name,
        schema: table.schema,
      })),
      columns: activeModel.tables.flatMap((table) =>
        table.columns.map((field) => ({ tableId: table.id, columnName: field.name })),
      ),
      panToTable: focusTableWithPan,
      goToLine,
      goToColumn,
      openSourceDrawer: () => setSourceDrawerOpen(true),
      removeSelectedRef: handleRemoveSelectedRef,
      closeModals: () => {
        setPaletteOpen(false);
        setHelpOpen(false);
        setProblemsPanelOpen(false);
      },
      onExport: (files) => pushStatus(`Gerado: ${files.join(", ")}`),
    }),
    [
      dbml,
      renameModalOpen,
      saveFromPalette,
      handleOrganize,
      handleAutolayout,
      handleImport,
      undo,
      redo,
      autoSave,
      layersPanelCollapsed,
      recordsPanelOpen,
      problemsPanelOpen,
      activeModel.tables,
      focusTableWithPan,
      goToLine,
      goToColumn,
      pushStatus,
      handleRemoveSelectedRef,
    ],
  );

  const treeTables = useMemo(
    () =>
      activeModel.tables.map((t) => ({
        id: t.id,
        name: t.name,
        schema: t.schema,
        columnCount: t.columns.length,
        layerId: layerOf(t.id),
      })),
    [activeModel.tables, layerOf],
  );

  const currentProject = projects.find((p) => p.id === currentProjectId);

  return {
    domain,
    onRepoChanged,
    dbml,
    positions,
    sizes,
    colors,
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
    saveFromPalette,
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
    handleRemoveSelectedRef,
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
  };
}

function tableMetaOf(
  id: string,
  modelRef: MutableRefObject<ParseResult>,
  lineageRef: MutableRefObject<LineageLink[]>,
): TableMeta {
  const model = modelRef.current;
  const t = model.tables.find((x) => x.id === id);
  const sources = lineageRef.current.filter((l) => l.target === id).map((l) => l.source);
  const rec = model.records.find((r) => r.table === id || r.table === t?.name);
  const sample = rec ? { columns: rec.columns, rows: rec.rows } : null;
  const pks = t ? t.columns.filter((c) => c.pk).map((c) => c.name) : [];
  const fks = model.refs
    .filter((r) => r.source === id)
    .map((r) => ({ column: r.fromCol, ref: `${r.target}.${r.toCol}` }));
  const refsIn = [...new Set(model.refs.filter((r) => r.target === id).map((r) => r.source))];
  const columnNotes = t
    ? t.columns.filter((c) => c.note).map((c) => ({ column: c.name, note: c.note as string }))
    : [];
  const dbtHas = !!(t?.resourceType || t?.materialization || t?.tags?.length);
  const has = !!(
    sources.length ||
    sample ||
    pks.length ||
    fks.length ||
    refsIn.length ||
    t?.note ||
    columnNotes.length ||
    dbtHas
  );
  return {
    sources,
    sample,
    pks,
    fks,
    refsIn,
    note: t?.note,
    columnNotes,
    resourceType: t?.resourceType,
    materialization: t?.materialization,
    tags: t?.tags,
    has,
  };
}
