import { useMemo } from "react";

import type { TableMeta } from "@/features/canvas/actions";

import { shortName, tableFromRef } from "./types";

type RelatedTablesSectionProps = {
  tableId: string;
  meta: TableMeta;
  onFocusTable?: (tableId: string) => void;
};

const WIDTH = 240;
const HEIGHT = 160;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const RX = 78;
const RY = 52;

export function RelatedTablesSection({ tableId, meta, onFocusTable }: RelatedTablesSectionProps) {
  const neighbors = useMemo(() => {
    const ids = new Set<string>();
    for (const fk of meta.fks) ids.add(tableFromRef(fk.ref));
    for (const incoming of meta.refsIn) ids.add(incoming);
    ids.delete(tableId);
    return [...ids];
  }, [meta.fks, meta.refsIn, tableId]);

  return (
    <svg
      data-testid="inspector-related-svg"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mx-auto text-foreground"
    >
      {neighbors.map((id, index) => {
        const angle =
          neighbors.length === 0 ? 0 : (2 * Math.PI * index) / neighbors.length - Math.PI / 2;
        const x = CX + RX * Math.cos(angle);
        const y = CY + RY * Math.sin(angle);
        return (
          <g key={id}>
            <line x1={CX} y1={CY} x2={x} y2={y} className="stroke-border" strokeWidth={1} />
            <g
              role="button"
              tabIndex={0}
              data-testid={`inspector-related-${id}`}
              className="cursor-pointer"
              onClick={() => onFocusTable?.(id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onFocusTable?.(id);
              }}
            >
              <rect
                x={x - 36}
                y={y - 10}
                width={72}
                height={20}
                rx={3}
                className="fill-muted stroke-border"
              />
              <text
                x={x}
                y={y + 3}
                textAnchor="middle"
                className="fill-foreground font-mono text-[10px]"
              >
                {shortName(id)}
              </text>
            </g>
          </g>
        );
      })}
      <rect
        x={CX - 40}
        y={CY - 12}
        width={80}
        height={24}
        rx={3}
        className="fill-card stroke-ring"
      />
      <text x={CX} y={CY + 4} textAnchor="middle" className="fill-foreground font-mono text-[10px]">
        {shortName(tableId)}
      </text>
    </svg>
  );
}
