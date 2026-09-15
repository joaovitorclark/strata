#!/usr/bin/env node
/**
 * `npm run strata:verify` — exit 0 when there is no dbt domain, or when every
 * Strata-managed model matches its lock and markers. Exit 1 lists drifted /
 * divergent models by name.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kitchen = path.join(root, "fixtures/dbt-source/kitchen-sink");

function isDbtDomain(dir) {
  return existsSync(path.join(dir, "dbt_project.yml"));
}

const requested = process.argv[2] ?? process.env.STRATA_VERIFY_DIR;
const dir = requested ? path.resolve(process.cwd(), requested) : isDbtDomain(kitchen) ? kitchen : null;

if (!dir || !isDbtDomain(dir)) {
  console.log("no dbt domain");
  process.exit(0);
}

const tsx = path.join(root, "node_modules", ".bin", "tsx");
const runner = path.join(root, "scripts", "strata-verify-run.ts");
const result = spawnSync(tsx, [runner, dir], { cwd: root, stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
