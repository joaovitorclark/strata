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

function measureState(
  state: LodState,
): Cypress.Chainable<Pick<HeightRow, "id" | "state" | "offsetHeight">[]> {
  clickPane();
  if (state === "sigil") zoomToRange(0.25, 0.54);
  else if (state === "keys") zoomToRange(0.56, 1.09);
  else zoomToRange(1.12, 2);
  waitHubLod(state);

  return cy.then(() => {
    const rows: Pick<HeightRow, "id" | "state" | "offsetHeight">[] = [];
    const next = (
      i: number,
    ): Cypress.Chainable<Pick<HeightRow, "id" | "state" | "offsetHeight">[]> => {
      if (i >= IDS.length) return cy.wrap(rows);
      const id = IDS[i];
      return cy.get(`[data-testid="rf__node-${id}"]`).then(($n) => {
        rows.push({ id, state, offsetHeight: $n[0].offsetHeight });
        return next(i + 1);
      });
    };
    return next(0);
  });
}

function formatTable(rows: HeightRow[]): string {
  const header = "| id | state | offsetHeight | predicted | delta |";
  const sep = "| --- | --- | --- | --- | --- |";
  const body = rows.map(
    (r) => `| ${r.id} | ${r.state} | ${r.offsetHeight} | ${r.predicted} | ${r.delta} |`,
  );
  return [header, sep, ...body].join("\n");
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

  it("matches nodeMetrics.nodeHeight() within 2px in every LOD state", () => {
    const samples: HeightSample[] = heightSamples([...IDS], STATES);
    cy.task<number[]>("nodeHeights", samples).then((predicted) => {
      expect(predicted).to.have.length(samples.length);

      measureState("sigil").then((sigilRows) =>
        measureState("keys").then((keysRows) =>
          measureState("full").then((fullRows) => {
            const painted = [...sigilRows, ...keysRows, ...fullRows];
            const byKey = new Map(painted.map((r) => [`${r.id}|${r.state}`, r]));
            const rows: HeightRow[] = samples.map((s, i) => {
              const hit = byKey.get(`${s.id}|${s.state}`);
              if (!hit) throw new Error(`missing painted height for ${s.id} ${s.state}`);
              const pred = predicted[i];
              return {
                id: s.id,
                state: s.state,
                offsetHeight: hit.offsetHeight,
                predicted: pred,
                delta: hit.offsetHeight - pred,
              };
            });

            const table = formatTable(rows);
            cy.log(table);
            const bad = rows.filter((r) => Math.abs(r.delta) > TOLERANCE);
            cy.writeFile(".superpowers/sdd/task-39-heights.json", rows);
            cy.writeFile(".superpowers/sdd/task-39-height-table.md", `${table}\n`).then(() => {
              expect(bad, `height mismatch > ${TOLERANCE}px\n${table}`).to.have.length(0);
            });
          }),
        ),
      );
    });
  });
});
