import { useMemo } from "react";
import type { ExternalLinkBadge, TableMeta } from "@/features/canvas/actions";
import type { NodeExtras } from "@/features/canvas/hooks/useCanvasNodes";
import {
  aggregateCrossLinks,
  allTablesPage,
  isExternalStubNodeId,
  pagesFromTableGroups,
  type CrossPageRef,
  type ExternalGroupStub,
} from "@/features/canvas/utils/pageFilter";
import {
  ALL_PAGE_ID,
  LARGE_DIAGRAM_HINT,
  PAGE_WIZARD_THRESHOLD,
} from "@/features/canvas/utils/scaleLimits";
import {
  isCompleteTableId,
  migrateCanvasPins,
  renameColumnAllRefs,
  renameTable,
} from "@/features/schema/model/edit";
import { parseDbml, type ParseResult } from "@/features/schema/model/parse";
import { extractRecords, pinnedByTableFromList } from "@/features/schema/model/dbmlClean";
import {
  keepSeparateKeyRename,
  propagateKeyRename,
} from "@/features/schema/model/propagateKeyRename";
import type { RenameImpact } from "@/features/schema/model/reconcile";
import { classifyChildFks } from "@/features/schema/model/rolename";
import { useSchemaStore } from "@/features/schema/store";
import { layerColorOf } from "@/features/schema/model/layers";
import type { CanvasPage, CanvasState, Layer, LineageLink, TableSize } from "@/infrastructure/api";

/** Token fallback — never a new hex. useCanvasNodes still has its own FALLBACK_EXTRA. */
export const HEADER_COLOR_FALLBACK = "hsl(var(--card))";

export const EMPTY_PARSE: ParseResult = {
  tables: [],
  refs: [],
  records: [],
  layerGroups: [],
  lineageFields: [],
  rolenames: [],
  colors: {},
};

export const SAMPLE_DBML = `TableGroup vendas {
  loja.cliente
  loja.pedido
}

LayerGroup bronze {
  loja.cliente
}

Table loja.cliente {
  id bigint [pk]
  nome string
  email string
  Note: 'Dimensão de clientes'
}

Table loja.pedido {
  id bigint [pk]
  cliente_id bigint
  total decimal(18,2)
  criado_em timestamp
}

Ref: loja.pedido.cliente_id > loja.cliente.id

LineageFields {
  loja.pedido.cliente_id < loja.cliente.id
}
`;

export function resolveActivePageIds(
  canvas: CanvasState | undefined,
  tableCount: number,
): string[] {
  if (canvas?.activePageIds != null) return canvas.activePageIds;
  if (canvas?.activePageId != null) return [canvas.activePageId];
  if (tableCount > PAGE_WIZARD_THRESHOLD) return [];
  return [ALL_PAGE_ID];
}

/**
 * Mantém a mesma referência enquanto o conteúdo (por JSON) não muda.
 * Copiado do App.tsx do LocalDrawDB — helper local, não uma relocação exportada.
 */
