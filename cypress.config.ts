import { execFileSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "cypress";
import type { HeightSample } from "./cypress/support/heightSample";

const root = process.cwd();
const tsx = path.join(root, "node_modules", ".bin", "tsx");
const cli = path.join(root, "cypress", "support", "nodeHeightCli.ts");

export default defineConfig({
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
      });
    },
  },
});
