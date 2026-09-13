import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, CircleDot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { parsePagesCollapsed } from "@/features/canvas/utils/pagesPanelState";
import { ALL_PAGE_ID } from "@/features/canvas/utils/scaleLimits";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import { LAYER_PRESETS } from "@/features/schema/model/layers";
import { useSchemaStore } from "@/features/schema/store";
import type { CanvasPage, Layer } from "@/infrastructure/api";
import { cn } from "@/lib/utils";

export { parsePagesCollapsed };

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const LAYERS_KEY = "ldb.panel.layers";
const LAYERS_LEGACY_KEY = "localdrawdb.layersPanelCollapsed";

export type LayersPanelProps = {
  layers: Layer[];
  tables: { id: string }[];
  onAddLayer: (n: string, c: string) => void;
  onFocusTable: (tableId: string) => void;
  onAutolayout?: () => void;
  pages?: CanvasPage[];
  activePageIds?: string[];
  onChangeActivePages?: (ids: string[]) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

function loadLayersCollapsed(): boolean {
  try {
    const current = localStorage.getItem(LAYERS_KEY);
    if (current !== null) {
      if (current === "1") return true;
      if (current === "0") return false;
      return false;
    }
    const legacy = localStorage.getItem(LAYERS_LEGACY_KEY);
    if (legacy === "1") return true;
    if (legacy === "0") return false;
    return false;
  } catch {
    return false;
  }
}

function writeLayersCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(LAYERS_KEY, collapsed ? "1" : "0");
  } catch {
    /* noop */
  }
}

