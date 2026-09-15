import type { ProjectFiles } from "../model";
import { asArray, asRecord, loadYaml } from "../yaml";
import type { DismissedEntry } from "./types";
import { lineageKey } from "./types";

export function loadDismissed(files: ProjectFiles, project: string): Set<string> {
  const raw = files[`.strata/${project}/lineage-dismissed.yml`];
  if (!raw) return new Set();
  const doc = asRecord(loadYaml(raw));
  return new Set(asArray(doc?.dismissed).map((item) => String(item)));
}

export function dismissedKey(entry: DismissedEntry): string {
  return lineageKey(entry.targetTable, entry.targetColumn, ...splitFrom(entry.from));
}

function splitFrom(from: string): [string, string] {
  const last = from.lastIndexOf(".");
  if (last <= 0) return [from, ""];
  return [from.slice(0, last), from.slice(last + 1)];
}
