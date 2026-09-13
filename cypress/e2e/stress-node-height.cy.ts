import {
  clickPane,
  collapseLayersPanel,
  heightSamples,
  restoreSmoke,
  zoomToRange,
  type HeightRow,
  type HeightSample,
  type LodState,
} from "../support/stress";

const IDS = ["wide.hub", "wide.left", "wide.right"] as const;
const STATES: LodState[] = ["sigil", "keys", "full"];
const DENSITIES = ["cozy", "compact"] as const;
const TOLERANCE = 2;

function waitHubLod(state: LodState): void {
  const hub = '[data-testid="rf__node-wide.hub"]';
  if (state === "sigil") {
    cy.get(hub).should(($n) => {
      expect($n.find('input[aria-label="Filter columns"]').length).to.eq(0);
      expect($n.text()).to.match(/cols/);
    });
    return;
  }
  if (state === "keys") {
    cy.get(hub).contains(/more columns/);
    return;
  }
  cy.get(`${hub} input[aria-label="Filter columns"]`).should("exist");
}

function setDensity(density: (typeof DENSITIES)[number]): void {
  const compact = density === "compact";
  cy.get('[aria-label="Densidade"]').then(($btn) => {
    if ($btn.attr("aria-pressed") === String(compact)) return;
    cy.wrap($btn).click();
  });
  cy.get('[aria-label="Densidade"]').should("have.attr", "aria-pressed", String(compact));
}

function measureState(
  state: LodState,
  density: (typeof DENSITIES)[number],
): Cypress.Chainable<Pick<HeightRow, "id" | "state" | "density" | "offsetHeight">[]> {
  clickPane();
  if (state === "sigil") zoomToRange(0.25, 0.54);
  else if (state === "keys") zoomToRange(0.56, 1.09);
  else zoomToRange(1.12, 2);
  waitHubLod(state);

  return cy.then(() => {
    const rows: Pick<HeightRow, "id" | "state" | "density" | "offsetHeight">[] = [];
    const next = (
      i: number,
    ): Cypress.Chainable<Pick<HeightRow, "id" | "state" | "density" | "offsetHeight">[]> => {
      if (i >= IDS.length) return cy.wrap(rows);
      const id = IDS[i];
      return cy.get(`[data-testid="rf__node-${id}"]`).then(($n) => {
        rows.push({ id, state, density, offsetHeight: $n[0].offsetHeight });
        return next(i + 1);
      });
    };
    return next(0);
  });
}

function formatTable(rows: HeightRow[]): string {
  const header = "| id | density | state | offsetHeight | predicted | delta |";
  const sep = "| --- | --- | --- | --- | --- | --- |";
  const body = rows.map(
    (r) =>
      `| ${r.id} | ${r.density ?? "cozy"} | ${r.state} | ${r.offsetHeight} | ${r.predicted} | ${r.delta} |`,
  );
  return [header, sep, ...body].join("\n");
}

function measureDensity(
  density: (typeof DENSITIES)[number],
): Cypress.Chainable<Pick<HeightRow, "id" | "state" | "density" | "offsetHeight">[]> {
  setDensity(density);
  return measureState("sigil", density).then((sigilRows) =>
    measureState("keys", density).then((keysRows) =>
      measureState("full", density).then((fullRows) => [...sigilRows, ...keysRows, ...fullRows]),
    ),
  );
}

describe("stress node height", () => {
  before(() => {
    cy.seedProject("wide");
    cy.get('[data-testid="rf__node-wide.hub"]').should("exist");
    collapseLayersPanel();
  });

  after(() => {
    restoreSmoke();
  });

  it("matches nodeMetrics.nodeHeight() within 2px in every LOD state and density", () => {
    const samples: HeightSample[] = DENSITIES.flatMap((density) =>
      heightSamples([...IDS], STATES, density),
    );
    cy.task<number[]>("nodeHeights", samples).then((predicted) => {
      expect(predicted).to.have.length(samples.length);

      measureDensity("cozy").then((cozyRows) =>
        measureDensity("compact").then((compactRows) => {
          const painted = [...cozyRows, ...compactRows];
          const byKey = new Map(painted.map((r) => [`${r.id}|${r.density}|${r.state}`, r]));
          const rows: HeightRow[] = samples.map((s, i) => {
            const density = s.density ?? "cozy";
            const hit = byKey.get(`${s.id}|${density}|${s.state}`);
            if (!hit) throw new Error(`missing painted height for ${s.id} ${density} ${s.state}`);
            const pred = predicted[i];
            return {
              id: s.id,
              state: s.state,
              density,
              offsetHeight: hit.offsetHeight,
              predicted: pred,
              delta: hit.offsetHeight - pred,
            };
          });

          const table = formatTable(rows);
          cy.log(table);
          const bad = rows.filter((r) => Math.abs(r.delta) > TOLERANCE);
          cy.writeFile(".superpowers/sdd/task-43-heights.json", rows);
          cy.writeFile(".superpowers/sdd/task-43-height-table.md", `${table}\n`).then(() => {
            expect(bad, `height mismatch > ${TOLERANCE}px\n${table}`).to.have.length(0);
          });
        }),
      );
    });
  });
});
