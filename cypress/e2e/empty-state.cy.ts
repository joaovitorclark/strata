import {
  restoreSmoke,
  saveViaPaletteShortcut,
  snapshotSmoke,
  type SmokeSnapshot,
} from "./canvas-support";

const EMPTY_DBML = "// empty\n";

const TWO_TABLES = `Table foo {
  id int [pk]
}

Table bar {
  id int [pk]
}
`;

const SQL_TABLE = "CREATE TABLE analytics.events (id INT PRIMARY KEY, name VARCHAR(100));";

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

describe("S12 empty state", () => {
  let snap: SmokeSnapshot;

  before(() => {
    snapshotSmoke().then((s) => {
      snap = s;
    });
  });

  beforeEach(() => {
    cy.then(() => visitEmpty(snap));
  });

  after(() => {
    cy.then(() => restoreSmoke(snap));
  });

  it("G4: projeto vazio mostra o estado vazio", () => {
    cy.contains("Comece seu modelo").should("be.visible");
    cy.get('[data-testid="rf__wrapper"]').should("not.exist");
  });

  it("G5: colar DBML com 2 tabelas → DBML do projeto contém as 2 e 2 nós no canvas", () => {
    cy.get('[data-testid="empty-paste"]').click();
    cy.get('[data-testid="empty-paste-input"]').type(TWO_TABLES, {
      delay: 0,
      parseSpecialCharSequences: false,
    });
    cy.get('[data-testid="empty-paste-apply"]').click();
    cy.get('[data-testid^="rf__node-"]').should("have.length", 2);
    saveViaPaletteShortcut();
    cy.dbmlText().should((dbml) => {
      expect(dbml).to.match(/Table\s+foo/);
      expect(dbml).to.match(/Table\s+bar/);
    });
  });

  it("G6: colar SQL CREATE TABLE → tabela criada no DBML", () => {
    cy.get('[data-testid="empty-paste"]').click();
    cy.get('[data-testid="empty-paste-input"]').type(SQL_TABLE, {
      delay: 0,
      parseSpecialCharSequences: false,
    });
    cy.get('[data-testid="empty-paste-apply"]').click();
    cy.get('[data-testid^="rf__node-"]').should("exist");
    saveViaPaletteShortcut();
    cy.dbmlText().should((dbml) => {
      expect(dbml).to.match(/Table[\s\S]*events/i);
    });
  });

  it("G7: colar texto inválido → mensagem de erro visível, DBML inalterado", () => {
    cy.dbmlText().then((before) => {
      cy.get('[data-testid="empty-paste"]').click();
      cy.get('[data-testid="empty-paste-input"]').type("this is not a schema", { delay: 0 });
      cy.get('[data-testid="empty-paste-apply"]').click();
      cy.get('[data-testid="empty-paste-error"]').should("be.visible");
      cy.dbmlText().should((after) => {
        expect(after).to.eq(before);
      });
    });
  });
});
