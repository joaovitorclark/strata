import type { ParseResult } from "@/features/schema/model/parse";
import type { ProjectFiles } from "../model";
import { inferProject, inferredToFieldLineage } from "./inferLineage";
import type { InferProblem, InferredLineage } from "./types";

function mappingKey(m: {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}): string {
  return `${m.sourceTable}.${m.sourceColumn}->${m.targetTable}.${m.targetColumn}`;
}

export function attachInferredLineage(
  files: ProjectFiles,
  project: string,
  parsed: ParseResult | null,
): {
  parsed: ParseResult | null;
  inferredLineage: InferredLineage[];
  inferProblems: InferProblem[];
  problemMessages: string[];
} {
  const inferred = inferProject(files, project);
  const extra = inferredToFieldLineage(inferred.lineage);
  const problemMessages = inferred.problems.map((p) =>
    p.column ? `${p.model}.${p.column}: ${p.message}` : `${p.model}: ${p.message}`,
  );
  if (!parsed) {
    return {
      parsed,
      inferredLineage: inferred.lineage,
      inferProblems: inferred.problems,
      problemMessages,
    };
  }
  const existing = new Set(parsed.lineageFields.map(mappingKey));
  return {
    parsed: {
      ...parsed,
      lineageFields: [
        ...parsed.lineageFields,
        ...extra.filter((row) => !existing.has(mappingKey(row))),
      ],
    },
    inferredLineage: inferred.lineage,
    inferProblems: inferred.problems,
    problemMessages,
  };
}
