import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "cypress";
import type { HeightSample } from "./cypress/support/heightSample";

const root = process.cwd();
const tsx = path.join(root, "node_modules", ".bin", "tsx");
const cli = path.join(root, "cypress", "support", "nodeHeightCli.ts");

function snapshotTree(dir: string): Record<string, { mtimeMs: number; content: string }> {
  const out: Record<string, { mtimeMs: number; content: string }> = {};
  const walk = (current: string) => {
    let entries: string[] = [];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "target" || name === "logs" || name === ".git") continue;
      const full = path.join(current, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else {
        out[path.relative(dir, full).split(path.sep).join("/")] = {
          mtimeMs: st.mtimeMs,
          content: readFileSync(full, "utf8"),
        };
      }
    }
  };
  walk(dir);
  return out;
}

export default defineConfig({
  env: {
    E2E_DATA_DIR: process.env.E2E_DATA_DIR ?? ".e2e-data",
  },
  e2e: {
    // Strata is not a static SPA: Fastify serves the built app AND the API on one
    // port. `vite preview` would serve the app with no API behind it.
    baseUrl: "http://localhost:5174",
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 15000,
    responseTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    testIsolation: true,
    reporter: "mochawesome",
    reporterOptions: {
      reportDir: "cypress/reports/mochawesome",
      overwrite: false,
      html: false,
      json: true,
    },
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
    setupNodeEvents(on) {
      on("task", {
        nodeHeights(samples: HeightSample[]) {
          const out = execFileSync(tsx, [cli, JSON.stringify(samples)], {
            encoding: "utf8",
            cwd: root,
          });
          return JSON.parse(out) as number[];
        },
        snapshotTree(dir: string) {
          return snapshotTree(path.resolve(root, dir));
        },
      });
    },
  },
});
