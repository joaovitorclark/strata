import type { Cardinality } from "@/features/schema/model/parse";

export const NOTATIONS = ["ie", "barker", "minimal"] as const;
export type Notation = (typeof NOTATIONS)[number];

export const DEFAULT_NOTATION: Notation = "ie";

export function notationStorageKey(projectId: string): string {
  return `strata.notation.${projectId}`;
}

export function parseNotation(raw: string | null | undefined): Notation {
  if (raw === "ie" || raw === "barker" || raw === "minimal") return raw;
  return DEFAULT_NOTATION;
}

export function readNotation(projectId: string): Notation {
  try {
    return parseNotation(localStorage.getItem(notationStorageKey(projectId)));
  } catch {
    return DEFAULT_NOTATION;
  }
}

export function writeNotation(projectId: string, notation: Notation): void {
  try {
    localStorage.setItem(notationStorageKey(projectId), notation);
  } catch {
    /* private mode / quota */
  }
}

export type MarkerIdentity = "one" | "zero-one" | "many" | "zero-many";
export type MarkerState = "rest" | "hover" | "active";

export function markerIdentity(cardinality: Cardinality, nullable: boolean): MarkerIdentity {
  if (cardinality === "1") return nullable ? "zero-one" : "one";
  return nullable ? "zero-many" : "many";
}

export function relationMarkerId(
  notation: Notation,
  cardinality: Cardinality,
  nullable: boolean,
  active = false,
): string {
  const ident = markerIdentity(cardinality, nullable);
  return `${notation}-${ident}-${active ? "active" : "rest"}`;
}

/** DOM ids that keep canvas-edges.cy.ts `/cf-many/` green on the default IE many foot. */
const DOM_ALIAS: Record<string, string> = {
  "ie-many-rest": "cf-many",
  "ie-many-active": "cf-many-active",
  "ie-one-rest": "cf-one",
  "ie-one-active": "cf-one-active",
  "ie-zero-many-rest": "cf-many-zero-rest",
  "ie-zero-many-active": "cf-many-zero-active",
};

export function relationMarkerDomId(
  notation: Notation,
  cardinality: Cardinality,
  nullable: boolean,
  state: MarkerState,
): string {
  const ident = markerIdentity(cardinality, nullable);
  const logical = `${notation}-${ident}-${state === "hover" ? "rest" : state}`;
  if (state === "hover" && notation !== "minimal") {
    return `${notation}-${ident}-hover`;
  }
  return DOM_ALIAS[logical] ?? logical;
}

export function relationMarkerUrl(
  notation: Notation,
  cardinality: Cardinality,
  nullable: boolean,
  state: MarkerState = "rest",
): string {
  if (notation === "minimal" && cardinality === "*") return "";
  return `url(#${relationMarkerDomId(notation, cardinality, nullable, state)})`;
}

export function continueMarkerUrl(state: MarkerState): string {
  const s = state === "hover" ? "rest" : state;
  return `url(#continue-${s})`;
}
