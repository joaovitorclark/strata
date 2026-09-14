import {
  animationNameOf,
  restoreSmoke,
  selectCanvasDetailLevel,
  setEdgeVisibility,
  snapshotSmoke,
  waitForCanvas,
  type SmokeSnapshot,
} from "./canvas-support";

function strokeWidthOf(el: Element): number {
  const win = el.ownerDocument.defaultView;
  if (!win) throw new Error("no view");
  return parseFloat(win.getComputedStyle(el).strokeWidth);
}

describe("S09 edge style", () => {
  let snap: SmokeSnapshot | undefined;

  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    snapshotSmoke().then((s) => {
      snap = s;
    });
  });

  afterEach(() => {
    if (snap) restoreSmoke(snap);
  });

  it("G2: FK at rest has stroke-width 1", () => {
    cy.get(".react-flow__pane").click(20, 20, { force: true });
    cy.get(".edge-path--fk").should(($path) => {
      expect(strokeWidthOf($path[0])).to.eq(1);
    });
  });

  it("G3: no edge animates without focus", () => {
    setEdgeVisibility("Linhagem", true);
    cy.get(".react-flow__pane").click(20, 20, { force: true });
    cy.get(".react-flow__edge-path").should(($paths) => {
      expect($paths.length, "edge paths").to.be.at.least(1);
      for (const el of [...$paths]) {
        const edge = el.closest(".react-flow__edge");
        const focused =
          edge?.classList.contains("edge--focus") ||
          edge?.classList.contains("lineage-flow") ||
          edge?.classList.contains("edge--highlight");
        if (focused) continue;
        const anim = animationNameOf(el);
        expect(anim === "none" || anim === "", `rest animation-name was ${anim}`).to.eq(true);
      }
    });
  });

  it("G4: hover on an FK → stroke-width 1.5 and label visible", () => {
    cy.get(".edge-path--fk")
      .closest("[data-testid^='rf__edge-']")
      .trigger("mouseenter", { force: true })
      .trigger("mouseover", { force: true });
    cy.get(".edge-path--fk").should(($path) => {
      expect(strokeWidthOf($path[0])).to.eq(1.5);
    });
    cy.get('[data-testid="edge-fk-label"]').should("be.visible");
  });

  it("G5: switching notation to Barker changes marker-end id", () => {
    cy.get(".edge-path--fk").should(($path) => {
      const end = $path[0].getAttribute("marker-end") ?? "";
      expect(end, "default IE marker-end").to.match(/ie-|cf-one/);
    });
    cy.get('[data-testid="edge-visibility"]').click();
    cy.get('[data-testid="notation-menu"]').click({ force: true });
    cy.get('[data-testid="notation-barker"]').click({ force: true });
    cy.get(".edge-path--fk").should(($path) => {
      const end = $path[0].getAttribute("marker-end") ?? "";
      expect(end, "Barker marker-end").to.match(/barker/);
    });
  });

  it('G6: aggregated edge shows "3 campos"', () => {
    cy.request("GET", "/api/project").then((res) => {
      const dbml = String(res.body.dbml)
        .replace(
          /Table vendas\.resumo \{[\s\S]*?\n\}/,
          `Table vendas.resumo {
  id bigint [pk]
  total decimal(18,2)
  extra int
}`,
        )
        .replace(
          /LineageFields \{[\s\S]*?\}/,
          `LineageFields {
  vendas.resumo.id < vendas.pedido.id
  vendas.resumo.total < vendas.pedido.total
  vendas.resumo.extra < vendas.pedido.cliente_id
}`,
        );
      cy.request("PUT", "/api/project", { dbml, canvas: res.body.canvas });
    });
    cy.reload();
    waitForCanvas();
    setEdgeVisibility("Linhagem", true);
    cy.get(".react-flow__pane").click(20, 20, { force: true });
    selectCanvasDetailLevel("Nome");
    cy.contains(".lineage-label", "3 campos").should("be.visible");
  });
});
