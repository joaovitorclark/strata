import { isDetailLevel, type DetailLevel } from "@/features/canvas/utils/lod";

export const HIDDEN_URL_LIMIT = 50;

const KNOWN_KEYS = ["project", "view", "detail", "focus", "col", "hidden", "z", "x", "y"] as const;

const KNOWN = new Set<string>(KNOWN_KEYS);

export type UrlState = {
  project?: string;
  view?: string;
  detail?: DetailLevel;
  focus?: string;
  col?: string;
  hidden?: string[];
  z?: number;
  x?: number;
  y?: number;
  extra?: Record<string, string>;
};

function parseNumber(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function formatCoord(n: number): string {
  return n.toFixed(2);
}

function toUrl(base: string): URL {
  try {
    return new URL(base);
  } catch {
    return new URL(base, "https://strata.local/");
  }
}

export function parseUrlState(search: string): Partial<UrlState> {
  const raw = search.startsWith("?") || search.startsWith("http") ? search : `?${search}`;
  const params = raw.startsWith("http")
    ? new URL(raw).searchParams
    : new URLSearchParams(raw.startsWith("?") ? raw : `?${raw}`);

  const extra: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (!KNOWN.has(key)) extra[key] = value;
  }

  const detailRaw = params.get("detail");
  const focus = params.get("focus") || undefined;
  const col = focus ? params.get("col") || undefined : undefined;
  const hiddenRaw = params.get("hidden");
  const hidden = hiddenRaw
    ? hiddenRaw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;

  const state: Partial<UrlState> = {};
  const project = params.get("project");
  if (project) state.project = project;
  const view = params.get("view") || undefined;
  if (view && view !== "tudo") state.view = view;
  if (isDetailLevel(detailRaw)) state.detail = detailRaw;
  if (focus) state.focus = focus;
  if (col) state.col = col;
  if (hidden?.length) state.hidden = hidden;
  const z = parseNumber(params.get("z"));
  const x = parseNumber(params.get("x"));
  const y = parseNumber(params.get("y"));
  if (z !== undefined) state.z = z;
  if (x !== undefined) state.x = x;
  if (y !== undefined) state.y = y;
  if (Object.keys(extra).length) state.extra = extra;
  return state;
}

export function serializeUrlState(state: UrlState, base: string): string {
  const url = toUrl(base);
  const extras: Array<[string, string]> = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (!KNOWN.has(key)) extras.push([key, value]);
  }
  if (state.extra) {
    for (const [key, value] of Object.entries(state.extra)) {
      if (!KNOWN.has(key) && !extras.some(([k]) => k === key)) extras.push([key, value]);
    }
  }

  const ordered = new URLSearchParams();
  if (state.project) ordered.set("project", state.project);
  if (state.view && state.view !== "tudo") ordered.set("view", state.view);
  if (state.detail) ordered.set("detail", state.detail);
  if (state.focus) ordered.set("focus", state.focus);
  if (state.focus && state.col) ordered.set("col", state.col);
  if (state.hidden && state.hidden.length > 0 && state.hidden.length <= HIDDEN_URL_LIMIT) {
    ordered.set("hidden", state.hidden.join(","));
  }
  if (!state.focus && (state.z !== undefined || state.x !== undefined || state.y !== undefined)) {
    if (state.z !== undefined) ordered.set("z", formatCoord(state.z));
    if (state.x !== undefined) ordered.set("x", formatCoord(state.x));
    if (state.y !== undefined) ordered.set("y", formatCoord(state.y));
  }
  for (const [key, value] of extras) ordered.set(key, value);

  url.search = ordered.toString() ? `?${ordered.toString()}` : "";
  return url.toString();
}

export function hiddenOmitsFromUrl(ids: readonly string[]): boolean {
  return ids.length > HIDDEN_URL_LIMIT;
}
