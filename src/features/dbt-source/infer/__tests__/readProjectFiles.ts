import { readFileSync, readdirSync, statSync } from "node:fs";
import type { ProjectFiles } from "@/features/dbt-source";

export function readProjectFiles(root: string): ProjectFiles {
  const files: ProjectFiles = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "target" || name === "logs" || name === "dbt_packages" || name === ".venv-dbt") {
        continue;
      }
      const full = `${dir}/${name}`;
      if (statSync(full).isDirectory()) walk(full);
      else {
        const rel = full
          .slice(root.length + 1)
          .split(/[/\\]/)
          .join("/");
        files[rel] = readFileSync(full, "utf8");
      }
    }
  };
  walk(root);
  return files;
}
