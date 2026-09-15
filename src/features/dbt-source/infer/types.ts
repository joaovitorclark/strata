export type LineageLevel = "declared" | "parsed" | "name" | "unknown";

export type LineageOrigin = {
  relation: string;
  column: string;
};

export type InferredLineage = {
  target: { model: string; column: string };
  from: LineageOrigin[];
  level: Exclude<LineageLevel, "declared">;
  reason?: string;
};

export type InferProblem = {
  model: string;
  column?: string;
  message: string;
};

export type InferResult = {
  lineage: InferredLineage[];
  problems: InferProblem[];
};

export type DismissedEntry = {
  targetTable: string;
  targetColumn: string;
  from: string;
};

export function lineageKey(
  targetTable: string,
  targetColumn: string,
  fromRelation: string,
  fromColumn: string,
): string {
  return `${targetTable}.${targetColumn} ← ${fromRelation}.${fromColumn}`;
}

export function originRef(origin: LineageOrigin): string {
  return `${origin.relation}.${origin.column}`;
}
