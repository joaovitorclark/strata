import { fireWindowKey, nodeSel, SMOKE_NODES, waitForCanvas } from "./canvas-support";

describe("canvas selection", () => {
  beforeEach(() => {
    cy.seedProject("smoke");
    waitForCanvas();
  });

  it("click a node selects it; pane click and Escape clear it", () => {
    const id = SMOKE_NODES.cliente;
    const sel = nodeSel(id);

    cy.get(sel).click("top", { force: true });
    cy.get(sel).should("have.class", "selected");
    cy.get('[data-inspector="root"]').should("contain", id);
    cy.get('[data-testid="schema-tree"]')
      .find(`button[aria-label="${id}"]`)
      .should("have.attr", "aria-current", "true");

    cy.get(".react-flow__pane").click(80, 40, { force: true });
    cy.get(sel).should("not.have.class", "selected");
    cy.get('[data-inspector="root"]').should("contain", "Selecione uma tabela");
    cy.get('[data-testid="schema-tree"]')
      .find(`button[aria-label="${id}"]`)
      .should("not.have.attr", "aria-current");

    cy.get(sel).click("top", { force: true });
    cy.get(sel).should("have.class", "selected");
    fireWindowKey({ key: "Escape" });
    cy.get(sel).should("not.have.class", "selected");
    cy.get('[data-inspector="root"]').should("contain", "Selecione uma tabela");
  });
});
