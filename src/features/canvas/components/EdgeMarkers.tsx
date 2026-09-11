import type { Cardinality } from "@/features/schema/model/parse";

import "./edgeClasses.css";

export function relationMarkerUrl(rel: Cardinality, active: boolean): string {
  const many = rel === "*";
  if (active) return many ? "url(#cf-many-active)" : "url(#cf-one-active)";
  return many ? "url(#cf-many)" : "url(#cf-one)";
}

export function lineageMarkerUrl(active: boolean): string {
  return active ? "url(#lin-arrow-active)" : "url(#lin-arrow)";
}

function CrowFootMany({ id, stroke }: { id: string; stroke: string }) {
  return (
    <marker
      id={id}
      markerWidth="22"
      markerHeight="22"
      refX="20"
      refY="11"
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <path
        d="M20,11 L6,4 M20,11 L4,11 M20,11 L6,18"
        stroke={stroke}
        strokeWidth="1.5"
        fill="none"
      />
    </marker>
  );
}

function CrowFootOne({ id, stroke }: { id: string; stroke: string }) {
  return (
    <marker
      id={id}
      markerWidth="22"
      markerHeight="22"
      refX="14"
      refY="11"
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <path d="M14,4 L14,18" stroke={stroke} strokeWidth="1.5" fill="none" />
    </marker>
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

/** SVG marker defs. Crow's foot for FK; tapered arrow for lineage. Token-coloured. */
export function EdgeMarkers() {
  const fk = "hsl(var(--rel-fk))";
  const lineage = "hsl(var(--rel-lineage))";
  const active = "hsl(var(--rel-active))";

  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
      <defs>
        <CrowFootMany id="cf-many" stroke={fk} />
        <CrowFootOne id="cf-one" stroke={fk} />
        <CrowFootMany id="cf-many-active" stroke={active} />
        <CrowFootOne id="cf-one-active" stroke={active} />
        <TaperedArrow id="lin-arrow" fill={lineage} />
        <TaperedArrow id="lin-arrow-active" fill={active} />
      </defs>
    </svg>
  );
}
