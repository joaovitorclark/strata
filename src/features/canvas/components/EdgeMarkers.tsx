import type { ReactNode } from "react";
import type { Cardinality } from "@/features/schema/model/parse";

import {
  relationMarkerId as notationMarkerId,
  relationMarkerUrl as notationMarkerUrl,
  type MarkerState,
  type Notation,
} from "@/features/canvas/utils/notation";

import "./edgeClasses.css";

export const relationMarkerId = notationMarkerId;
export { notationMarkerUrl as relationMarkerUrl };

export function lineageMarkerUrl(active: boolean): string {
  return active ? "url(#lin-arrow-active)" : "url(#lin-arrow)";
}

function paint(state: MarkerState, notation: Notation): string {
  if (state === "active") return "hsl(var(--rel-active))";
  if (notation === "minimal") return "hsl(var(--rel-muted))";
  if (state === "hover") return "hsl(var(--rel-fk))";
  return "hsl(var(--rel-muted))";
}

function MarkerShell({ id, refX, children }: { id: string; refX: number; children: ReactNode }) {
  return (
    <marker
      id={id}
      markerWidth="22"
      markerHeight="22"
      refX={refX}
      refY="11"
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      {children}
    </marker>
  );
}

function bars(stroke: string, x1: number, x2?: number) {
  const second =
    x2 == null ? null : (
      <path d={`M${x2},4 L${x2},18`} stroke={stroke} strokeWidth="1.5" fill="none" />
    );
  return (
    <>
      <path d={`M${x1},4 L${x1},18`} stroke={stroke} strokeWidth="1.5" fill="none" />
      {second}
    </>
  );
}

function circle(stroke: string, cx: number) {
  return <circle cx={cx} cy="11" r="3" stroke={stroke} strokeWidth="1.5" fill="none" />;
}

function crowFoot(stroke: string) {
  return (
    <path d="M20,11 L6,4 M20,11 L4,11 M20,11 L6,18" stroke={stroke} strokeWidth="1.5" fill="none" />
  );
}

function arrow(fill: string) {
  return <path d="M8,3 L20,11 L8,19 Z" fill={fill} />;
}

function identityGlyph(notation: Notation, ident: string, stroke: string): ReactNode {
  if (notation === "minimal") {
    return ident === "one" || ident === "zero-one" ? arrow(stroke) : null;
  }
  if (notation === "barker") {
    if (ident === "one") return bars(stroke, 14);
    if (ident === "zero-one")
      return (
        <>
          {circle(stroke, 6)}
          {bars(stroke, 14)}
        </>
      );
    if (ident === "many") return crowFoot(stroke);
    return (
      <>
        {circle(stroke, 5)}
        {crowFoot(stroke)}
      </>
    );
  }
  if (ident === "one") return bars(stroke, 10, 14);
  if (ident === "zero-one")
    return (
      <>
        {circle(stroke, 5)}
        {bars(stroke, 11, 15)}
      </>
    );
  if (ident === "many")
    return (
      <>
        <path d="M10,4 L10,18" stroke={stroke} strokeWidth="1.5" fill="none" />
        {crowFoot(stroke)}
      </>
    );
  return (
    <>
      {circle(stroke, 4)}
      {crowFoot(stroke)}
    </>
  );
}

function refXFor(notation: Notation, ident: string): number {
  if (notation === "minimal") return 20;
  if (ident === "one" || ident === "zero-one") return ident.includes("zero") ? 15 : 14;
  return 20;
}

const IDENTS = ["one", "zero-one", "many", "zero-many"] as const;
const STATES: MarkerState[] = ["rest", "hover", "active"];
const NOTATION_LIST: Notation[] = ["ie", "barker", "minimal"];

const ALIASES: Array<{
  id: string;
  notation: Notation;
  ident: (typeof IDENTS)[number];
  state: MarkerState;
}> = [
  { id: "cf-many", notation: "ie", ident: "many", state: "rest" },
  { id: "cf-many-active", notation: "ie", ident: "many", state: "active" },
  { id: "cf-one", notation: "ie", ident: "one", state: "rest" },
  { id: "cf-one-active", notation: "ie", ident: "one", state: "active" },
  { id: "cf-many-zero-rest", notation: "ie", ident: "zero-many", state: "rest" },
  { id: "cf-many-zero-active", notation: "ie", ident: "zero-many", state: "active" },
];

function ContinueMark({ id, stroke }: { id: string; stroke: string }) {
  return (
    <MarkerShell id={id} refX={12}>
      <path d="M4,4 L12,11 L4,18" stroke={stroke} strokeWidth="1.5" fill="none" />
    </MarkerShell>
  );
}

function TaperedArrow({ id, fill }: { id: string; fill: string }) {
  return (
    <marker
      id={id}
      markerWidth="12"
      markerHeight="12"
      refX="10"
      refY="6"
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <path d="M0,1 L10,6 L0,11 Z" fill={fill} />
    </marker>
  );
}

/** SVG marker defs. Crow's foot / Barker / minimal for FK; tapered arrow for lineage. */
export function EdgeMarkers() {
  const lineage = "hsl(var(--rel-lineage))";
  const active = "hsl(var(--rel-active))";
  const muted = "hsl(var(--rel-muted))";

  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
      <defs>
        {NOTATION_LIST.flatMap((notation) =>
          IDENTS.flatMap((ident) =>
            STATES.map((state) => {
              const id = `${notation}-${ident}-${state}`;
              const stroke = paint(state, notation);
              const glyph = identityGlyph(notation, ident, stroke);
              if (!glyph) return null;
              return (
                <MarkerShell key={id} id={id} refX={refXFor(notation, ident)}>
                  {glyph}
                </MarkerShell>
              );
            }),
          ),
        )}
        {ALIASES.map((a) => (
          <MarkerShell key={a.id} id={a.id} refX={refXFor(a.notation, a.ident)}>
            {identityGlyph(a.notation, a.ident, paint(a.state, a.notation))}
          </MarkerShell>
        ))}
        <ContinueMark id="continue-rest" stroke={muted} />
        <ContinueMark id="continue-active" stroke={active} />
        <TaperedArrow id="lin-arrow" fill={lineage} />
        <TaperedArrow id="lin-arrow-active" fill={active} />
      </defs>
    </svg>
  );
}

export type { Cardinality, MarkerState, Notation };
