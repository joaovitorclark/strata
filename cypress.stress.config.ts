import { execFileSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "cypress";
import type { HeightSample } from "./cypress/support/heightSample";

const root = process.cwd();
const tsx = path.join(root, "node_modules", ".bin", "tsx");
const cli = path.join(root, "cypress", "support", "nodeHeightCli.ts");

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5174",
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 30000,
    responseTimeout: 30000,
    pageLoadTimeout: 120000,
    video: false,
    screenshotOnRunFailure: true,
    // Stress files share a seeded visit; isolation would remount the 200-table
    // fixture per `it`. Smoke specs keep testIsolation: true in cypress.config.ts.
    testIsolation: false,
    reporter: "mochawesome",
    reporterOptions: {
      reportDir: "cypress/reports/mochawesome",
      overwrite: false,
      html: false,
      json: true,
    },
    specPattern: "cypress/e2e/stress-*.cy.ts",
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
      });
    },
  },
});
