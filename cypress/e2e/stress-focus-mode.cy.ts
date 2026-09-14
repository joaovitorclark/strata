import { nodeSel } from "./canvas-support";
import { readScale } from "../support/stress";

describe("S08 focus stress", () => {
  before(() => {
    cy.seedProject("large");
    cy.get('[data-testid="rf__wrapper"]', { timeout: 60000 }).should("exist");
    cy.wait(1000);
    cy.get(".react-flow__viewport").should(($vp) => {
      expect(readScale($vp[0] as HTMLElement), "200-table fit").to.be.closeTo(0.25, 0.05);
    });
    cy.get('[data-testid="schema-tree"]').contains("t001").click({ force: true });
    cy.get(nodeSel("lake.t001"), { timeout: 30000 }).should("exist");
  });

  it("G11: ativar foco no diagrama de 200 tabelas em < 300ms", () => {
    const seed = "lake.t001";
    cy.get(nodeSel(seed)).click("top", { force: true });
    cy.get(nodeSel(seed)).should("have.class", "selected");

    cy.window().then((win) => {
      const t0 = win.performance.now();
      win.dispatchEvent(
        new win.KeyboardEvent("keydown", {
          key: "f",
          bubbles: true,
          cancelable: true,
        }),
      );
      cy.wrap(null).should(() => {
        expect(win.document.querySelector("[data-testid='focus-hops']"), "focus pill").to.not.equal(
          null,
        );
        const seedEl = win.document.querySelector(nodeSel(seed));
        expect(seedEl, seed).to.not.equal(null);
        expect(parseFloat(win.getComputedStyle(seedEl as Element).opacity), "seed").to.be.closeTo(
          1,
          0.05,
        );
        const rest = win.document.querySelector(".react-flow__node-table:not(.selected)");
        if (rest) {
          expect(parseFloat(win.getComputedStyle(rest).opacity), "rest table dimmed").to.be.closeTo(
            0.15,
            0.05,
          );
        }
        expect(win.performance.now() - t0, "focus apply").to.be.lessThan(300);
      });
    });
  });
});
