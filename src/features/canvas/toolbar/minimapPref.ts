export const MINIMAP_STORAGE_KEY = "strata.minimap";
export const MINIMAP_AUTO_ON_TABLES = 40;
export const MINIMAP_WIDTH = 200;
export const MINIMAP_HEIGHT = 140;
/** Pill is bottom-3 (12px) + h-9 (36px); keep a gap so G3 boxes stay disjoint. */
export const MINIMAP_BOTTOM_PX = 56;

export function readMinimapVisible(tableCount: number): boolean {
  try {
    const raw = localStorage.getItem(MINIMAP_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* private mode / quota */
  }
  return tableCount > MINIMAP_AUTO_ON_TABLES;
}

export function writeMinimapPref(on: boolean): void {
  try {
    localStorage.setItem(MINIMAP_STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* private mode / quota */
  }
}

export function minimapLayerColor(layerId: string | undefined): string {
  switch ((layerId ?? "").toLowerCase()) {
    case "bronze":
      return "hsl(var(--layer-bronze))";
    case "silver":
    case "prata":
      return "hsl(var(--layer-silver))";
    case "gold":
    case "ouro":
      return "hsl(var(--layer-gold))";
    default:
      return "hsl(var(--layer-raw))";
  }
}
