import {
  MINIMAP_MAX_TABLES,
  SKIP_INITIAL_FIT_TABLES,
} from "../../src/features/canvas/utils/scaleLimits";
import { panCanvas, readScale, restoreSmoke } from "../support/stress";

describe("stress large diagram", () => {
  before(() => {
    expect(MINIMAP_MAX_TABLES, "fixture is exactly the minimap threshold").to.eq(200);
    expect(SKIP_INITIAL_FIT_TABLES, "fixture is exactly the skip-fit threshold").to.eq(200);
    cy.seedProject("large");
    cy.get('[data-testid^="rf__node-"]', { timeout: 60000 }).should("exist");
    // InitialFitHelper retries up to 40 rAF frames when enabled.
    cy.wait(1000);
  });

  after(() => {
    restoreSmoke();
  });

  it("still shows the minimap at MINIMAP_MAX_TABLES (hide is strictly greater)", () => {
    cy.get('[data-testid="rf__wrapper"]').should("exist");
    // Canvas: `showMiniMap = tableCount <= MINIMAP_MAX_TABLES`. large has exactly
    // 200 tables, so the minimap is still painted. Hide requires 201+; the
    // committed fixture cannot observe that branch. Do not change Canvas.
    cy.get('[data-testid="rf__minimap"]').should("exist");
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
      cy.get('[data-testid="rf__controls"] .react-flow__controls-zoomin').click({ force: true });
      cy.get(".react-flow__viewport").should(($after) => {
        const z1 = readScale($after[0] as HTMLElement);
        expect(z1, "zoom in moved scale").to.not.eq(z0);
      });
    });
    cy.get('[data-testid="schema-tree"]').should("be.visible");
    cy.get('[data-testid="rf__wrapper"]').should("exist");
    cy.get('[data-testid^="rf__node-"]').should("exist");
  });
});
