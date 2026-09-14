import { waitForCanvas } from "./canvas-support";

const NEW_TABLE = "qa.probe";

function addTableViaNavbar(name: string): void {
  cy.window().then((win) => {
    cy.stub(win, "prompt").returns(name);
  });
  cy.get('[data-testid="navbar"]').contains("button", "+ Tabela").click();
}

function saveViaNavbar(): void {
  cy.intercept("PUT", "**/api/projects/*").as("saveProject");
  cy.get('[data-testid="navbar-save"]').should("not.be.disabled").click();
  cy.wait("@saveProject");
}

describe("S02 shell chrome", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  it("G3: Desfazer na navbar após adicionar tabela restaura o DBML", () => {
    cy.dbmlText().then((before) => {
      addTableViaNavbar(NEW_TABLE);
      cy.wait(500);
      saveViaNavbar();
      cy.dbmlText().should((mid) => {
        expect(mid).to.match(/Table\s+qa\.probe/);
      });
      cy.get('[data-testid="navbar"]').contains("button", "Desfazer").click();
      cy.wait(200);
      saveViaNavbar();
      cy.dbmlText().should((after) => {
        expect(after).to.eq(before);
      });
    });
  });

  it("G4: + Tabela na navbar adiciona um bloco Table no DBML", () => {
    cy.dbmlText().then((before) => {
      expect(before).to.not.match(/Table\s+qa\.probe/);
      addTableViaNavbar(NEW_TABLE);
      cy.wait(200);
      saveViaNavbar();
      cy.dbmlText().should((after) => {
        expect(after).to.match(/Table\s+qa\.probe/);
      });
    });
  });

  it("G5: Salvar na navbar muda o rótulo para Salvo", () => {
    addTableViaNavbar(NEW_TABLE);
    cy.get('[data-testid="navbar-save"]').should("contain", "Salvar").and("not.be.disabled");
    saveViaNavbar();
    cy.get('[data-testid="navbar-save"]').should("contain", "Salvo");
  });

  it("G6: Problemas na status bar abre o popover com a lista", () => {
    cy.get('[data-testid="status-bar"]').contains("button", "Problemas").click();
    cy.get('[data-testid="problems-popover"]').should("be.visible");
    cy.get('[data-testid="problems-popover"]').find("ul, [data-problems-empty]").should("exist");
  });

  it("G7: Registros na status bar abre o drawer na aba Registros", () => {
    cy.get('[data-testid="status-bar"]').contains("button", "Registros").click();
    cy.get('[data-testid="drawer-tab-records"]').should("have.attr", "data-state", "active");
    cy.get('[data-testid="workspace-drawer"]').should("be.visible");
  });

  it("G8: aba Camadas no painel esquerdo mostra o LayersPanel", () => {
    cy.get('[data-testid="left-panel-layers"]').click();
    cy.get(".layers-panel").should("be.visible");
  });

  it("G9: pill visível e centrada; fit deixa o nó mais baixo acima da pill", () => {
    cy.get('[data-testid="canvas-toolbar"]').should("be.visible");
    cy.get('[data-testid="canvas-toolbar"]').then(($pill) => {
      cy.get('[data-slot="canvas"]').then(($canvas) => {
        const pill = $pill[0].getBoundingClientRect();
        const canvas = $canvas[0].getBoundingClientRect();
        const pillCx = pill.left + pill.width / 2;
        const canvasCx = canvas.left + canvas.width / 2;
        expect(Math.abs(pillCx - canvasCx), "pill centered on canvas").to.be.lessThan(4);
      });
    });

    cy.get('[data-testid="canvas-toolbar"] [data-zoom="fit"]').click();
    cy.wait(400);

    cy.get('[data-testid="canvas-toolbar"]').then(($pill) => {
      const pillTop = $pill[0].getBoundingClientRect().top;
      cy.get(".react-flow__node-table:visible").then(($nodes) => {
        let lowest = 0;
        $nodes.each((_, el) => {
          lowest = Math.max(lowest, el.getBoundingClientRect().bottom);
        });
        expect(lowest, "lowest node above pill").to.be.lessThan(pillTop);
      });
    });
  });

  it("G10: navbar em 1280×720 fica em uma linha (altura ≤ 48px)", () => {
    cy.viewport(1280, 720);
    cy.get('[data-testid="navbar"]').should(($nav) => {
      expect($nav[0].getBoundingClientRect().height).to.be.at.most(48);
    });
  });
});
