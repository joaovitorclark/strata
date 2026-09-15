import {
  MINIMAP_MAX_TABLES,
  SKIP_INITIAL_FIT_TABLES,
} from "../../src/features/canvas/utils/scaleLimits";
import { panCanvas, readScale, restoreSmoke } from "../support/stress";

type ProjectBody = { dbml: string; canvas?: unknown };

const EXTRA_TABLE = `
Table lake.t201 {
  id bigint [pk]
  a int
  b string
}
`;

function visitLarge(): void {
  cy.request("GET", "/api/projects").then((res) => {
    const body = res.body as { projects: Array<{ id: string; slug: string }> };
    const proj = body.projects.find((p) => p.slug === "large");
    if (!proj) throw new Error('fixture project "large" not found');
    cy.request("POST", `/api/projects/${proj.id}/activate`);
  });
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.removeItem("strata.detailLevel");
      win.localStorage.removeItem("strata.minimap");
    },
  });
  cy.get('[data-testid^="rf__node-"]', { timeout: 60000 }).should("exist");
}

describe("stress large diagram", () => {
  let largeId: string | undefined;
  let largeSnap: ProjectBody | undefined;

  before(() => {
    expect(MINIMAP_MAX_TABLES, "fixture is exactly the minimap threshold").to.eq(200);
    expect(SKIP_INITIAL_FIT_TABLES, "fixture is exactly the skip-fit threshold").to.eq(200);
    visitLarge();
    // InitialFitHelper retries up to 40 rAF frames when enabled.
    cy.wait(1000);
    cy.request("GET", "/api/projects").then((res) => {
      const body = res.body as { projects: Array<{ id: string; slug: string }> };
      const proj = body.projects.find((p) => p.slug === "large");
      if (!proj) throw new Error('fixture project "large" not found');
      largeId = proj.id;
      cy.request("GET", `/api/projects/${proj.id}`).then((got) => {
        largeSnap = got.body as ProjectBody;
      });
    });
  });

  after(() => {
    if (largeId && largeSnap) {
      cy.request("PUT", `/api/projects/${largeId}`, {
        dbml: largeSnap.dbml,
        canvas: largeSnap.canvas ?? {},
      });
    }
    restoreSmoke();
  });

  it("mounts the minimap at MINIMAP_MAX_TABLES (S12 G2: >40 tables → on by default)", () => {
    cy.get('[data-testid="rf__wrapper"]').should("exist");
    cy.get(".react-flow__minimap").should("exist");
  });

  it("still runs the initial fitView at SKIP_INITIAL_FIT_TABLES (skip is strictly greater)", () => {
    // Canvas: InitialFitHelper enabled when `tableCount <= SKIP_INITIAL_FIT_TABLES`.
    // Packed 200-table fit hits minZoom (0.25). Skip would leave zoom near 1.
    cy.get(".react-flow__viewport").should(($vp) => {
      const z = readScale($vp[0] as HTMLElement);
      expect(z, "fitView packed the 200-table diagram to minZoom").to.be.closeTo(0.25, 0.05);
    });
  });

  it("pans and zooms without the page becoming unresponsive", () => {
    cy.get('[data-testid="schema-tree"]').should("exist");
    cy.get(".react-flow__viewport").then(($vp) => {
      const before = ($vp[0] as HTMLElement).style.transform;
      panCanvas(180, 120);
      cy.get(".react-flow__viewport").should(($after) => {
        expect(($after[0] as HTMLElement).style.transform, "pan changed the viewport").to.not.eq(
          before,
        );
      });
    });
    cy.get(".react-flow__viewport").then(($vp) => {
      const z0 = readScale($vp[0] as HTMLElement);
      cy.get('[data-testid="canvas-toolbar"] [data-zoom="in"]').click({ force: true });
      cy.get(".react-flow__viewport").should(($after) => {
        const z1 = readScale($after[0] as HTMLElement);
        expect(z1, "zoom in moved scale").to.not.eq(z0);
      });
    });
    cy.get('[data-testid="schema-tree"]').should("be.visible");
    cy.get('[data-testid="rf__wrapper"]').should("exist");
    cy.get('[data-testid^="rf__node-"]').should("exist");
  });

  it("mounts the minimap above MINIMAP_MAX_TABLES unless the user turned it off", () => {
    cy.then(() => {
      if (!largeId || !largeSnap) throw new Error("large fixture snapshot missing");
      cy.request("PUT", `/api/projects/${largeId}`, {
        dbml: `${largeSnap.dbml}\n${EXTRA_TABLE}`,
        canvas: largeSnap.canvas ?? {},
      });
    });
    visitLarge();
    cy.get(".react-flow__minimap").should("exist");
    cy.then(() => {
      if (!largeId || !largeSnap) return;
      cy.request("PUT", `/api/projects/${largeId}`, {
        dbml: largeSnap.dbml,
        canvas: largeSnap.canvas ?? {},
      });
    });
  });
});
