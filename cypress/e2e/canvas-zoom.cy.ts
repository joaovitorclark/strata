import { fireWindowKey, viewportScaleOf, waitForCanvas } from "./canvas-support";

describe("S03 canvas zoom", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  it("G1: click + increases percent and viewport transform", () => {
    cy.get('[data-testid="zoom-percent"]')
      .invoke("text")
      .then((beforeText) => {
        const beforePct = Number(String(beforeText).replace("%", "").trim());
        cy.get(".react-flow__viewport")
          .invoke("attr", "style")
          .then((beforeStyle) => {
            cy.get('[data-testid="zoom-controls"] [data-zoom="in"]').click();
            cy.get('[data-testid="zoom-percent"]').should(($el) => {
              const afterPct = Number($el.text().replace("%", "").trim());
              expect(afterPct, "percent increased").to.be.greaterThan(beforePct);
            });
            cy.get(".react-flow__viewport").should(($vp) => {
              expect($vp.attr("style"), "viewport transform changed").to.not.eq(beforeStyle);
            });
          });
      });
  });

  it("G2: percent menu 100% sets transform[2] === 1", () => {
    cy.get('[data-testid="zoom-percent"]').click();
    cy.contains('[role="menuitem"]', "100%").click();
    cy.get(".react-flow__viewport").should(($vp) => {
      expect(viewportScaleOf($vp.attr("style")), "transform[2] === 1").to.eq(1);
    });
  });

  it("G3: Cmd/Ctrl 0 sets 100%", () => {
    cy.get('[data-testid="zoom-controls"] [data-zoom="in"]').click();
    cy.get('[data-testid="zoom-controls"] [data-zoom="in"]').click();
    fireWindowKey({ key: "0", code: "Digit0", metaKey: true, ctrlKey: true });
    cy.get(".react-flow__viewport").should(($vp) => {
      expect(viewportScaleOf($vp.attr("style")), "⌘/Ctrl 0 → 100%").to.eq(1);
    });
    cy.get('[data-testid="zoom-percent"]').should("have.text", "100%");
  });
});
