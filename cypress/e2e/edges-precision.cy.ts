import {
  restoreSmoke,
  selectCanvasDetailLevel,
  snapshotSmoke,
  waitForCanvas,
  type SmokeSnapshot,
} from "./canvas-support";
import { ensureHubFull, pathEndScreen } from "../support/stress";

const FIVE_FK = `
Table star.dim_a {
  id bigint [pk]
}
Table star.dim_b {
  id bigint [pk]
}
Table star.dim_c {
  id bigint [pk]
}
Table star.dim_d {
  id bigint [pk]
}
Table star.dim_e {
  id bigint [pk]
}
Table star.fact {
  a_id bigint
  b_id bigint
  c_id bigint
  d_id bigint
  e_id bigint
}
Ref: star.fact.a_id > star.dim_a.id
Ref: star.fact.b_id > star.dim_b.id
Ref: star.fact.c_id > star.dim_c.id
Ref: star.fact.d_id > star.dim_d.id
Ref: star.fact.e_id > star.dim_e.id
`;

const FIVE_POSITIONS = {
  "star.fact": { x: 480, y: 120 },
  "star.dim_a": { x: 0, y: 0 },
  "star.dim_b": { x: 0, y: 140 },
  "star.dim_c": { x: 0, y: 280 },
  "star.dim_d": { x: 960, y: 0 },
  "star.dim_e": { x: 960, y: 140 },
};

const PAIRS = [
  { factCol: "a_id", dim: "star.dim_a", dimCol: "id" },
  { factCol: "b_id", dim: "star.dim_b", dimCol: "id" },
  { factCol: "c_id", dim: "star.dim_c", dimCol: "id" },
  { factCol: "d_id", dim: "star.dim_d", dimCol: "id" },
  { factCol: "e_id", dim: "star.dim_e", dimCol: "id" },
] as const;

function pathStartScreen(path: SVGPathElement): { x: number; y: number } {
  const pt = path.getPointAtLength(0);
  const ctm = path.getScreenCTM();
  if (!ctm) throw new Error("edge path has no screen CTM");
  return {
    x: ctm.a * pt.x + ctm.c * pt.y + ctm.e,
    y: ctm.b * pt.x + ctm.d * pt.y + ctm.f,
  };
}

function fkPathOf($edge: JQuery<HTMLElement>): SVGPathElement {
  const paths = [...$edge.find("path")];
  const path = paths.find((el) => {
    const p = el as unknown as SVGPathElement;
    return Boolean(
      p.getAttribute("d") && p.classList.contains("edge-path--fk") && p.getTotalLength() > 0,
    );
  }) as unknown as SVGPathElement | undefined;
  if (!path) throw new Error("FK edge path not found");
  return path;
}

function rowCenter(
  tableId: string,
  column: string,
): Cypress.Chainable<{ x1: number; x2: number; y: number }> {
  return cy.get(`[data-testid="rf__node-${tableId}"]`).then(($node) => {
    const handle =
      $node.find(`[data-handleid="s:${column}"]`)[0] ??
      $node.find(`[data-handleid="t:${column}"]`)[0];
    const row = handle?.closest(".col-row") as HTMLElement | null;
    if (!row) throw new Error(`no .col-row ${column} in ${tableId}`);
    const box = row.getBoundingClientRect();
    const nodeBox = $node[0].getBoundingClientRect();
    return { x1: nodeBox.left, x2: nodeBox.right, y: (box.top + box.bottom) / 2 };
  });
}

function seedFiveFks(): void {
  cy.request("PUT", "/api/project", {
    dbml: FIVE_FK,
    canvas: { positions: FIVE_POSITIONS },
  });
  cy.reload();
  cy.get('[data-testid="rf__node-star.fact"]').should("be.visible");
  cy.get('[data-testid="canvas-toolbar"] [data-zoom="fit"]').click({ force: true });
  selectCanvasDetailLevel("Colunas");
  cy.get('[data-testid="rf__node-star.fact"] .col-row').should("have.length", 5);
  cy.get(".edge-path--fk").should("have.length", 5);
}

