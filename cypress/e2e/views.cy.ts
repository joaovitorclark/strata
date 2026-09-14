import {
  nodeSel,
  saveViaPaletteShortcut,
  SMOKE_NODES,
  translateOf,
  waitForCanvas,
} from "./canvas-support";

const THREE = [SMOKE_NODES.cliente, SMOKE_NODES.pedido, SMOKE_NODES.item] as const;

function treeRow(id: string): string {
  return `[data-testid="schema-tree"] button[aria-label="${id}"]`;
}

function selectThreeTables(): void {
  cy.get(treeRow(THREE[0])).click();
  cy.get(treeRow(THREE[1])).click({ altKey: true });
  cy.get(treeRow(THREE[2])).click({ altKey: true });
}

function openViewMenu(): void {
  cy.get('[data-testid="view-tabs"]').click({ force: true });
  cy.get('[data-testid="view-new-from-selection"]').should("be.visible");
}

function createViewFromSelection(): void {
  selectThreeTables();
  cy.get('[data-testid="inspector"]').should("contain", "3 tabelas selecionadas");
  openViewMenu();
  cy.get('[data-testid="view-new-from-selection"]').should("not.have.attr", "data-disabled");
  cy.get('[data-testid="view-new-from-selection"]').click({ force: true });
  cy.get('[data-testid="view-tabs"]').should("contain", "view_1");
}

function viewsBlock(dbml: string): string {
  const m = /Views\s*\{[\s\S]*\}\s*$/m.exec(dbml);
  return m?.[0] ?? "";
}

function positionOf(dbml: string, tableId: string): { x: number; y: number } | undefined {
  const m = new RegExp(
    `${tableId.replace(".", "\\.")}\\s+(-?\\d+(?:\\.\\d+)?)\\s+(-?\\d+(?:\\.\\d+)?)`,
  ).exec(viewsBlock(dbml));
  if (!m) return undefined;
  return { x: Number(m[1]), y: Number(m[2]) };
}

describe("S11 views", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  it("G5: selecting 3 tables → Nova view a partir da seleção writes Views {} with the 3", () => {
    createViewFromSelection();
    saveViaPaletteShortcut();
    cy.dbmlText().should((dbml) => {
      expect(dbml, "DBML gained a Views block").to.match(/Views\s*\{/);
      const block = viewsBlock(dbml);
      expect(block).to.include(SMOKE_NODES.cliente);
      expect(block).to.include(SMOKE_NODES.pedido);
      expect(block).to.include(SMOKE_NODES.item);
      expect(block).to.not.include(SMOKE_NODES.resumo);
    });
  });

  it("G6: switching to the view shows only 3 nodes on the canvas", () => {
    createViewFromSelection();
    openViewMenu();
    cy.get('[data-testid="view-item-tudo"]').click();
    cy.get(nodeSel(SMOKE_NODES.resumo)).should("exist");
    cy.get('[data-testid^="rf__node-vendas."]').should("have.length", 4);
    openViewMenu();
    cy.get('[data-testid="view-item-view_1"]').click();
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("exist");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("exist");
    cy.get(nodeSel(SMOKE_NODES.item)).should("exist");
    cy.get(nodeSel(SMOKE_NODES.resumo)).should("not.exist");
    cy.get('[data-testid^="rf__node-vendas."]').should("have.length", 3);
  });

  it("G7: moving a node in the view updates Views positions; Tudo position is unchanged", () => {
    const id = SMOKE_NODES.pedido;
    cy.get(nodeSel(id)).then(($n) => {
      const tudoVisual = translateOf($n.attr("style"));
      createViewFromSelection();
      cy.get(nodeSel(id)).click("top", { force: true });
      saveViaPaletteShortcut();
      cy.dbmlText().then((before) => {
        const posBefore = positionOf(before, id);
        cy.dragNode(id, 120, 80);
        saveViaPaletteShortcut();
        cy.dbmlText().should((after) => {
          const posAfter = positionOf(after, id);
          expect(posAfter, "view positions present after drag").to.not.eq(undefined);
          expect(posBefore, "view had positions before drag").to.not.eq(undefined);
          expect(posAfter!.x, "view x changed").to.not.eq(posBefore!.x);
          expect(posAfter!.y, "view y changed").to.not.eq(posBefore!.y);
        });
        openViewMenu();
        cy.get('[data-testid="view-item-tudo"]').click();
        cy.get(nodeSel(id)).should(($after) => {
          const again = translateOf($after.attr("style"));
          expect(again.x, "Tudo visual x").to.be.closeTo(tudoVisual.x, 4);
          expect(again.y, "Tudo visual y").to.be.closeTo(tudoVisual.y, 4);
        });
      });
    });
  });

  it("G8: renaming a table updates the name inside Views {}", () => {
    createViewFromSelection();
    cy.get(nodeSel(SMOKE_NODES.pedido)).click("top", { force: true });
    cy.get("#inspector-table-name").click().type("{selectall}pedido_s11{enter}");
    saveViaPaletteShortcut();
    cy.dbmlText().should((dbml) => {
      const block = viewsBlock(dbml);
      expect(block).to.include("vendas.pedido_s11");
      expect(block).to.not.include(`${SMOKE_NODES.pedido},`);
      expect(block).to.not.match(/tables:[^\n]*vendas\.pedido[^\w.]/);
    });
  });

  it("G9: ?view=<id> opens on that view", () => {
    createViewFromSelection();
    saveViaPaletteShortcut();
    cy.visit("/?view=view_1", {
      onBeforeLoad(win) {
        win.localStorage.removeItem("strata.detailLevel");
      },
    });
    waitForCanvas();
    cy.get('[data-testid="view-tabs"]').should("contain", "view_1");
    cy.get(nodeSel(SMOKE_NODES.resumo)).should("not.exist");
    cy.get('[data-testid^="rf__node-vendas."]').should("have.length", 3);
    cy.location("search").should("include", "view=view_1");
  });

  it("G10: Nova view por camada with 3 layers creates 3 views", () => {
    openViewMenu();
    cy.get('[data-testid="view-new-by-layer"]').click({ force: true });
    saveViaPaletteShortcut();
    cy.dbmlText().should((dbml) => {
      expect(dbml).to.match(/Views\s*\{/);
      const block = viewsBlock(dbml);
      expect(block).to.match(/bronze\s*(?:\[detail:[^\]]+\])?\s*\{/);
      expect(block).to.match(/prata\s*(?:\[detail:[^\]]+\])?\s*\{/);
      expect(block).to.match(/ouro\s*(?:\[detail:[^\]]+\])?\s*\{/);
      expect(block).to.include(SMOKE_NODES.cliente);
      expect(block).to.include(SMOKE_NODES.pedido);
      expect(block).to.include(SMOKE_NODES.resumo);
    });
  });
});
