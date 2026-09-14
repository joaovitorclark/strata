import {
  fireWindowKey,
  nodeSel,
  rubberBandCovering,
  SMOKE_NODES,
  waitForCanvas,
} from "./canvas-support";

const THREE = [SMOKE_NODES.cliente, SMOKE_NODES.pedido, SMOKE_NODES.item] as const;

function visitWithForcedPanOnDrag(): void {
  cy.request("GET", "/api/projects").then((res) => {
    const body = res.body as { projects: Array<{ id: string; slug: string }> };
    const proj = body.projects.find((p) => p.slug === "smoke");
    if (!proj) throw new Error('fixture project "smoke" not found');
    cy.request("POST", `/api/projects/${proj.id}/activate`);
  });
  cy.readFile("cypress/fixtures/data/domains/local/projects/smoke/project.dbml").then((dbml) => {
    cy.readFile("cypress/fixtures/data/domains/local/projects/smoke/canvas.json").then((canvas) => {
      cy.request("PUT", "/api/project", { dbml, canvas });
    });
  });
  cy.visit("/", {
    onBeforeLoad(win) {
      (
        win as Cypress.AUTWindow & { __STRATA_FORCE_PAN_ON_DRAG?: boolean }
      ).__STRATA_FORCE_PAN_ON_DRAG = true;
    },
  });
}

function columnNameSpan(tableId: string, name: string) {
  return cy.get(nodeSel(tableId)).contains(".col-row span", new RegExp(`^${name}$`));
}

function paneMouseDrag(dx: number, dy: number): void {
  cy.get(".react-flow__pane").then(($pane) => {
    const el = $pane[0];
    const r = el.getBoundingClientRect();
    const x = r.left + 24;
    const y = r.top + 24;
    const view = el.ownerDocument.defaultView;
    cy.wrap($pane).trigger("mousedown", {
      eventConstructor: "MouseEvent",
      button: 0,
      which: 1,
      buttons: 1,
      clientX: x,
      clientY: y,
      force: true,
      view,
    });
    cy.window().then((win) => {
      const fire = (type: string, clientX: number, clientY: number, buttons: number) => {
        win.dispatchEvent(
          new win.MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: win,
            button: 0,
            buttons,
            clientX,
            clientY,
          }),
        );
      };
      fire("mousemove", x + 8, y + 8, 1);
      fire("mousemove", x + dx, y + dy, 1);
      fire("mouseup", x + dx, y + dy, 0);
    });
  });
}

describe("S03 rubber-band, space pan, Escape stack", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  it("G4: left-button rubber band over 3 tables selects them", () => {
    rubberBandCovering(THREE);
    for (const id of THREE) {
      cy.get(nodeSel(id)).should("have.class", "selected");
    }
  });

  it("G5: Space + drag translates the viewport and selects no node", () => {
    cy.get(".react-flow__viewport")
      .invoke("attr", "style")
      .then((before) => {
        fireWindowKey({ key: " ", code: "Space" });
        cy.get(".canvas-wrap").should("have.class", "canvas-wrap--space-pan");
        paneMouseDrag(140, 90);
        cy.get(".react-flow__viewport").should(($vp) => {
          expect($vp.attr("style"), "viewport translated").to.not.eq(before);
        });
        cy.get(".react-flow__node-table.selected").should("have.length", 0);
      });
  });

  it("G6: Esc clears column first, then table", () => {
    columnNameSpan(SMOKE_NODES.pedido, "cliente_id").click({ force: true });
    cy.get(".column-panel").should("be.visible");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("have.class", "selected");

    fireWindowKey({ key: "Escape" });
    cy.get(".column-panel").should("not.exist");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("have.class", "selected");

    fireWindowKey({ key: "Escape" });
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("not.have.class", "selected");
  });
});

describe("S03 G4 guard", () => {
  it("G4 guard: rubber-band helper fails when panOnDrag is forced true", () => {
    visitWithForcedPanOnDrag();
    waitForCanvas();
    rubberBandCovering(THREE);
    cy.get(".react-flow__node-table.selected").should("have.length", 0);
  });
});
