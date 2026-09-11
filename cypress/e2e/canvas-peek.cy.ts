import { nodeSel, SMOKE_NODES, waitForCanvas } from "./canvas-support";

describe("canvas edge peek", () => {
  beforeEach(() => {
    cy.seedProject("smoke");
    waitForCanvas();
  });

  it("hovering an edge dims nodes that do not participate", () => {
    cy.get(".edge-path--fk")
      .closest("[data-testid^='rf__edge-']")
      .invoke("attr", "data-testid")
      .then((testid) => {
        expect(testid, "discovered FK edge id").to.match(/^rf__edge-/);
        cy.get(`[data-testid="${testid}"]`).trigger("mouseover", {
          force: true,
          eventConstructor: "MouseEvent",
        });
        cy.get(`[data-testid="${testid}"]`).trigger("mouseenter", {
          force: true,
          eventConstructor: "MouseEvent",
        });
      });

    cy.get(`${nodeSel(SMOKE_NODES.item)}`).should(($n) => {
      const wrap = $n.find(".relative").first();
      expect(parseFloat(wrap.css("opacity"))).to.be.closeTo(0.34, 0.02);
    });
    cy.get(`${nodeSel(SMOKE_NODES.resumo)}`).should(($n) => {
      const wrap = $n.find(".relative").first();
      expect(parseFloat(wrap.css("opacity"))).to.be.closeTo(0.34, 0.02);
    });
    cy.get(`${nodeSel(SMOKE_NODES.pedido)}`).should(($n) => {
      const wrap = $n.find(".relative").first();
      expect(parseFloat(wrap.css("opacity"))).to.be.closeTo(1, 0.02);
    });
    cy.get(`${nodeSel(SMOKE_NODES.cliente)}`).should(($n) => {
      const wrap = $n.find(".relative").first();
      expect(parseFloat(wrap.css("opacity"))).to.be.closeTo(1, 0.02);
    });
  });
});
