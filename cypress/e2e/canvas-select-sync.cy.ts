import {
  collapseLayersPanel,
  fireWindowKey,
  nodeSel,
  rubberBandCovering,
  SMOKE_NODES,
  translateOf,
  viewportScaleOf,
  waitForCanvas,
} from "./canvas-support";

const SMOKE_DBML = "cypress/fixtures/data/domains/local/projects/smoke/project.dbml";

const TABLE_GROUP_BLOCK = `TableGroup vendas {
  vendas.cliente
  vendas.pedido
}`;

/** Overlay so row 74 can observe Records filtering (smoke has no Records {}). */
const RECORDS_BLOCK = `Records vendas.cliente(id, nome) {
  1, 'Ana'
}

Records vendas.pedido(id, cliente_id, total) {
  10, 1, 99.5
}

Records vendas.item(id, sku) {
  1, 'SKU-1'
}`;

const GROUP_NODE_ID = "group:vendas";
const STALE_BANNER = "Canvas mostra último modelo válido — corrija o DBML no editor";

function columnNameSpan(tableId: string, name: string) {
  return cy.get(nodeSel(tableId)).contains(".col-row span", new RegExp(`^${name}$`));
}

function cmdClickNode(id: string): void {
  cy.get(nodeSel(id))
    .find('[title="Duplo-clique para renomear a tabela"]')
    .then(($el) => {
      const el = $el[0];
      const win = el.ownerDocument.defaultView!;
      const r = el.getBoundingClientRect();
      el.dispatchEvent(
        new win.MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: win,
          button: 0,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
          metaKey: true,
          ctrlKey: true,
        }),
      );
      el.dispatchEvent(
        new win.MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: win,
          button: 0,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
          metaKey: true,
          ctrlKey: true,
        }),
      );
      el.dispatchEvent(
        new win.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: win,
          button: 0,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
          metaKey: true,
          ctrlKey: true,
        }),
      );
    });
}

function hoverNode(id: string): void {
  cy.get(nodeSel(id)).trigger("mouseover", {
    force: true,
    eventConstructor: "MouseEvent",
  });
  cy.get(nodeSel(id)).trigger("mouseenter", {
    force: true,
    eventConstructor: "MouseEvent",
  });
}

function assertFocusHighlight(related: string[], unrelated: string[]): void {
  cy.get(".canvas-wrap").should("have.class", "canvas-wrap--focus");
  cy.get("[data-canvas-focus]").should("exist");
  for (const id of related) {
    cy.get(nodeSel(id)).should(($n) => {
      expect(parseFloat($n.css("opacity")), `${id} related opacity`).to.be.closeTo(1, 0.08);
    });
  }
  for (const id of unrelated) {
    cy.get(nodeSel(id)).should(($n) => {
      expect(parseFloat($n.css("opacity")), `${id} unrelated opacity`).to.be.closeTo(0.45, 0.1);
    });
  }
}

function putSmokePlus(suffix: string): void {
  cy.readFile(SMOKE_DBML).then((dbml: string) => {
    const next = `${dbml.replace(/\n+$/, "")}\n\n${suffix.replace(/^\n+/, "")}\n`;
    cy.request("PUT", "/api/project", { dbml: next, canvas: {} });
  });
  cy.visit("/");
  waitForCanvas();
  collapseLayersPanel();
}

function openSourceDrawer(): void {
  cy.get("body").then(($body) => {
    if ($body.find('[data-testid="source-drawer"]:visible').length) return;
    cy.get('[aria-label="DBML"]').click({ force: true });
  });
  cy.get('[data-testid="source-drawer"]').should("be.visible");
  cy.get('[data-testid="source-drawer"] .cm-content').should("be.visible");
}