function assertFiveFkPrecision(): void {
  cy.get(".edge-path--fk").should("have.length", 5);
  for (const pair of PAIRS) {
    const edgeId = `rf__edge-star.fact.${pair.factCol}->${pair.dim}.${pair.dimCol}`;
    rowCenter("star.fact", pair.factCol).then((src) => {
      rowCenter(pair.dim, pair.dimCol).then((tgt) => {
        cy.get(`[data-testid="${edgeId}"]`).then(($edge) => {
          const path = fkPathOf($edge);
          const start = pathStartScreen(path);
          const end = pathEndScreen(path);
          const srcPt = Math.abs(start.y - src.y) <= Math.abs(end.y - src.y) ? start : end;
          const tgtPt = srcPt === start ? end : start;
          expect(Math.abs(srcPt.y - src.y), `${pair.factCol} y`).to.be.at.most(1);
          expect(Math.abs(tgtPt.y - tgt.y), `${pair.dim}.${pair.dimCol} y`).to.be.at.most(1);
          const srcBorder =
            Math.abs(srcPt.x - src.x1) <= Math.abs(srcPt.x - src.x2) ? src.x1 : src.x2;
          const tgtBorder =
            Math.abs(tgtPt.x - tgt.x1) <= Math.abs(tgtPt.x - tgt.x2) ? tgt.x1 : tgt.x2;
          expect(Math.abs(srcPt.x - srcBorder), `${pair.factCol} x`).to.be.at.most(1);
          expect(Math.abs(tgtPt.x - tgtBorder), `${pair.dim} x`).to.be.at.most(1);
        });
      });
    });
  }
}

describe("S09 edge precision", () => {
  let snap: SmokeSnapshot | undefined;

  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    snapshotSmoke().then((s) => {
      snap = s;
    });
  });

  afterEach(() => {
    if (snap) restoreSmoke(snap);
  });

  it("G9: five FK tips sit on the .col-row centre ±1px", () => {
    seedFiveFks();
    assertFiveFkPrecision();
  });

  it("G10: FK tips sit on the node border ±1px", () => {
    seedFiveFks();
    assertFiveFkPrecision();
  });

  it("G11: scrolled-away FK lands on the list edge, not the header", () => {
    cy.seedProject("wide");
    cy.get('[data-testid="rf__node-wide.hub"]').should("exist");
    ensureHubFull();
    cy.get('[data-testid^="rf__edge-wide.left"]').should("have.length.at.least", 1);
    // ~3 rows: FK `id` leaves the visible window but stays in overscan so the edge stays mounted.
    cy.get('[data-testid="rf__node-wide.hub"] .overflow-y-auto').scrollTo(0, 80);
    cy.wait(150);
    cy.get('[data-testid^="rf__edge-wide.left"]').then(($edge) => {
      const path = fkPathOf($edge);
      const start = pathStartScreen(path);
      const end = pathEndScreen(path);
      const hub = Cypress.$('[data-testid="rf__node-wide.hub"]')[0];
      const header = hub.querySelector(".bg-surface") as HTMLElement | null;
      const list = hub.querySelector(".overflow-y-auto") as HTMLElement | null;
      if (!header || !list) throw new Error("hub header/list missing");
      const headerBox = header.getBoundingClientRect();
      const listBox = list.getBoundingClientRect();
      const hubBox = hub.getBoundingClientRect();
      const tip = Math.abs(end.x - hubBox.left) <= Math.abs(start.x - hubBox.left) ? end : start;
      expect(tip.y, "tip below header").to.be.at.least(headerBox.bottom - 1);
      expect(tip.y, "tip on list edge, not past the list").to.be.at.most(listBox.top + 16);
      expect(tip.y, "tip not in the header band").to.be.greaterThan(
        headerBox.top + headerBox.height - 1,
      );
    });
  });

  it("G12: after dragging a node 200px, G9 and G10 still hold", () => {
    seedFiveFks();
    cy.dragNode("star.fact", 200, 0);
    assertFiveFkPrecision();
  });
});
