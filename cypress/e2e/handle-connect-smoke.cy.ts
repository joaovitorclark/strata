import { saveViaPaletteShortcut, waitForCanvas } from "./canvas-support";

describe("connectHandles helper", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  afterEach(() => {
    cy.exec(
      'git checkout -- "cypress/fixtures/data/domains/local/projects/smoke/project.dbml" "cypress/fixtures/data/domains/local/projects/smoke/canvas.json"',
    );
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
