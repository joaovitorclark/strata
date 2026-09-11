import { animationNameOf, waitForCanvas } from "./canvas-support";

describe("canvas edges", () => {
  beforeEach(() => {
    cy.seedProject("smoke");
    waitForCanvas();
  });

  it("FK has a crow's foot and does not animate", () => {
    cy.get(".edge-path--fk")
      .should("have.length.at.least", 1)
      .closest("[data-testid^='rf__edge-']")
      .should("have.attr", "data-testid")
      .and("match", /^rf__edge-/);

    cy.get(".edge-path--fk").should(($path) => {
      const el = $path[0];
      const start = el.getAttribute("marker-start") ?? "";
      const end = el.getAttribute("marker-end") ?? "";
      expect(start + end, "crow's foot marker").to.match(/cf-many/);
      const anim = animationNameOf(el);
      expect(anim === "none" || anim === "", `FK animation-name was ${anim}`).to.eq(true);
    });
  });
});
