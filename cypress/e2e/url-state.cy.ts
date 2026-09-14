import { nodeSel, SMOKE_NODES, waitForCanvas } from "./canvas-support";

const PEDIDO = SMOKE_NODES.pedido;
const CLIENTE = SMOKE_NODES.cliente;

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

function visitWithSearch(search: string): void {
  cy.visit(`/${search.startsWith("?") ? search : `?${search}`}`, {
    onBeforeLoad(win) {
      win.localStorage.removeItem("strata.detailLevel");
    },
  });
}

describe("S06 shareable URL", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
  });

  it("G4: visiting ?focus=<table>&detail=columns selects the table in viewport at Colunas", () => {
    visitWithSearch(`?focus=${PEDIDO}&detail=columns`);
    waitForCanvas();
    cy.get(nodeSel(PEDIDO)).should("have.class", "selected");
    cy.get(nodeSel(PEDIDO)).should(($n) => {
      expect(nodeInCanvasViewport($n), "focused table inside canvas viewport").to.eq(true);
    });
    cy.get('[data-testid="detail-level-select"]').should("contain", "Colunas");
  });

  it("G5: selecting another table updates focus in search within 500ms without growing history", () => {
    waitForCanvas();
    cy.window().then((win) => {
      const lengthBefore = win.history.length;
      cy.get(treeRow(CLIENTE)).click();
      cy.location("search", { timeout: 500 }).should((search) => {
        expect(search, "location.search contains the new focus").to.include(
          `focus=${encodeURIComponent(CLIENTE).replace(/%2E/g, ".")}`,
        );
      });
      cy.window().should((after) => {
        expect(after.history.length, "replaceState must not push history").to.eq(lengthBefore);
      });
    });
  });

  it("G6: ?focus=nao_existe loads without error and without a selection", () => {
    visitWithSearch("?focus=nao_existe");
    waitForCanvas();
    cy.contains("Canvas mostra último modelo válido").should("not.exist");
    cy.get(".react-flow__node.selected").should("not.exist");
  });

  it("G7: Copiar link writes location href with focus to the clipboard", () => {
    visitWithSearch(`?focus=${PEDIDO}&detail=columns`);
    waitForCanvas();
    cy.get(nodeSel(PEDIDO)).should("have.class", "selected");
    cy.window().then((win) => {
      const clipboard = win.navigator.clipboard ?? { writeText: () => Promise.resolve() };
      if (!win.navigator.clipboard) {
        Object.defineProperty(win.navigator, "clipboard", { configurable: true, value: clipboard });
      }
      cy.stub(clipboard, "writeText").as("writeText").resolves();
    });
    cy.contains("button", "Copiar link").click();
    cy.get("@writeText")
      .should("have.been.called")
      .its("firstCall.args.0")
      .should("include", `focus=${PEDIDO}`);
  });

  it("G8: reloading keeps the selection and detail level", () => {
    visitWithSearch(`?focus=${PEDIDO}&detail=columns`);
    waitForCanvas();
    cy.get(nodeSel(PEDIDO)).should("have.class", "selected");
    cy.get('[data-testid="detail-level-select"]').should("contain", "Colunas");
    cy.reload();
    waitForCanvas();
    cy.get(nodeSel(PEDIDO)).should("have.class", "selected");
    cy.get('[data-testid="detail-level-select"]').should("contain", "Colunas");
  });
});
