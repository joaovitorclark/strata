import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadYaml } from "@/features/dbt-source/yaml";
import { inferProject } from "@/features/dbt-source/infer/inferLineage";
import { originRef, type InferResult } from "@/features/dbt-source/infer/types";
import type { ProjectFiles } from "@/features/dbt-source";
import { readProjectFiles } from "./readProjectFiles";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../../");
const FIXTURE = path.join(ROOT, "fixtures/dbt-source/infer");
const PROJECT = "infer";

function expectedPaths(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".expected.yml")) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

function modelIdOf(expectedFile: string): string {
  const base = path.basename(expectedFile, ".expected.yml");
  return `gold.${base}`;
}

function serializeModel(result: InferResult, modelId: string): Record<string, unknown> {
  const columns: Record<string, { level: string; from: string[] }> = {};
  for (const row of result.lineage.filter((l) => l.target.model === modelId)) {
    columns[row.target.column] = {
      level: row.level,
      from: row.from.map(originRef).sort(),
    };
  }
  const expectedOrder = Object.keys(columns).sort();
  const ordered: Record<string, { level: string; from: string[] }> = {};
  for (const key of expectedOrder) ordered[key] = columns[key];
  const hasError = result.problems.some(
    (p) => p.model === modelId && !p.column && /parse/i.test(p.message),
  );
  return hasError ? { error: true, columns: ordered } : { columns: ordered };
}

function loadExpected(file: string): Record<string, unknown> {
  const raw = loadYaml(readFileSync(file, "utf8")) as Record<string, unknown>;
  const cols = (raw.columns ?? {}) as Record<string, { level: string; from?: string[] }>;
  const columns: Record<string, { level: string; from: string[] }> = {};
  for (const [name, spec] of Object.entries(cols)) {
    columns[name] = { level: spec.level, from: [...(spec.from ?? [])].sort() };
  }
  const ordered: Record<string, { level: string; from: string[] }> = {};
  for (const key of Object.keys(columns).sort()) ordered[key] = columns[key];
  return raw.error ? { error: true, columns: ordered } : { columns: ordered };
}

describe("S13 inferLineage", () => {
  const files = readProjectFiles(FIXTURE);
  const cases = expectedPaths(FIXTURE);
  const result = inferProject(files, PROJECT);

  it("G2: fixture has 13 expected.yml models", () => {
    expect(cases).toHaveLength(13);
  });

  it.each(cases.map((file) => [path.basename(file, ".expected.yml"), file] as const))(
    "G2: %s matches expected.yml",
    (_name, file) => {
      const modelId = modelIdOf(file);
      expect(serializeModel(result, modelId)).toEqual(loadExpected(file));
    },
  );

  it("G3: union all inherits origins by position", () => {
    const id = result.lineage.find(
      (l) => l.target.model === "gold.union_all" && l.target.column === "id",
    );
    const nome = result.lineage.find(
      (l) => l.target.model === "gold.union_all" && l.target.column === "nome",
    );
    expect(id?.from.map(originRef).sort()).toEqual(["raw.alpha.id", "raw.beta.id"]);
    expect(nome?.from.map(originRef).sort()).toEqual(["raw.alpha.nome", "raw.beta.nome"]);
    expect(id?.level).toBe("parsed");
  });

  it("G4: name only when exactly one upstream has the column; two stay unknown", () => {
    const nome = result.lineage.find(
      (l) => l.target.model === "gold.name_two_upstreams" && l.target.column === "nome",
    );
    expect(nome?.level).toBe("unknown");

    const oneUp: ProjectFiles = {
      ...files,
      "models/infer/gold/name_one.sql": "select a.id from {{ source('raw', 'alpha') }} a",
      "models/infer/gold/_name_one.yml": `version: 2
models:
  - name: name_one
    config:
      tags: [strata:infer]
    columns:
      - name: id
        data_type: bigint
      - name: extra
        data_type: bigint
`,
    };
    const one = inferProject(oneUp, PROJECT);
    const extra = one.lineage.find(
      (l) => l.target.model === "gold.name_one" && l.target.column === "extra",
    );
    expect(extra?.level).toBe("name");
    expect(extra?.from.map(originRef)).toEqual(["raw.alpha.extra"]);
  });

  it("G5: unparseable SQL marks the model unknown and stores the error", () => {
    const id = result.lineage.find(
      (l) => l.target.model === "gold.unparseable" && l.target.column === "id",
    );
    expect(id?.level).toBe("unknown");
    const problem = result.problems.find((p) => p.model === "gold.unparseable");
    expect(problem?.message.length).toBeGreaterThan(0);
  });

  it("G8: declared lineage missing from SQL becomes a problem and YAML is untouched", () => {
    const ymlPath = "models/infer/gold/_rename_simple.yml";
    const drifted: ProjectFiles = {
      ...files,
      "models/infer/gold/rename_simple.sql": "select 1 as customer_id, 'x' as nome",
    };
    const ymlBefore = drifted[ymlPath];
    const out = inferProject(drifted, PROJECT);
    expect(
      out.problems.some((p) => p.message.includes("linhagem declarada não encontrada no SQL")),
    ).toBe(true);
    expect(drifted[ymlPath]).toBe(ymlBefore);
    expect(drifted["models/infer/gold/rename_simple.sql"]).toBe(
      "select 1 as customer_id, 'x' as nome",
    );
  });

  it("G9: 200 synthetic manual models infer in ≤ 1.5s", () => {
    const synthetic: ProjectFiles = {
      "dbt_project.yml": files["dbt_project.yml"],
      "models/infer/bronze/_sources.yml": files["models/infer/bronze/_sources.yml"],
      ".strata/infer/project.yml": files[".strata/infer/project.yml"],
    };
    for (let i = 0; i < 200; i += 1) {
      const name = `synth_${i}`;
      synthetic[`models/infer/gold/${name}.sql`] =
        "select id as customer_id, nome from {{ source('raw', 'alpha') }}";
      synthetic[`models/infer/gold/_${name}.yml`] = `version: 2
models:
  - name: ${name}
    columns:
      - name: customer_id
        data_type: bigint
      - name: nome
        data_type: string
`;
    }
    const t0 = performance.now();
    const out = inferProject(synthetic, PROJECT);
    const ms = performance.now() - t0;
    process.stdout.write(`S13 G9 infer 200 models: ${ms.toFixed(1)}ms\n`);
    expect(out.lineage.length).toBeGreaterThan(200);
    expect(ms).toBeLessThanOrEqual(1500);
  });
});
