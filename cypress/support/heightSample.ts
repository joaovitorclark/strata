export type LodState = "sigil" | "keys" | "full" | "docs";
export type CanvasDensity = "compact" | "cozy";

export type HeightTable = {
  id: string;
  name: string;
  schema?: string;
  note?: string;
  columns: Array<{ name: string; type: string; pk: boolean; notNull: boolean; note?: string }>;
  meta: { pks: string[]; fks: Array<{ column: string; ref: string }>; note?: string };
};

export type HeightSample = {
  id: string;
  state: LodState;
  table: HeightTable;
  density?: CanvasDensity;
};
