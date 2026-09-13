export type Project = { dbml: string; canvas: CanvasState };
export type Layer = { id: string; name: string; color: string };
export type LineageLink = { source: string; target: string };

/** Dimensões por tabela quando redimensionada (px). Ambas opcionais. */
export type TableSize = { width?: number; height?: number };

export type CanvasPage = {
  id: string;
  name: string;
  /** TableGroup names; ALL_PAGE_ID = todas; UNGROUPED_PAGE_ID = sem grupo. */
  tableGroups: string[];
};

export type CanvasState = {
  positions?: Record<string, { x: number; y: number }>;
  /** Dimensões por tabela quando redimensionada (px). Aceita número legado (só largura). */
  sizes?: Record<string, number | TableSize>;
  colors?: Record<string, string>;
  layers?: Record<string, string>; // tableId -> layerId
  customLayers?: Layer[];
  lineage?: LineageLink[];
  collapsedGroups?: string[];
  pages?: CanvasPage[];
  /** Páginas visíveis no canvas (ids de CanvasPage). ALL_PAGE_ID = todas. */
  activePageIds?: string[];
  /** @deprecated use activePageIds */
  activePageId?: string | null;
  /** @deprecated pins live in DBML `Pins {}`; kept so old canvas.json can migrate on load. */
  pinnedByTable?: Record<string, string[]>;
};

export type ProjectMeta = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

export type Meta = {
  root: string;
  dataDir: string;
  inputDir: string;
  port: number;
  pinnedProject: string | null;
  pinnedProjectId: string | null;
};

export type ExportFormat =
  | 'localdrawdb'
  | 'spark-ddl'
  | 'oracle-ddl'
  | 'postgres-ddl'
  | 'erwin'
  | 'dbt'
  | 'mermaid'
  | 'xlsx'
  | 'llm-context';

export type InputDialect = 'spark' | 'oracle' | 'auto';

export type ExportOption = {
  id: string;
  label: string;
  format: ExportFormat;
  dialect?: 'spark' | 'oracle';
};

// --- API domínios/git (Spec A) ---

export type DomainMeta = {
  id: string;
  slug: string;
  name: string;
  dir: string;
  hasGit: boolean;
  remoteUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  files: string[];
  branches: string[];
};
export type GitStatusResponse = { hasGit: false } | ({ hasGit: true } & GitStatus);
