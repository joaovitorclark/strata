import { describe, expect, it } from 'vitest';
import type { TableView } from '@/features/schema/model/parse';
import { nodeHeight } from '@/features/canvas/utils/nodeMetrics';
import { COLUMN_VIRTUAL_VIEW_ROWS, COLUMN_VIRTUAL_ROW_H } from '@/features/canvas/utils/scaleLimits';

function tableWithCols(n: number): TableView {
  return {
    id: 'raw.big',
    name: 'big',
    schema: 'raw',
    columns: Array.from({ length: n }, (_, i) => ({
      name: `col_${i}`,
      type: 'string',
      pk: false,
      notNull: false,
    })),
  };
}

describe('nodeHeight', () => {
  it('limita altura quando colunas passam do limiar de virtualização', () => {
    const small = nodeHeight(tableWithCols(10));
    const capped = nodeHeight(tableWithCols(200));
    const full = 34 + 200 * COLUMN_VIRTUAL_ROW_H + 26;
    const virtual = 34 + COLUMN_VIRTUAL_VIEW_ROWS * COLUMN_VIRTUAL_ROW_H + 26;
    expect(small).toBeLessThan(capped);
    expect(capped).toBe(virtual);
    expect(capped).toBeLessThan(full);
  });

  it("usa altura de linha compacta 21 diferente da cozy 25", () => {
    const t = tableWithCols(10);
    expect(nodeHeight(t, { density: "compact" })).not.toBe(nodeHeight(t, { density: "cozy" }));
    expect(nodeHeight(t, { rowH: 21 })).not.toBe(nodeHeight(t, { rowH: 25 }));
    expect(nodeHeight(t)).toBe(nodeHeight(t, { rowH: COLUMN_VIRTUAL_ROW_H }));
    expect(nodeHeight(t, { density: "compact" })).toBe(nodeHeight(t, { rowH: 21 }));
    expect(nodeHeight(t, { state: "full", density: "compact" })).not.toBe(
      nodeHeight(t, { state: "full", density: "cozy" }),
    );
  });
});
