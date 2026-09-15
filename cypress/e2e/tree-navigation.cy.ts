import { nodeSel, SMOKE_NODES, waitForCanvas } from "./canvas-support";

const PEDIDO = SMOKE_NODES.pedido;

function treeRow(id: string): string {
  return `[data-testid="schema-tree"] button[aria-label="${id}"]`;
}

function nodeInCanvasViewport($node: JQuery<HTMLElement>): boolean {
  const canvas = Cypress.$('[data-slot="canvas"]')[0];
  if (!canvas) return false;
  const cr = canvas.getBoundingClientRect();
  const r = $node[0].getBoundingClientRect();
  return r.right > cr.left && r.left < cr.right && r.bottom > cr.top && r.top < cr.bottom;
}

function pedidoOutsideViewport(): boolean {
  const el = Cypress.$(nodeSel(PEDIDO))[0];
  if (!el) return true;
  return !nodeInCanvasViewport(Cypress.$(el));
}

describe("S04 tree navigation", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  it("G1: click table in tree pans node into viewport and selects it", () => {
    cy.get('[data-testid="canvas-toolbar"] [data-zoom="in"]').click({ force: true });
    cy.get('[data-testid="canvas-toolbar"] [data-zoom="in"]').click({ force: true });
    cy.get('[data-testid="canvas-toolbar"] [data-zoom="in"]').click({ force: true });
    cy.dragNode(PEDIDO, 1400, 900);
    cy.get("body").should(() => {
      expect(pedidoOutsideViewport(), "pedido starts outside the canvas viewport").to.eq(true);
    });
    cy.get(treeRow(PEDIDO)).click();
    cy.get(nodeSel(PEDIDO)).should("have.class", "selected");
    cy.get(nodeSel(PEDIDO)).should(($n) => {
      expect(nodeInCanvasViewport($n), "pedido node inside canvas viewport").to.eq(true);
    });
  });

  it('G2: filter "ped" shows only rows containing "ped"', () => {
    cy.get('[data-testid="schema-tree-filter"]').clear().type("ped");
    cy.get('[data-testid="schema-tree"] [data-tree-table]').should("have.length", 1);
    cy.get(treeRow(PEDIDO)).should("exist");
    cy.get(treeRow(SMOKE_NODES.cliente)).should("not.exist");
    cy.get(treeRow(SMOKE_NODES.item)).should("not.exist");
    cy.get(treeRow(SMOKE_NODES.resumo)).should("not.exist");
  });

  it("G3: eye hides the node on the canvas and leaves DBML unchanged", () => {
    cy.dbmlText().then((before) => {
      cy.get(nodeSel(PEDIDO)).should("be.visible");
      cy.get(`[data-testid="schema-tree-visibility-${PEDIDO}"]`).click({ force: true });
      cy.get(nodeSel(PEDIDO)).should("not.exist");
      cy.dbmlText().should((after) => {
        expect(after).to.eq(before);
      });
    });
  });

  it('G4: "Mostrar todas" restores every table node', () => {
    cy.get(`[data-testid="schema-tree-visibility-${PEDIDO}"]`).click({ force: true });
    cy.get(nodeSel(PEDIDO)).should("not.exist");
    cy.get('[data-testid="schema-tree-menu"]').click();
    cy.contains('[role="menuitem"]', "Mostrar todas").click();
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("exist");
    cy.get(nodeSel(PEDIDO)).should("exist");
    cy.get(nodeSel(SMOKE_NODES.item)).should("exist");
    cy.get(nodeSel(SMOKE_NODES.resumo)).should("exist");
  });

  it("G5: clicking a hidden table un-hides it and focuses it", () => {
    cy.get(`[data-testid="schema-tree-visibility-${PEDIDO}"]`).click({ force: true });
    cy.get(nodeSel(PEDIDO)).should("not.exist");
    cy.get(treeRow(PEDIDO)).click();
    cy.get(nodeSel(PEDIDO)).should("exist").and("have.class", "selected");
    cy.get(nodeSel(PEDIDO)).should(($n) => {
      expect(nodeInCanvasViewport($n), "un-hidden pedido is focused in viewport").to.eq(true);
    });
  });
});
