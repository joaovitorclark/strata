import {
  collapseLayersPanel,
  nodeSel,
  saveViaPaletteShortcut,
  selectCanvasDetailLevel,
  SMOKE_NODES,
  waitForCanvas,
} from "./canvas-support";

function columnNameSpan(tableId: string, name: string) {
  return cy.get(nodeSel(tableId)).contains(".col-row span", new RegExp(`^${name}$`));
}

function selectTable(id: string): void {
  cy.get(nodeSel(id)).click("top", { force: true });
  cy.get(nodeSel(id)).should("have.class", "selected");
}

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

function tableBlock(dbml: string, tableId: string): string {
  const start = dbml.indexOf(`Table ${tableId} {`);
  if (start < 0) return "";
  const rest = dbml.slice(start);
  const close = rest.indexOf("\n}");
  return close >= 0 ? rest.slice(0, close + 2) : rest;
}

function layerBody(dbml: string, name: string): string {
  const m = new RegExp(`LayerGroup\\s+${name}\\b[^{]*\\{([^}]*)\\}`, "i").exec(dbml);
  return m?.[1] ?? "";
}

function layerContains(dbml: string, name: string, tableId: string): boolean {
  return layerBody(dbml, name)
    .split("\n")
    .map((l) => l.trim().replace(/["`]/g, ""))
    .includes(tableId);
}

describe("S10 inspector", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    collapseLayersPanel();
    selectCanvasDetailLevel("Colunas");
  });

  it("G1: selecting a table opens Tabela and Colunas", () => {
    selectTable(SMOKE_NODES.pedido);
    cy.get('[data-testid="inspector-section-table"]').should("have.attr", "data-state", "open");
    cy.get('[data-testid="inspector-section-columns"]').should("have.attr", "data-state", "open");
  });

  it("G2: editing a table note and blurring writes Note: into the DBML", () => {
    selectTable(SMOKE_NODES.pedido);
    cy.get('[data-testid="inspector-table-note"]').click().type("{selectall}nota-s10-blur");
    cy.get('[data-testid="inspector-table-note"]').blur();
    saveViaPaletteShortcut();
    cy.dbmlText().should((dbml) => {
      expect(tableBlock(dbml, SMOKE_NODES.pedido)).to.include("Note: 'nota-s10-blur'");
    });
  });

  it("G3: toggling column not null updates the DBML column", () => {
    selectTable(SMOKE_NODES.pedido);
    columnNameSpan(SMOKE_NODES.pedido, "cliente_id").click({ force: true });
    cy.get('[data-testid="inspector-column-not-null"]').scrollIntoView().click();
    saveViaPaletteShortcut();
    cy.dbmlText().should((dbml) => {
      expect(tableBlock(dbml, SMOKE_NODES.pedido)).to.match(
        /cliente_id\s+bigint\s+\[[^\]]*not null/,
      );
    });
    cy.get('[data-testid="inspector-column-not-null"]').scrollIntoView().click();
    saveViaPaletteShortcut();
    cy.dbmlText().should((dbml) => {
      expect(tableBlock(dbml, SMOKE_NODES.pedido)).to.not.match(
        /cliente_id\s+bigint\s+\[[^\]]*not null/,
      );
    });
  });

  it("G4: Escape while editing leaves the DBML unchanged", () => {
    cy.dbmlText().then((before) => {
      selectTable(SMOKE_NODES.pedido);
      cy.get('[data-testid="inspector-table-note"]').click().type("{selectall}nota-s10-esc{esc}");
      saveViaPaletteShortcut();
      cy.dbmlText().should((after) => {
        expect(after, "Escape cancelled the note edit").to.eq(before);
      });
    });
  });

  it("G5: clicking an incoming FK in Relações focuses the other table", () => {
    selectTable(SMOKE_NODES.cliente);
    cy.get('[data-testid="inspector-section-relations"]').find("button").first().click();
    cy.get('[data-testid="inspector-ref-in-vendas.pedido"]').click({ force: true });
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("have.class", "selected");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should(($n) => {
      expect(nodeInCanvasViewport($n), "pedido focused in viewport").to.eq(true);
    });
  });

  it("G6: a column with lineage shows Vem de with the source table.column", () => {
    selectTable(SMOKE_NODES.resumo);
    columnNameSpan(SMOKE_NODES.resumo, "id").click({ force: true });
    cy.get('[data-testid="inspector-comes-from"]').should("contain", "vendas.pedido.id");
  });

  it("G7: 3 selected tables show the batch label and a layer change updates all three in DBML", () => {
    cy.get(treeRow(SMOKE_NODES.cliente)).click();
    cy.get(treeRow(SMOKE_NODES.pedido)).click({ altKey: true });
    cy.get(treeRow(SMOKE_NODES.item)).click({ altKey: true });
    cy.get('[data-testid="inspector"]').should("contain", "3 tabelas selecionadas");
    cy.get('[data-testid="inspector-batch-layer"]').select("bronze");
    saveViaPaletteShortcut();
    cy.dbmlText().should((dbml) => {
      expect(layerContains(dbml, "bronze", SMOKE_NODES.cliente)).to.eq(true);
      expect(layerContains(dbml, "bronze", SMOKE_NODES.pedido)).to.eq(true);
      expect(layerContains(dbml, "bronze", SMOKE_NODES.item)).to.eq(true);
    });
  });
});
