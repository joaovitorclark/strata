import {
  animationNameOf,
  fireWindowKey,
  restoreSmoke,
  snapshotSmoke,
  waitForCanvas,
  type SmokeSnapshot,
} from "./canvas-support";

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

  it("aggregated lineage edge paints when Mostrar linhagem is checked", () => {
    cy.get(".layers-panel").then(($p) => {
      if ($p.hasClass("is-collapsed")) {
        cy.wrap($p).find(".layers-panel__collapse").click({ force: true });
      }
    });
    cy.get(".layers-panel").should("not.have.class", "is-collapsed");
    cy.contains("label", "Mostrar linhagem").find("input[type=checkbox]").check({ force: true });
    cy.get('[data-testid^="rf__edge-fla:"]').should("exist");
    cy.get(".edge-path--lineage").should(($path) => {
      expect($path.length, "aggregated lineage path").to.be.at.least(1);
      expect(animationNameOf($path[0])).to.match(/lineage-flow/);
    });
  });

  it("Delete removes the selected Ref from the canvas and the DBML", () => {
    let snap: SmokeSnapshot | undefined;
    snapshotSmoke().then((s) => {
      snap = s;
      const before = (s.dbml.match(/^Ref:/gm) ?? []).length;
      expect(before, "smoke fixture has one Ref").to.eq(1);

      cy.get(".edge-path--fk").click({ force: true });
      cy.get(".edge-path--fk")
        .closest("[data-testid^='rf__edge-']")
        .should("have.class", "selected");

      fireWindowKey({ key: "Delete" });

      cy.get(".edge-path--fk").should("not.exist");
      cy.get('[aria-label="DBML"]').click();
      cy.get('[data-testid="source-drawer"] .cm-content').should(($el) => {
        const text = $el.text();
        const after = (text.match(/Ref:/g) ?? []).length;
        expect(after, "working DBML lost exactly one Ref").to.eq(before - 1);
      });
    });
    cy.then(() => {
      if (snap) restoreSmoke(snap);
    });
  });
});