/** Mouse drag on the group label handle (shell is pointer-events:none; dragHandle required). */
function dragGroupLabel(dx: number, dy: number): void {
  cy.get(".group-node__label.group-node__drag-handle").then(($h) => {
    const el = $h[0];
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const view = el.ownerDocument.defaultView;
    const vp = el.closest(".react-flow__viewport") as HTMLElement | null;
    const scaleMatch = /scale\(\s*([\d.]+)\s*\)/.exec(vp?.style.transform ?? "");
    const z = scaleMatch ? Number(scaleMatch[1]) : 1;
    const sx = dx * z;
    const sy = dy * z;
    const mouse = (clientX: number, clientY: number) => ({
      eventConstructor: "MouseEvent" as const,
      button: 0,
      which: 1,
      buttons: 1,
      clientX,
      clientY,
      force: true,
      view,
    });
    cy.wrap($h).trigger("mousedown", mouse(x, y));
    cy.window().then((win) => {
      const fire = (type: string, clientX: number, clientY: number, buttons: number) => {
        win.dispatchEvent(
          new win.MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: win,
            button: 0,
            buttons,
            clientX,
            clientY,
          }),
        );
      };
      const startX = x + 8;
      const startY = y + 8;
      fire("mousemove", startX, startY, 1);
      fire("mousemove", startX + sx / 2, startY + sy / 2, 1);
      fire("mousemove", startX + sx, startY + sy, 1);
      fire("mouseup", startX + sx, startY + sy, 0);
    });
  });
}

