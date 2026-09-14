import {
  collapseLayersPanel,
  nodeSel,
  PEDIDO_COLUMNS,
  selectCanvasDetailLevel,
  SMOKE_NODES,
  waitForCanvas,
} from "./canvas-support";

describe("canvas LOD", () => {
  beforeEach(() => {
    cy.seedProject("smoke");
    waitForCanvas();
    collapseLayersPanel();
    cy.get(".react-flow__pane").click(20, 20, { force: true });
  });

  it("Nome hides columns; Colunas with selection shows every field", () => {
    const id = SMOKE_NODES.pedido;

    selectCanvasDetailLevel("Nome");
    cy.get(nodeSel(id)).find(".col-row").should("have.length", 0);

    cy.get(nodeSel(id)).click("top", { force: true });
    cy.get(nodeSel(id)).should("have.class", "selected");

    selectCanvasDetailLevel("Colunas");
    cy.get(nodeSel(id)).find(".col-row").should("have.length", PEDIDO_COLUMNS.length);
  });
});
