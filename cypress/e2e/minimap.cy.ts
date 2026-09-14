import { fireWindowKey, waitForCanvas } from "./canvas-support";

function visitCleared(slug: "smoke" | "large"): void {
  cy.request("GET", "/api/projects").then((res) => {
    const body = res.body as { projects: Array<{ id: string; slug: string }> };
    const proj = body.projects.find((p) => p.slug === slug);
    if (!proj) throw new Error(`fixture project "${slug}" not found`);
    cy.request("POST", `/api/projects/${proj.id}/activate`);
  });
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.removeItem("strata.minimap");
      win.localStorage.removeItem("strata.detailLevel");
    },
  });
}

describe("S12 minimap", () => {
  it("G1: M alterna .react-flow__minimap", () => {
    visitCleared("smoke");
    waitForCanvas();
    cy.get(".react-flow__minimap").should("not.exist");
    fireWindowKey({ key: "m" });
    cy.get(".react-flow__minimap").should("exist");
    fireWindowKey({ key: "m" });
    cy.get(".react-flow__minimap").should("not.exist");
  });

  it("G2: fixture com > 40 tabelas → minimap visível por padrão", () => {
    visitCleared("large");
    cy.get('[data-testid^="rf__node-"]', { timeout: 60000 }).should("exist");
    cy.get(".react-flow__minimap").should("be.visible");
  });

  it("G3: minimap não sobrepõe a pill (bounding boxes disjuntas)", () => {
    visitCleared("smoke");
    waitForCanvas();
    fireWindowKey({ key: "m" });
    cy.get(".react-flow__minimap").should("be.visible");
    cy.get('[data-testid="canvas-toolbar"]').should("be.visible");
    cy.get(".react-flow__minimap").then(($map) => {
      cy.get('[data-testid="canvas-toolbar"]').then(($pill) => {
        const map = $map[0].getBoundingClientRect();
        const pill = $pill[0].getBoundingClientRect();
        const disjoint =
          map.right <= pill.left ||
          pill.right <= map.left ||
          map.bottom <= pill.top ||
          pill.bottom <= map.top;
        expect(disjoint, "minimap and pill bounding boxes are disjoint").to.eq(true);
      });
    });
  });
});
