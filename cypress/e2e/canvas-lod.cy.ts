import {
  assertColumnNameCount,
  collapseLayersPanel,
  nodeSel,
  PEDIDO_COLUMNS,
  SMOKE_NODES,
  viewportScaleOf,
  waitForCanvas,
  zoomUntil,
} from "./canvas-support";

describe("canvas LOD", () => {
  beforeEach(() => {
    cy.seedProject("smoke");
    waitForCanvas();
    collapseLayersPanel();
  });

  it("zoom past 55% collapses to Sigil; zoom past 110% with selection opens Full", () => {
    const id = SMOKE_NODES.pedido;

    zoomUntil((z) => z < 0.55, "out");
    cy.get(".react-flow__viewport").should(($vp) => {
      expect(viewportScaleOf($vp.attr("style"))).to.be.lessThan(0.55);
    });
    assertColumnNameCount(id, PEDIDO_COLUMNS, 0);

    cy.get(nodeSel(id)).click("top", { force: true });
    cy.get(nodeSel(id)).should("have.class", "selected");

    zoomUntil((z) => z > 1.1, "in");
    cy.get(".react-flow__viewport").should(($vp) => {
      expect(viewportScaleOf($vp.attr("style"))).to.be.greaterThan(1.1);
    });
    assertColumnNameCount(id, PEDIDO_COLUMNS, PEDIDO_COLUMNS.length);
  });
});
