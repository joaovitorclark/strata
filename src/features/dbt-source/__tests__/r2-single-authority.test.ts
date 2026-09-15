import { describe, expect, it } from "vitest";
import { fromDbml, toDbtProject, filterProject, type ProjectFiles } from "@/features/dbt-source";
import { asArray, asRecord, asString, loadYaml } from "@/features/dbt-source/yaml";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const DBML_PATH = path.join(ROOT, "fixtures/dbt-source/kitchen-sink.dbml");
const DBT_DIR = path.join(ROOT, "fixtures/dbt-source/kitchen-sink");

function readProjectFiles(root: string): ProjectFiles {
  const files: ProjectFiles = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "target" || name === "logs" || name === "dbt_packages" || name === ".venv-dbt") {
        continue;
      }
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files[path.relative(root, full).split(path.sep).join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return files;
}

const STRATA_FORBIDDEN = new Set(["pk", "layer", "schema", "table_id", "not_null", "unique"]);

function dualHits(files: Record<string, string>): string[] {
  const hits: string[] = [];
  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.endsWith(".yml") && !filePath.endsWith(".yaml")) continue;
    if (filePath.startsWith(".strata/")) continue;
    const doc = asRecord(loadYaml(content));
    if (!doc) continue;
    const tables = [
      ...asArray(doc.sources).flatMap((s) => {
        const src = asRecord(s);
        return asArray(src?.tables).map((t) => ({ node: asRecord(t), source: src }));
      }),
      ...asArray(doc.models).map((m) => ({ node: asRecord(m), source: undefined })),
    ];
    for (const { node } of tables) {
      if (!node) continue;
      const config = asRecord(node.config);
      const meta = asRecord(config?.meta);
      const strata = asRecord(meta?.strata) ?? {};
      const name = asString(node.name) ?? "?";
      for (const key of STRATA_FORBIDDEN) {
        if (key in strata) hits.push(`${filePath} ${name} meta.strata.${key}`);
      }
      const constraints = asArray(node.constraints);
      const hasPkConstraint = constraints.some((c) => asRecord(c)?.type === "primary_key");
      if (hasPkConstraint && "pk" in strata) {
        hits.push(`${filePath} ${name} pk in meta AND constraints`);
      }
      for (const rawCol of asArray(node.columns)) {
        const col = asRecord(rawCol);
        if (!col) continue;
        const colName = asString(col.name) ?? "?";
        const colConfig = asRecord(col.config);
        const colMeta = asRecord(colConfig?.meta);
        const colStrata = asRecord(colMeta?.strata) ?? {};
        const tests = asArray(col.data_tests);
        const colConstraints = asArray(col.constraints);
        const hasNotNull =
          tests.some(
            (t) => t === "not_null" || (asRecord(t) && "not_null" in (asRecord(t) ?? {})),
          ) || colConstraints.some((c) => asRecord(c)?.type === "not_null");
        const hasUnique =
          tests.some((t) => t === "unique" || (asRecord(t) && "unique" in (asRecord(t) ?? {}))) ||
          colConstraints.some((c) => asRecord(c)?.type === "unique") ||
          constraints.some((c) => asRecord(c)?.type === "unique");
        if (hasNotNull && colStrata.not_null === true) {
          hits.push(`${filePath} ${name}.${colName} not_null in meta AND tests/constraints`);
        }
        if (hasUnique && colStrata.unique === true) {
          hits.push(`${filePath} ${name}.${colName} unique in meta AND tests/constraints`);
        }
        for (const key of STRATA_FORBIDDEN) {
          if (key in colStrata) hits.push(`${filePath} ${name}.${colName} meta.strata.${key}`);
        }
      }
    }
    for (const rawSeed of asArray(doc.seeds)) {
      const seed = asRecord(rawSeed);
      if (!seed) continue;
      const strata = asRecord(asRecord(asRecord(seed.config)?.meta)?.strata) ?? {};
      if ("table_id" in strata) hits.push(`${filePath} seed meta.strata.table_id`);
    }
  }
  return hits;
}

describe("D2 R2 single YAML authority", () => {
  it("kitchen-sink has no semantic fact in two places", () => {
    const files = readProjectFiles(DBT_DIR);
    expect(dualHits(files), dualHits(files).join("\n")).toEqual([]);
  });

  it("toDbtProject does not write pk/layer/schema/table_id/not_null/unique under meta.strata", () => {
    const dbml = readFileSync(DBML_PATH, "utf8");
    const files = toDbtProject(filterProject(fromDbml(dbml), "vendas"), "vendas");
    expect(dualHits(files), dualHits(files).join("\n")).toEqual([]);
  });
});
