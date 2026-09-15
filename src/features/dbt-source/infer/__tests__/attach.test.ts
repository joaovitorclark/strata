import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { attachInferredLineage } from "@/features/dbt-source/infer/attach";
import { fromDbtProject } from "@/features/dbt-source/fromDbtProject";
import { toParseResult } from "@/features/dbt-source/toParseResult";
import { readProjectFiles } from "./readProjectFiles";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../../");

describe("S13 attachInferredLineage", () => {
  it("merges inferred edges in memory without mutating files", () => {
    const files = readProjectFiles(path.join(ROOT, "fixtures/dbt-source/infer"));
    const snapshot = { ...files };
    const parsed = toParseResult(fromDbtProject(files, "infer"));
    const attached = attachInferredLineage(files, "infer", parsed);
    expect(attached.inferredLineage.some((l) => l.level === "parsed")).toBe(true);
    expect(attached.parsed?.lineageFields.length).toBeGreaterThan(parsed.lineageFields.length);
    expect(files).toEqual(snapshot);
  });
});
