import {
  animationNameOf,
  fireWindowKey,
  nodeSel,
  selectCanvasDetailLevel,
  setEdgeVisibility,
  SMOKE_NODES,
  waitForCanvas,
} from "./canvas-support";

function opacityOf($el: JQuery<HTMLElement>): number {
  return parseFloat($el.css("opacity"));
}

function columnNameSpan(tableId: string, name: string) {
  return cy.get(nodeSel(tableId)).contains(".col-row span", new RegExp(`^${name}$`));
}

describe("S08 focus mode", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  it("G6: selecionar tabela, F → vizinhas com opacity 1, outras 0.15", () => {
    cy.get(nodeSel(SMOKE_NODES.pedido)).click("top", { force: true });
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("have.class", "selected");
    fireWindowKey({ key: "f" });

    cy.get(nodeSel(SMOKE_NODES.pedido)).should(($n) => {
      expect(opacityOf($n), "seed").to.be.closeTo(1, 0.05);
    });
    cy.get(nodeSel(SMOKE_NODES.cliente)).should(($n) => {
      expect(opacityOf($n), "neighbor").to.be.closeTo(1, 0.05);
    });
    cy.get(nodeSel(SMOKE_NODES.item)).should(($n) => {
      expect(opacityOf($n), "rest item").to.be.closeTo(0.15, 0.05);
    });
    cy.get(nodeSel(SMOKE_NODES.resumo)).should(($n) => {
      expect(opacityOf($n), "rest resumo").to.be.closeTo(0.15, 0.05);
    });
  });

  it("G7: ] → 2 saltos, mais tabelas em opacity 1", () => {
    setEdgeVisibility("Linhagem", true);
    cy.get(nodeSel(SMOKE_NODES.cliente)).click("top", { force: true });
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("have.class", "selected");
    fireWindowKey({ key: "f" });

    cy.get(nodeSel(SMOKE_NODES.resumo)).should(($n) => {
      expect(opacityOf($n), "resumo at 1 hop").to.be.closeTo(0.15, 0.05);
    });
    cy.get(nodeSel(SMOKE_NODES.pedido)).should(($n) => {
      expect(opacityOf($n), "pedido at 1 hop").to.be.closeTo(1, 0.05);
    });

    fireWindowKey({ key: "]" });

    cy.get(nodeSel(SMOKE_NODES.resumo)).should(($n) => {
      expect(opacityOf($n), "resumo at 2 hops").to.be.closeTo(1, 0.05);
    });
    cy.get(nodeSel(SMOKE_NODES.item)).should(($n) => {
      expect(opacityOf($n), "item still rest").to.be.closeTo(0.15, 0.05);
    });
  });

  it("G8: Esc sai; todas opacity 1", () => {
    cy.get(nodeSel(SMOKE_NODES.pedido)).click("top", { force: true });
    fireWindowKey({ key: "f" });
    cy.get(nodeSel(SMOKE_NODES.item)).should(($n) => {
      expect(opacityOf($n)).to.be.closeTo(0.15, 0.05);
    });

    fireWindowKey({ key: "Escape" });

    for (const id of Object.values(SMOKE_NODES)) {
      cy.get(nodeSel(id)).should(($n) => {
        expect(opacityOf($n), id).to.be.closeTo(1, 0.08);
      });
    }
  });

  it("G9: rastrear campo → arestas do caminho têm classe ativa e só elas animam", () => {
    selectCanvasDetailLevel("Colunas");
    setEdgeVisibility("Linhagem", true);
    columnNameSpan(SMOKE_NODES.resumo, "id").click({ force: true });
    fireWindowKey({ key: "t" });

    cy.get("[data-testid='focus-trace']").should("be.visible");
    cy.get(".react-flow__edge.edge--rel-active").should("have.length.at.least", 1);
    cy.get(".react-flow__edge").then(($edges) => {
      const active: Element[] = [];
      const rest: Element[] = [];
      for (const el of [...$edges]) {
        if (el.classList.contains("edge--rel-active")) active.push(el);
        else rest.push(el);
      }
      expect(active, "path edges").to.have.length.at.least(1);
      for (const el of active) {
        const path = el.querySelector(".react-flow__edge-path");
        expect(path, "path on active edge").to.not.equal(null);
        expect(animationNameOf(path as Element)).to.match(/lineage-flow/);
      }
      for (const el of rest) {
        const path = el.querySelector(".react-flow__edge-path");
        if (!path) continue;
        const style = el.ownerDocument.defaultView?.getComputedStyle(el);
        if (style?.display === "none" || style?.visibility === "hidden") continue;
        expect(animationNameOf(path), "non-path must not run lineage-flow").to.not.match(
          /lineage-flow/,
        );
      }
    });
  });

  it("G10: rastreio não altera DBML nem nodeLod persistido", () => {
    selectCanvasDetailLevel("Colunas");
    cy.window().then((win) => {
      const detailBefore = win.localStorage.getItem("strata.detailLevel");
      cy.dbmlText().then((before) => {
        columnNameSpan(SMOKE_NODES.resumo, "id").click({ force: true });
        fireWindowKey({ key: "t" });
        cy.get("[data-testid='focus-trace']").should("be.visible");

        cy.dbmlText().should((during) => {
          expect(during, "trace must not mutate DBML").to.equal(before);
        });

        cy.get("[data-testid='focus-exit']").click({ force: true });
        cy.get("[data-testid='focus-trace']").should("not.exist");

        cy.dbmlText().should((after) => {
          expect(after, "exit must not mutate DBML").to.equal(before);
        });
        cy.window().should((w) => {
          expect(w.localStorage.getItem("strata.detailLevel"), "detailLevel").to.equal(
            detailBefore,
          );
        });
      });
    });
  });
});