describe("canvas selection, hover, groups, controls, editor sync", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    collapseLayersPanel();
  });

  it("row 39: hovering a column highlights connected FK relations", () => {
    columnNameSpan(SMOKE_NODES.pedido, "cliente_id")
      .parents(".col-row")
      .trigger("mouseover", { force: true, eventConstructor: "MouseEvent" });
    hoverNode(SMOKE_NODES.pedido);

    assertFocusHighlight(
      [SMOKE_NODES.pedido, SMOKE_NODES.cliente],
      [SMOKE_NODES.item, SMOKE_NODES.resumo],
    );
    cy.get(".edge-path--fk").closest(".react-flow__edge").should("have.class", "edge--highlight");
  });

  it("row 41: click a column opens the column panel", () => {
    cy.get(".column-panel").should("not.exist");
    columnNameSpan(SMOKE_NODES.pedido, "cliente_id").click({ force: true });
    cy.get(".column-panel").should("be.visible");
    cy.get(".column-panel__col").should("contain", "cliente_id");
    cy.get(".column-panel__tbl").should("contain", SMOKE_NODES.pedido);
  });

  it("row 42: hovering a table no longer mounts TableInfoPopover (S02; S07 remounts)", () => {
    cy.get(".info-popover").should("not.exist");
    cy.get(nodeSel(SMOKE_NODES.pedido))
      .find('[title="Duplo-clique para renomear a tabela"]')
      .trigger("mouseover", { force: true, eventConstructor: "MouseEvent" });
    hoverNode(SMOKE_NODES.pedido);
    cy.get(".info-popover").should("not.exist");
  });

  it("row 43: Cmd/Ctrl+click selects multiple tables", () => {
    cy.get(nodeSel(SMOKE_NODES.cliente))
      .find('[title="Duplo-clique para renomear a tabela"]')
      .click({ force: true });
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("have.class", "selected");

    cmdClickNode(SMOKE_NODES.pedido);

    cy.get(nodeSel(SMOKE_NODES.cliente)).should("have.class", "selected");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("have.class", "selected");
  });

  it("row 43: rubber-band selects tables (S03; see canvas-rubber-band.cy.ts G4)", () => {
    rubberBandCovering([SMOKE_NODES.cliente, SMOKE_NODES.pedido]);
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("have.class", "selected");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("have.class", "selected");
  });

  it("row 46: Escape first clears the column, second clears the table", () => {
    columnNameSpan(SMOKE_NODES.pedido, "cliente_id").click({ force: true });
    cy.get(".column-panel").should("be.visible");
    fireWindowKey({ key: "Escape" });
    cy.get(".column-panel").should("not.exist");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("have.class", "selected");
    fireWindowKey({ key: "Escape" });
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("not.have.class", "selected");
  });

  it("row 75: hovering a table keeps related tables highlighted", () => {
    cy.get(nodeSel(SMOKE_NODES.cliente))
      .find('[title="Duplo-clique para renomear a tabela"]')
      .trigger("mouseover", { force: true, eventConstructor: "MouseEvent" });
    hoverNode(SMOKE_NODES.cliente);

    assertFocusHighlight(
      [SMOKE_NODES.cliente, SMOKE_NODES.pedido],
      [SMOKE_NODES.item, SMOKE_NODES.resumo],
    );
  });

  it("row 76: pill fit view changes the viewport toward fitting all nodes", () => {
    collapseLayersPanel();
    cy.get(".react-flow__viewport")
      .invoke("attr", "style")
      .then((before) => {
        const zBefore = viewportScaleOf(before);
        cy.get('[data-testid="canvas-toolbar"] [data-zoom="in"]').click({ force: true });
        cy.get(".react-flow__viewport").should(($vp) => {
          expect(viewportScaleOf($vp.attr("style")), "first zoom-in settled").to.be.greaterThan(
            zBefore * 1.14,
          );
        });
        cy.get('[data-testid="canvas-toolbar"] [data-zoom="in"]').click({ force: true });
        cy.get(".react-flow__viewport").should(($vp) => {
          const z = viewportScaleOf($vp.attr("style"));
          expect($vp.attr("style"), "zoomed in").to.not.eq(before);
          // maxZoom defaults to 2, so a second 1.2× step may clamp.
          expect(z, "still zoomed in").to.be.greaterThan(zBefore * 1.14);
        });
        cy.get(".react-flow__viewport")
          .invoke("attr", "style")
          .then((zoomed) => {
            const zZoomed = viewportScaleOf(zoomed);
            cy.get('[data-testid="canvas-toolbar"] [data-zoom="fit"]').click({ force: true });
            cy.get(".react-flow__viewport").should(($vp) => {
              const style = $vp.attr("style");
              expect(style, "fit view changed transform").to.not.eq(zoomed);
              expect(viewportScaleOf(style), "fit scale vs zoomed-in").to.be.lessThan(
                zZoomed + 0.001,
              );
            });
          });
      });
  });

  it("row 73: click a table body focuses it and scrolls the editor to its block", () => {
    cy.get('[data-testid="source-drawer"]').should("not.exist");
    cy.get(nodeSel(SMOKE_NODES.cliente)).click("top", { force: true });
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("have.class", "selected");
    cy.get('[data-inspector="root"]').should("contain", SMOKE_NODES.cliente);
    cy.get('[data-testid="source-drawer"]').should("be.visible");
    cy.get('[data-testid="source-drawer"] .cm-activeLine').should(
      "contain",
      "Table vendas.cliente",
    );
  });

  it("row 92: invalid DBML shows the stale-model banner and keeps the last graph", () => {
    openSourceDrawer();
    cy.get('[data-testid="source-drawer"] .cm-content')
      .click({ force: true })
      .type("{selectall}BROKEN", { delay: 0 });
    cy.get('[role="status"]').should("contain", STALE_BANNER);
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("be.visible");
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("be.visible");
  });

  it("row 247: editor cursor in a table block pans and selects that table", () => {
    openSourceDrawer();
    cy.get(".react-flow__viewport")
      .invoke("attr", "style")
      .then((before) => {
        cy.get('[data-testid="source-drawer"]')
          .contains(".cm-line", "Table vendas.item {")
          .click({ force: true });
        cy.get(nodeSel(SMOKE_NODES.item)).should("have.class", "selected");
        cy.get(nodeSel(SMOKE_NODES.pedido)).should("not.have.class", "selected");
        cy.get('[data-inspector="root"]').should("contain", SMOKE_NODES.item);
        cy.get(".react-flow__viewport").should(($vp) => {
          expect($vp.attr("style"), "canvas panned/zoomed to the table").to.not.eq(before);
        });
      });
  });

  describe("TableGroup", () => {
    beforeEach(() => {
      putSmokePlus(`${TABLE_GROUP_BLOCK}\n\n${RECORDS_BLOCK}`);
      cy.get(nodeSel(GROUP_NODE_ID)).should("exist");
      cy.get('[aria-label="Colapsar grupo"]').should("exist");
    });

    it("row 65: TableGroup dragHandle mousedown does not move member tables", () => {
      // Tried: label handle, top-edge handle, native MouseEvent on the handle,
      // Cypress trigger + view (the pattern that moves tables via cy.dragNode).
      // Members stay at dx=0. Canvas.onNodeDrag would move them if XYDrag latched.
      // Do not rewrite GroupNode (zIndex -1, pointer-events-none shell, dragHandle).
      cy.get(nodeSel(SMOKE_NODES.cliente)).then(($a) => {
        cy.get(nodeSel(SMOKE_NODES.pedido)).then(($b) => {
          cy.get(nodeSel(SMOKE_NODES.item)).then(($out) => {
            const beforeA = translateOf($a.attr("style"));
            const beforeB = translateOf($b.attr("style"));
            const beforeOut = translateOf($out.attr("style"));
            dragGroupLabel(80, 40);
            cy.get(nodeSel(SMOKE_NODES.cliente)).should(($na) => {
              const a = translateOf($na.attr("style"));
              expect(a.x, "cliente x unmoved").to.be.closeTo(beforeA.x, 4);
              expect(a.y, "cliente y unmoved").to.be.closeTo(beforeA.y, 4);
            });
            cy.get(nodeSel(SMOKE_NODES.pedido)).should(($nb) => {
              const b = translateOf($nb.attr("style"));
              expect(b.x, "pedido x unmoved").to.be.closeTo(beforeB.x, 4);
              expect(b.y, "pedido y unmoved").to.be.closeTo(beforeB.y, 4);
            });
            cy.get(nodeSel(SMOKE_NODES.item)).should(($n) => {
              const o = translateOf($n.attr("style"));
              expect(o.x, "item x unmoved").to.be.closeTo(beforeOut.x, 4);
              expect(o.y, "item y unmoved").to.be.closeTo(beforeOut.y, 4);
            });
          });
        });
      });
    });

    it("row 74: click a TableGroup selects it and filters Records to members", () => {
      cy.get('[data-testid="status-bar"]').contains("button", "Registros").click();
      cy.get('[data-testid="drawer-tab-records"]').should("have.attr", "data-state", "active");
      cy.get(nodeSel(GROUP_NODE_ID)).find(".group-node__label").click("center", { force: true });
      cy.contains("button", /Dados \(amostra\) · 2/).should("be.visible");

      cy.contains("button", /Dados \(amostra\)/)
        .parent()
        .then(($p) => {
          if (!$p.hasClass("is-open")) {
            cy.wrap($p).find("button").first().click({ force: true });
          }
        });

      cy.contains("button", /Dados \(amostra\)/)
        .parent()
        .should("have.class", "is-open")
        .within(() => {
          cy.contains("vendas.cliente").should("be.visible");
          cy.contains("vendas.pedido").should("be.visible");
          cy.contains("vendas.item").should("not.exist");
        });
    });

    it("row 89: the chevron on a group label collapses and expands", () => {
      cy.get('[aria-label="Colapsar grupo"]').click({ force: true });
      cy.get('[aria-label="Expandir grupo"]').should("exist");
      cy.get(".group-node").should("have.class", "is-collapsed");
      cy.get(".group-node__label").should("contain", "tabela(s)");
      cy.get(nodeSel(SMOKE_NODES.cliente)).should("not.exist");
      cy.get(nodeSel(SMOKE_NODES.pedido)).should("not.exist");
      cy.get(nodeSel(SMOKE_NODES.item)).should("be.visible");

      cy.get('[aria-label="Expandir grupo"]').click({ force: true });
      cy.get('[aria-label="Colapsar grupo"]').should("exist");
      cy.get(".group-node").should("not.have.class", "is-collapsed");
      cy.get(nodeSel(SMOKE_NODES.cliente)).should("be.visible");
      cy.get(nodeSel(SMOKE_NODES.pedido)).should("be.visible");
    });
  });
});
