/**
 * Node-side entry so Cypress can call the real `nodeHeight` (autolayout uses this).
 * Invoked by `cy.task("nodeHeights")` via tsx — lod.ts's `@/` alias is resolved by tsx.
 */
import { nodeHeight } from "../../src/features/canvas/utils/nodeMetrics.ts";
import type { HeightSample } from "./heightSample.ts";

const raw = process.argv[2];
if (!raw) {
  process.stderr.write("nodeHeightCli: missing JSON payload\n");
  process.exit(1);
}

const samples = JSON.parse(raw) as HeightSample[];
const out = samples.map((s) =>
  nodeHeight(s.table, { state: s.state, density: s.density ?? "cozy" }),
);
process.stdout.write(JSON.stringify(out));
