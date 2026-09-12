/** Limiar: virtualizar lista de colunas no TableNode. */
export const COLUMN_VIRTUALIZE_THRESHOLD = 48;

/** Altura de linha (px) — alinhada a nodeMetrics.ROW_H e CSS .col-row. Cozy default. */
export const COLUMN_VIRTUAL_ROW_H = 25;

/** Compact StatusBar density — matches `--row-compact` (21px). */
export const COLUMN_COMPACT_ROW_H = 21;

export type CanvasDensity = "compact" | "cozy";

export function rowHeightForDensity(density: CanvasDensity = "cozy"): number {
  return density === "compact" ? COLUMN_COMPACT_ROW_H : COLUMN_VIRTUAL_ROW_H;
}

/** Linhas visíveis no viewport virtual (scroll interno). */
export const COLUMN_VIRTUAL_VIEW_ROWS = 14;

/** Altura explícita do viewport virtualizado: 14 linhas, sem medição do DOM. */
export function columnVirtualViewportPx(rowH: number = COLUMN_VIRTUAL_ROW_H): number {
  return COLUMN_VIRTUAL_VIEW_ROWS * rowH;
}

/** CSS token: `--row-h` is set on the canvas wrap (`--row-cozy` / `--row-compact`). */
export function columnVirtualViewportCss(): string {
  return `calc(var(--row-h) * ${COLUMN_VIRTUAL_VIEW_ROWS})`;
}

/** Overscan acima/abaixo do viewport virtual. */
export const COLUMN_VIRTUAL_OVERSCAN = 3;

/** Limiar: ocultar MiniMap (custo de pintura). */
export const MINIMAP_MAX_TABLES = 200;

/** Limiar: pular fitView automático no primeiro frame. */
export const SKIP_INITIAL_FIT_TABLES = 200;

/** Limiar: sugerir páginas / wizard pós-import. */
export const PAGE_WIZARD_THRESHOLD = 500;

/** Limiar: mensagem de diagrama grande no status. */
export const LARGE_DIAGRAM_HINT = 200;

/** Id da página virtual "todas as tabelas". */
export const ALL_PAGE_ID = '__all__';

/** Id da página virtual para tabelas sem TableGroup. */
export const UNGROUPED_PAGE_ID = '__ungrouped__';
