import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  confirmInferredLineage,
  dismissInferredLineage,
} from "@/features/dbt-source/yamlEdit.infer";
import { inferProject } from "@/features/dbt-source/infer/inferLineage";
import { originRef } from "@/features/dbt-source/infer/types";
import { readProjectFiles } from "./readProjectFiles";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../../");
const PROJECT = "infer";
const YML = "models/infer/gold/_rename_simple.yml";
const SQL = "models/infer/gold/rename_simple.sql";
const DISMISSED = ".strata/infer/lineage-dismissed.yml";

function load() {
  return readProjectFiles(path.join(ROOT, "fixtures/dbt-source/infer"));
}

describe("S13 confirm / dismiss", () => {
  it("G6: confirm writes lineage with inferred: and only those YAML lines", () => {
    const files = load();
    const beforeSql = files[SQL];
    const result = confirmInferredLineage(files, PROJECT, {
      targetTable: "gold.rename_simple",
      targetColumn: "customer_id",
      from: "raw.alpha.id",
      inferred: "parsed",
    });
    expect(result.files[SQL]).toBe(beforeSql);
    expect(Object.keys(result.changes)).toEqual([YML]);
    expect(result.files[YML]).toContain("from: raw.alpha.id");
    expect(result.files[YML]).toContain("inferred: parsed");
    for (const [key, content] of Object.entries(files)) {
      if (key === YML) continue;
      expect(result.files[key], key).toBe(content);
    }
    expect(result.files[YML]).toContain("from: raw.alpha.nome");
  });

  it("G7: dismiss writes lineage-dismissed.yml and the next inference omits it", () => {
    const files = load();
    const result = dismissInferredLineage(files, PROJECT, {
      targetTable: "gold.rename_simple",
      targetColumn: "customer_id",
      from: "raw.alpha.id",
    });
    expect(result.changes[DISMISSED]).toBeTruthy();
    expect(result.files[DISMISSED]).toContain("gold.rename_simple.customer_id ← raw.alpha.id");
    expect(result.files[SQL]).toBe(files[SQL]);
    const next = inferProject(result.files, PROJECT);
    const hit = next.lineage.find(
      (l) =>
        l.target.model === "gold.rename_simple" &&
        l.target.column === "customer_id" &&
        l.from.some((o) => originRef(o) === "raw.alpha.id"),
    );
    expect(hit).toBeUndefined();
  });
});
