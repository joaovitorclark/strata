import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contextFromFiles,
  toDbtSql,
  toSparkSql,
} from "../../src/features/dbt-source/transform.ts";
import type { ProjectFiles } from "../../src/features/dbt-source/model.ts";

const FIVE = ["rename_simples", "expr_cast", "left_join", "where_filter", "group_agg"] as const;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../..");
const FIXTURE = path.join(ROOT, "fixtures/dbt-source/transform");

function readProjectFiles(root: string): ProjectFiles {
  const files: ProjectFiles = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "target" || name === "logs" || name === "dbt_packages") continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files[path.relative(root, full).split(path.sep).join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return files;
}

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: emit-transform-sql.ts <spark-out-dir>");
  process.exit(1);
}

const files = readProjectFiles(FIXTURE);
const ctx = contextFromFiles(files, "demo");
mkdirSync(outDir, { recursive: true });
let failed = false;
for (const name of FIVE) {
  const generated = toDbtSql(ctx, name);
  const onDisk = files[`models/demo/gold/${name}.sql`];
  if (generated !== onDisk) {
    console.error(`fixture SQL drift: ${name}`);
    console.error("--- generated ---");
    console.error(generated);
    console.error("--- disk ---");
    console.error(onDisk);
    failed = true;
  }
  const spark = toSparkSql(ctx, name, { catalog: "main" });
  writeFileSync(path.join(outDir, `${name}.sql`), spark);
  writeFileSync(path.join(outDir, `${name}.dbt.sql`), generated);
}
if (failed) process.exit(1);
console.log(`wrote ${FIVE.length} spark sql files to ${outDir}`);
