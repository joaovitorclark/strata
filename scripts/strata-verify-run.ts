import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { inspectManaged, verifyReports, type ProjectFiles } from "../src/features/dbt-source/managed.ts";

function walk(root: string): ProjectFiles {
  const files: ProjectFiles = {};
  const rec = (dir: string) => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (
        name === "target" ||
        name === "logs" ||
        name === "dbt_packages" ||
        name === "node_modules" ||
        name === ".git" ||
        name === ".venv-dbt"
      ) {
        continue;
      }
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) rec(full);
      else files[path.relative(root, full).split(path.sep).join("/")] = readFileSync(full, "utf8");
    }
  };
  rec(root);
  return files;
}

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.log("no dbt domain");
  process.exit(0);
}

const files = walk(dir);
const projects = new Set<string>();
for (const p of Object.keys(files)) {
  const m = /^models\/([^/]+)\//.exec(p);
  if (m?.[1]) projects.add(m[1]);
}

const lines: string[] = [];
for (const project of [...projects].sort()) {
  lines.push(...verifyReports(inspectManaged(files, project)).lines);
}

if (lines.length) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

console.log("strata:verify ok");