export function LayersPanel({
  layers,
  tables,
  onAddLayer,
  onFocusTable,
  onAutolayout,
  pages,
  activePageIds,
  onChangeActivePages,
  collapsed: collapsedProp,
  onCollapsedChange,
}: LayersPanelProps) {
  const [persistedCollapsed, setPersistedCollapsed] = useState(loadLayersCollapsed);
  const collapsed = collapsedProp ?? persistedCollapsed;
  const toggleCollapsed = () => {
    onCollapsedChange?.(!collapsed);
    setPersistedCollapsed((current) => {
      const next = !current;
      writeLayersCollapsed(next);
      return next;
    });
  };
  const [tableQuery, setTableQuery] = useState("");
  const [pendingLayerName, setPendingLayerName] = useState<string | null>(null);
  const hiddenLayers = useSchemaStore((s) => s.hiddenLayers);
  const toggleLayer = useSchemaStore((s) => s.toggleLayer);
  const layerDimMode = useSchemaStore((s) => s.layerDimMode);
  const toggleDimMode = useSchemaStore((s) => s.toggleDimMode);
  const lineageVisible = useSchemaStore((s) => s.lineageVisible);
  const toggleLineageVisible = useSchemaStore((s) => s.toggleLineageVisible);
  const lineageMode = useSchemaStore((s) => s.lineageMode);
  const toggleLineageMode = useSchemaStore((s) => s.toggleLineageMode);
  const relationsVisible = useSchemaStore((s) => s.relationsVisible);
  const toggleRelationsVisible = useSchemaStore((s) => s.toggleRelationsVisible);
  const fieldLineageVisible = useSchemaStore((s) => s.fieldLineageVisible);
  const toggleFieldLineageVisible = useSchemaStore((s) => s.toggleFieldLineageVisible);

  const filteredTables = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    const sorted = [...tables].sort((a, b) => a.id.localeCompare(b.id));
    if (!q) return sorted;
    return sorted.filter((t) => t.id.toLowerCase().includes(q));
  }, [tables, tableQuery]);

  const selectablePages = useMemo(
    () => (pages ? pages.filter((p) => p.id !== ALL_PAGE_ID) : []),
    [pages],
  );
  const showAllPages = !!activePageIds?.includes(ALL_PAGE_ID);
  const selectedPages = useMemo(() => new Set(activePageIds ?? []), [activePageIds]);
  const hasPagesSection = selectablePages.length > 0 && onChangeActivePages && activePageIds;
  const toggleAllPages = (checked: boolean) => {
    if (!onChangeActivePages) return;
    onChangeActivePages(checked ? [ALL_PAGE_ID] : []);
  };
  const togglePage = (pageId: string, checked: boolean) => {
    if (!onChangeActivePages || !activePageIds) return;
    let next = activePageIds.filter((id) => id !== ALL_PAGE_ID);
    if (checked) {
      if (!next.includes(pageId)) next = [...next, pageId];
    } else {
      next = next.filter((id) => id !== pageId);
    }
    onChangeActivePages(next);
  };

  const collapseCaption = collapsed ? " Camadas" : " Camadas e tabelas";
  const CollapseIcon = collapsed ? ChevronLeft : ChevronDown;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "layers-panel w-[248px] max-h-[80%] overflow-auto rounded-md border border-border bg-card p-2.5 text-xs text-card-foreground shadow-md",
          collapsed && "is-collapsed w-auto overflow-visible rounded-full p-1",
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "layers-panel__collapse inline-flex items-center gap-1 text-xs text-foreground",
                FOCUS,
              )}
              onClick={toggleCollapsed}
            >
              <CollapseIcon className="size-3.5" strokeWidth={1.5} />
              {collapseCaption}
            </button>
          </TooltipTrigger>
          <TooltipContent>{collapsed ? "Expandir painel" : "Recolher painel"}</TooltipContent>
        </Tooltip>
        {!collapsed && (
          <>
            {hasPagesSection && (
              <>
                <div className="layers-panel__title mt-2 font-medium">Páginas</div>
                <label className="layers-panel__row mt-1 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showAllPages}
                    onChange={(e) => toggleAllPages(e.target.checked)}
                  />
                  Todas
                </label>
                {selectablePages.map((p) => (
                  <label key={p.id} className="layers-panel__row mt-1 flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!showAllPages && selectedPages.has(p.id)}
                      disabled={showAllPages}
                      onChange={(e) => togglePage(p.id, e.target.checked)}
                    />
                    {p.name}
                  </label>
                ))}
                <Separator className="layers-panel__sep my-2" />
              </>
            )}
            <div className="layers-panel__title mt-2 font-medium">Camadas</div>
            {layers.map((l) => (
              <label key={l.id} className="layers-panel__row mt-1 flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={!hiddenLayers.has(l.id)}
                  onChange={() => toggleLayer(l.id)}
                />
                <span
                  className="layer-dot size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                {l.name}
              </label>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("layers-panel__add mt-1 h-7 w-full justify-start text-xs", FOCUS)}
              onClick={() => {
                const name = prompt("Nome da nova camada:");
                if (!name) return;
                setPendingLayerName(name.trim());
              }}
            >
              + camada
            </Button>
            {pendingLayerName ? (
              <div className="mt-1 grid grid-cols-6 gap-1" data-pending-layer={pendingLayerName}>
                {TABLE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    className={cn("size-4 rounded-sm ring-1 ring-border", FOCUS)}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      onAddLayer(pendingLayerName, c);
                      setPendingLayerName(null);
                    }}
                  />
                ))}
              </div>
            ) : null}
            <select
              className="layers-panel__preset mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              value=""
              title="Insere as camadas de uma nomenclatura medallion (dbt)"
              onChange={(e) => {
                const preset = LAYER_PRESETS[e.target.value];
                if (preset) for (const l of preset.layers) onAddLayer(l.name, l.color);
                e.currentTarget.value = "";
              }}
            >
              <option value="">+ inserir preset…</option>
              {Object.values(LAYER_PRESETS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <Separator className="layers-panel__sep my-2" />
            <label className="layers-panel__row flex items-center gap-1.5">
              <input type="checkbox" checked={layerDimMode} onChange={toggleDimMode} />
              Esmaecer (em vez de esconder)
            </label>
            <Separator className="layers-panel__sep my-2" />
            <div className="layers-panel__title font-medium">Linhagem</div>
            <label className="layers-panel__row mt-1 flex items-center gap-1.5">
              <input type="checkbox" checked={lineageVisible} onChange={toggleLineageVisible} />
              Mostrar linhagem
            </label>
            <label className="layers-panel__row mt-1 flex items-center gap-1.5">
              <input type="checkbox" checked={relationsVisible} onChange={toggleRelationsVisible} />
              Mostrar relacionamentos
            </label>
            <label className="layers-panel__row mt-1 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={fieldLineageVisible}
                onChange={toggleFieldLineageVisible}
              />
              Mostrar linhagem de campos
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={lineageMode ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "layers-panel__lineage-btn mt-1 h-7 w-full justify-start text-xs",
                    FOCUS,
                    lineageMode && "is-active",
                  )}
                  onClick={toggleLineageMode}
                >
                  <CircleDot
                    className="size-2.5"
                    strokeWidth={1.5}
                    fill={lineageMode ? "currentColor" : "none"}
                  />
                  {lineageMode ? " Modo linhagem (ativo)" : " Modo linhagem"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar linhagem nas bordas das tabelas</TooltipContent>
            </Tooltip>
            {lineageMode && (
              <p className="layers-panel__hint mt-1 text-2xs text-muted-foreground">
                Arraste entre os pontos nas bordas. Relacionamentos desligam automaticamente.
                Organizar canvas empilha TableGroups por camada (bronze→ouro), maiores à esquerda
                dentro de cada grupo.
              </p>
            )}

            <Separator className="layers-panel__sep my-2" />
            <div className="layers-panel__title font-medium">Tabelas</div>
            <Input
              className="layers-panel__search mt-1 h-8 text-xs"
              type="search"
              placeholder="Buscar tabela…"
              value={tableQuery}
              onChange={(e) => setTableQuery(e.target.value)}
            />
            <ul className="layers-panel__tables mt-1 max-h-[140px] overflow-y-auto">
              {filteredTables.map((t) => (
                <li key={t.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "layers-panel__table-btn w-full rounded-sm px-1 py-0.5 text-left font-mono text-2xs text-foreground hover:bg-accent",
                          FOCUS,
                        )}
                        onClick={() => onFocusTable(t.id)}
                        onDoubleClick={() => onFocusTable(t.id)}
                      >
                        {t.id}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Clique para ir à tabela no canvas</TooltipContent>
                  </Tooltip>
                </li>
              ))}
              {filteredTables.length === 0 && (
                <li className="layers-panel__empty px-1 py-1 text-2xs text-muted-foreground">
                  Nenhuma tabela
                </li>
              )}
            </ul>
            {onAutolayout && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "layers-panel__autolayout mt-1 h-8 w-full text-xs",
                  FOCUS,
                  lineageMode && "layers-panel__autolayout--lineage",
                )}
                onClick={onAutolayout}
              >
                Organizar canvas
              </Button>
            )}
            <p className="layers-panel__hint mt-1 text-2xs text-muted-foreground">
              {typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent)
                ? "Cmd+clique ou arraste para selecionar várias tabelas."
                : "Ctrl+clique ou arraste para selecionar várias tabelas."}
            </p>

            {fieldLineageVisible && (
              <p className="layers-panel__hint mt-1 text-2xs text-muted-foreground">
                Arestas finas só nas tabelas selecionadas. Edite mapeamentos no painel inferior
                direito.
              </p>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