export function useStable<T>(value: T): T {
  const serialized = JSON.stringify(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- identity keyed by JSON snapshot
  return useMemo(() => value, [serialized]);
}

export function applyRenames(
  src: string,
  impacts: RenameImpact[],
  migrateTableId: (oldId: string, newId: string) => void,
  keyColFn: typeof propagateKeyRename = propagateKeyRename,
): { dbml: string; appliedRefCount: number } {
  let out = src;
  let appliedRefCount = 0;
  for (const { rename, refCount } of impacts) {
    if (rename.kind === "table") {
      if (isCompleteTableId(rename.oldId) && isCompleteTableId(rename.newId)) {
        out = renameTable(out, rename.oldId, rename.newId);
        migrateTableId(rename.oldId, rename.newId);
        appliedRefCount += refCount;
      }
    } else if (rename.kind === "column") {
      const selCol = useSchemaStore.getState().selectedColumn;
      const isKey = classifyChildFks(src, rename.table, rename.oldCol).length > 0;
      out = isKey
        ? keyColFn(out, rename.table, rename.oldCol, rename.newCol)
        : renameColumnAllRefs(out, rename.table, rename.oldCol, rename.newCol);
      appliedRefCount += refCount;
      if (selCol?.table === rename.table && selCol?.column === rename.oldCol) {
        useSchemaStore.getState().selectColumn({ table: rename.table, column: rename.newCol });
      }
    }
  }
  return { dbml: out, appliedRefCount };
}

export { keepSeparateKeyRename };

export function pruneOrphanPositions(
  prev: Record<string, { x: number; y: number }>,
  tableIds: Set<string>,
): Record<string, { x: number; y: number }> | null {
  let changed = false;
  const next = { ...prev };
  for (const id of Object.keys(next)) {
    if (!tableIds.has(id) && !isExternalStubNodeId(id)) {
      delete next[id];
      changed = true;
    }
  }
  return changed ? next : null;
}

export function buildNodeExtras(args: {
  model: ParseResult;
  canvasLineage: LineageLink[];
  colors: Record<string, string>;
  layers: Layer[];
  layerOf: (id: string) => string | undefined;
  externalLinksByTable: Map<string, ExternalLinkBadge[]>;
}): NodeExtras {
  const { model, canvasLineage, colors, layers, layerOf, externalLinksByTable } = args;
  const fksBySource = new Map<string, { column: string; ref: string }[]>();
  const refsInByTarget = new Map<string, Set<string>>();
  for (const r of model.refs) {
    let fl = fksBySource.get(r.source);
    if (!fl) fksBySource.set(r.source, (fl = []));
    fl.push({ column: r.fromCol, ref: `${r.target}.${r.toCol}` });
    let rs = refsInByTarget.get(r.target);
    if (!rs) refsInByTarget.set(r.target, (rs = new Set()));
    rs.add(r.source);
  }
  const sourcesByTarget = new Map<string, string[]>();
  for (const l of canvasLineage) {
    let s = sourcesByTarget.get(l.target);
    if (!s) sourcesByTarget.set(l.target, (s = []));
    s.push(l.source);
  }
  const recByKey = new Map<string, (typeof model.records)[number]>();
  for (const rec of model.records) recByKey.set(rec.table, rec);

  const map: NodeExtras = new Map();
  const linkedByTable = new Map<string, Set<string>>();
  const linkCol = (tableId: string, col: string) => {
    let set = linkedByTable.get(tableId);
    if (!set) linkedByTable.set(tableId, (set = new Set()));
    set.add(col);
  };
  for (const r of model.refs) {
    linkCol(r.source, r.fromCol);
    linkCol(r.target, r.toCol);
  }
  for (const m of model.lineageFields ?? []) {
    linkCol(m.sourceTable, m.sourceColumn);
    linkCol(m.targetTable, m.targetColumn);
  }
  for (const t of model.tables) {
    const sources = sourcesByTarget.get(t.id) ?? [];
    const rec = recByKey.get(t.id) ?? recByKey.get(t.name);
    const sample = rec ? { columns: rec.columns, rows: rec.rows } : null;
    const pks = t.columns.filter((c) => c.pk).map((c) => c.name);
    const fks = fksBySource.get(t.id) ?? [];
    const refsIn = [...(refsInByTarget.get(t.id) ?? [])];
    const columnNotes = t.columns
      .filter((c) => c.note)
      .map((c) => ({ column: c.name, note: c.note as string }));
    const dbtHas = !!(t.resourceType || t.materialization || t.tags?.length);
    const has = !!(
      sources.length ||
      sample ||
      pks.length ||
      fks.length ||
      refsIn.length ||
      t.note ||
      columnNotes.length ||
      dbtHas
    );
    const meta: TableMeta = {
      sources,
      sample,
      pks,
      fks,
      refsIn,
      note: t.note,
      columnNotes,
      resourceType: t.resourceType,
      materialization: t.materialization,
      tags: t.tags,
      has,
    };
    const headerColor =
      model.colors[t.id] ??
      colors[t.id] ??
      layerColorOf(layers, layerOf(t.id)) ??
      HEADER_COLOR_FALLBACK;
    const externalLinks = externalLinksByTable.get(t.id);
    const linked = linkedByTable.get(t.id);
    map.set(t.id, {
      headerColor,
      meta,
      ...(externalLinks?.length ? { externalLinks } : {}),
      ...(linked?.size ? { linkedColumns: [...linked].sort() } : {}),
    });
  }
  return map;
}

export type HydratedProject = {
  dbml: string;
  positions: Record<string, { x: number; y: number }>;
  colors: Record<string, string>;
  snapshot: {
    dbml: string;
    positions: Record<string, { x: number; y: number }>;
    colors: Record<string, string>;
  };
  tableCount: number;
  active0: string[];
  pages0: CanvasPage[];
  sizes: Record<string, number | TableSize> | undefined;
  collapsedGroups: string[];
  projectId: string;
  pinnedByTable: Record<string, string[]>;
};

export function hydrateFromProject(
  p: { dbml: string; canvas?: CanvasState },
  projectId: string,
): HydratedProject {
  const rawDbml = p.dbml || SAMPLE_DBML;
  const dbml0 = migrateCanvasPins(rawDbml, p.canvas?.pinnedByTable);
  const pos0 = p.canvas?.positions ?? {};
  const col0 = p.canvas?.colors ?? {};
  const parsed0 = parseDbml(dbml0);
  const groupPages = pagesFromTableGroups(parsed0.error ? EMPTY_PARSE : parsed0);
  const pages0 = p.canvas?.pages?.length
    ? p.canvas.pages
    : groupPages.length
      ? [allTablesPage(), ...groupPages]
      : [allTablesPage()];
  const active0 = resolveActivePageIds(p.canvas, parsed0.tables.length);
  return {
    dbml: dbml0,
    positions: pos0,
    colors: col0,
    snapshot: { dbml: dbml0, positions: pos0, colors: col0 },
    tableCount: parsed0.tables.length,
    active0,
    pages0,
    sizes: p.canvas?.sizes,
    collapsedGroups: p.canvas?.collapsedGroups ?? [],
    projectId,
    pinnedByTable: pinnedByTableFromList(extractRecords(dbml0).pins),
  };
}

export function loadStatusMessage(
  tableCount: number,
  active0: string[],
  override?: string,
): string {
  if (override) return override;
  if (tableCount > PAGE_WIZARD_THRESHOLD && active0.length === 0) {
    return `${tableCount} tabelas carregadas — marque assuntos no painel Páginas`;
  }
  if (tableCount >= LARGE_DIAGRAM_HINT) {
    return `${tableCount} tabelas carregadas — use páginas/camadas para navegar`;
  }
  return "Pronto";
}

export function externalLinksMap(
  crossRefs: CrossPageRef[],
  stubs: ExternalGroupStub[],
): Map<string, ExternalLinkBadge[]> {
  const map = new Map<string, ExternalLinkBadge[]>();
  for (const link of aggregateCrossLinks(crossRefs, stubs)) {
    const list = map.get(link.visibleTable) ?? [];
    list.push({
      stubId: link.stubId,
      label: link.stubLabel,
      count: link.count,
      direction: link.direction,
    });
    map.set(link.visibleTable, list);
  }
  return map;
}
