import {
  nodeSel,
  restoreSmoke,
  SMOKE_NODES,
  snapshotSmoke,
  waitForCanvas,
  type SmokeSnapshot,
} from "./canvas-support";

const EMPTY_DBML = "// empty\n";
const PEDIDO = SMOKE_NODES.pedido;

function visitEmpty(snap: SmokeSnapshot): void {
  cy.request("PUT", `/api/projects/${snap.id}`, { dbml: EMPTY_DBML, canvas: {} });
  cy.request("POST", `/api/projects/${snap.id}/activate`);
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.removeItem("strata.minimap");
      win.localStorage.removeItem("strata.detailLevel");
    },
  });
  cy.get('[data-testid="workspace-empty-state"]').should("be.visible");
}

describe("C6 URL sync on empty project", () => {
  let snap: SmokeSnapshot;

  before(() => {
    snapshotSmoke().then((s) => {
      snap = s;
    });
  });

  after(() => {
    cy.then(() => restoreSmoke(snap));
  });

  it("G3: empty project writes detail= to the URL within 500ms", () => {
    visitEmpty(snap);
    cy.location("search", { timeout: 500 }).should((search) => {
      expect(search, "location.search contains detail=").to.include("detail=");
    });
  });

  it("G5: visiting ?project=<smoke>&focus= from another project selects the table", () => {
    restoreSmoke(snap);
    cy.request("GET", "/api/projects").then((res) => {
      const body = res.body as { projects: Array<{ id: string; slug: string }> };
      const smoke = body.projects.find((p) => p.slug === "smoke");
      const wide = body.projects.find((p) => p.slug === "wide");
      if (!smoke || !wide) throw new Error("fixture projects smoke/wide not found");
      cy.request("POST", `/api/projects/${wide.id}/activate`);
      cy.visit(`/?project=${smoke.id}&focus=${PEDIDO}`, {
        onBeforeLoad(win) {
          win.localStorage.removeItem("strata.detailLevel");
        },
      });
      waitForCanvas();
      cy.get(nodeSel(PEDIDO)).should("have.class", "selected");
    });
  });
});
