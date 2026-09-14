import { fireWindowKey, saveViaPaletteShortcut, waitForCanvas } from "./canvas-support";

describe("connectHandles helper", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    cy.get(".react-flow__pane").click(20, 20, { force: true });
    fireWindowKey({ key: "3" });
    cy.get('[data-testid="detail-level-select"]').should("contain", "Colunas");
    cy.get('[data-handleid="s:sku"]').should("exist");
  });

  it("actually creates a Ref in the DBML", () => {
    cy.dbmlText().then((before) => {
      expect((before.match(/^\s*Ref:/gm) ?? []).length, "fixture baseline").to.equal(1);

      cy.connectHandles("vendas.item", "s:sku", "vendas.pedido", "t:id");
      saveViaPaletteShortcut();

      cy.dbmlText().should((after) => {
        const refs = after.match(/^\s*Ref:/gm) ?? [];
        expect(refs.length, "exactly one new Ref").to.equal(2);
        expect(after).to.contain("vendas.item.sku");
      });
    });
  });

  it("resetFixture restores the committed fixture DBML", () => {
    cy.connectHandles("vendas.item", "s:sku", "vendas.pedido", "t:id");
    saveViaPaletteShortcut();
    cy.dbmlText().should((after) => {
      expect((after.match(/^\s*Ref:/gm) ?? []).length, "mutated before reset").to.equal(2);
    });

    cy.resetFixture("smoke");
    waitForCanvas();
    cy.readFile("cypress/fixtures/data/domains/local/projects/smoke/project.dbml").then((file) => {
      cy.dbmlText().should((after) => {
        expect(after, "reset matches committed fixture").to.equal(file);
      });
    });
  });
});
