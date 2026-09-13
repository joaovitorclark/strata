#!/usr/bin/env node
/**
 * Serve the production build for Cypress against a disposable copy of the
 * committed fixture data dir. Saves must not write cypress/fixtures/data/.
 *
 * Override PORT or E2E_DATA_DIR when an agent needs its own copy:
 *   PORT=5175 E2E_DATA_DIR=.e2e-data-49 node scripts/e2e-serve.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "cypress", "fixtures", "data");
const DEST = path.resolve(ROOT, process.env.E2E_DATA_DIR ?? ".e2e-data");
const PORT = process.env.PORT ?? "5174";

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.cpSync(SRC, DEST, { recursive: true });

const child = spawn("npm", ["run", "start"], {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    STRATA_DATA_DIR: DEST,
    STRATA_DOMAIN: process.env.STRATA_DOMAIN ?? "local",
    PORT,
  },
});

const stop = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
