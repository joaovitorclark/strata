import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filterProject, fromDbml, toDbtProject, type ProjectFiles } from "../../src/features/dbt-source/index.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DBML = path.join(ROOT, "fixtures/dbt-source/kitchen-sink.dbml");
const OUT = path.join(ROOT, "fixtures/dbt-source/kitchen-sink");

function merge(into: ProjectFiles, extra: ProjectFiles): ProjectFiles {
  return { ...into, ...extra };
}

function writeFiles(root: string, files: ProjectFiles): void {
  rmSync(root, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
}

const dbml = readFileSync(DBML, "utf8");
const full = fromDbml(dbml);
const files = merge(
  merge(
    toDbtProject(filterProject(full, "vendas"), "vendas"),
    toDbtProject(filterProject(full, "estoque"), "estoque"),
  ),
  toDbtProject(filterProject(full, "catalogo"), "catalogo"),
);
writeFiles(OUT, files);
console.log(`wrote ${Object.keys(files).length} files to ${OUT}`);
