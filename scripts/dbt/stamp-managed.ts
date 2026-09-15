import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { stampManaged } from "../../src/features/dbt-source/yamlEdit.managed.ts";
import type { ProjectFiles } from "../../src/features/dbt-source/model.ts";

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

const root = process.argv[2];
const project = process.argv[3] ?? "vendas";
const tableId = process.argv[4] ?? "gold.dim_cliente";
if (!root) {
  console.error("usage: stamp-managed.ts <dir> [project] [tableId]");
  process.exit(1);
}

const files = stampManaged(readProjectFiles(root), project, tableId);
for (const [rel, content] of Object.entries(files)) {
  const dest = path.join(root, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, content, "utf8");
}
console.log(`stamped ${tableId} in ${root}`);
