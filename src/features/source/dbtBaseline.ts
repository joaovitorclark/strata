import type { ProjectFiles } from "@/features/dbt-source";

let baseline: ProjectFiles = {};
let capturedFor: string | null = null;

export function noteDbtBaseline(hydratedProjectId: string | null, files: ProjectFiles): void {
  if (!hydratedProjectId) return;
  if (Object.keys(files).length === 0) return;
  if (capturedFor === hydratedProjectId) return;
  baseline = { ...files };
  capturedFor = hydratedProjectId;
}

export function dbtBaselineFiles(): ProjectFiles {
  return baseline;
}

export function resetDbtBaseline(): void {
  baseline = {};
  capturedFor = null;
}
