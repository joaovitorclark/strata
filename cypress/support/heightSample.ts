export type LodState = "sigil" | "keys" | "full";
export type CanvasDensity = "compact" | "cozy";

export type HeightTable = {
  id: string;
  name: string;
  schema?: string;
  columns: Array<{ name: string; type: string; pk: boolean; notNull: boolean }>;
  meta: { pks: string[]; fks: Array<{ column: string; ref: string }> };
};

export type HeightSample = {
  id: string;
  state: LodState;
  table: HeightTable;
  density?: CanvasDensity;
};
