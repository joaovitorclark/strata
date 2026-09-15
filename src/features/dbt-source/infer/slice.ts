import type { InferProblem, InferredLineage } from "./types";

export type InferSlice = {
  inferredLineage: InferredLineage[];
  inferredVisible: boolean;
  inferProblems: InferProblem[];
  toggleInferredVisible: () => void;
};

export const inferSliceDefaults: Pick<
  InferSlice,
  "inferredLineage" | "inferredVisible" | "inferProblems"
> = {
  inferredLineage: [],
  inferredVisible: true,
  inferProblems: [],
};
