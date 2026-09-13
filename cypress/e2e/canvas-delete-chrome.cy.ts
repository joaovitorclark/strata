import {
  collapseLayersPanel,
  fireWindowKey,
  nodeSel,
  saveViaPaletteShortcut,
  SMOKE_NODES,
  waitForCanvas,
} from "./canvas-support";

/**
 * React Flow `useKeyPress(deleteKeyCode)` listens on `document`.
 * CommandPalette Delete (selected Ref only) listens on `window`.
 * `fireWindowKey` targets window (palette + Cmd+S). A real keydown on a focused
 * node bubbles document → window; dispatching on document does the same.
 */
function fireDeleteKey(key: "Delete" | "Backspace"): void {
  fireWindowKey({ key });
  cy.document().then((doc) => {
    const win = doc.defaultView!;
    doc.dispatchEvent(
      new win.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
      }),
    );
  });
}

function selectTable(id: string): void {
  cy.get(nodeSel(id)).click("top", { force: true });
  cy.get(nodeSel(id)).should("have.class", "selected");
}

function tableTitle(id: string) {
  return cy.get(nodeSel(id)).find('[title="Duplo-clique para renomear a tabela"]');
}

function columnNameSpan(tableId: string, name: string) {
  return cy.get(nodeSel(tableId)).contains(".col-row span", new RegExp(`^${name}$`));
}

function showLineageEdges(): void {
  cy.get(".layers-panel").then(($p) => {
    if ($p.hasClass("is-collapsed")) {
      cy.wrap($p).find(".layers-panel__collapse").click({ force: true });
    }
  });
  cy.get(".layers-panel").should("not.have.class", "is-collapsed");
  cy.contains("label", "Mostrar linhagem").find("input[type=checkbox]").check({ force: true });
  cy.get(".edge-path--lineage").should("have.length.at.least", 1);
}

/** Mouse-only resize (d3-drag on NodeResizeControl). Never pointer*. */
function dragResizeHandle(tableId: string, dx: number, dy: number): void {
  cy.get(nodeSel(tableId))
    .find(".react-flow__resize-control.handle.bottom.right")
    .then(($h) => {
      const el = $h[0];
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const view = el.ownerDocument.defaultView;
      const mouse = (clientX: number, clientY: number) => ({
        eventConstructor: "MouseEvent" as const,
        button: 0,
        which: 1,
        clientX,
        clientY,
        force: true,
        view,
      });
      cy.wrap($h).trigger("mousedown", mouse(x, y));
      cy.window().then((win) => {
        const fire = (type: string, clientX: number, clientY: number) => {
          win.dispatchEvent(
            new win.MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: win,
              button: 0,
              clientX,
              clientY,
            }),
          );
        };
        const startX = x + 8;
        const startY = y + 8;
        fire("mousemove", startX, startY);
        fire("mousemove", startX + dx / 2, startY + dy / 2);
        fire("mousemove", startX + dx, startY + dy);
        fire("mouseup", startX + dx, startY + dy);
      });
    });
}

type ProjectBody = {
  dbml: string;
  canvas?: { sizes?: Record<string, { width?: number; height?: number } | number> };
};

describe("canvas deletion and node chrome", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    collapseLayersPanel();
  });

  it("row 70: Delete on a selected table removes it and its refs from the DBML", () => {
    cy.dbmlText().then((before) => {
      expect(before, "fixture has pedido").to.include("Table vendas.pedido {");
      expect((before.match(/^\s*Ref:/gm) ?? []).length, "fixture Ref count").to.eq(1);
    });

    selectTable(SMOKE_NODES.pedido);
    fireDeleteKey("Delete");
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after, "pedido table gone").to.not.include("Table vendas.pedido {");
      expect(after, "cliente remains").to.include("Table vendas.cliente {");
      expect((after.match(/^\s*Ref:/gm) ?? []).length, "related Ref gone").to.eq(0);
      expect(after).to.not.include("vendas.pedido.cliente_id");
    });
  });

  it("row 70: Backspace on a selected table removes it and its refs from the DBML", () => {
    selectTable(SMOKE_NODES.pedido);
    fireDeleteKey("Backspace");
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after, "pedido table gone").to.not.include("Table vendas.pedido {");
      expect((after.match(/^\s*Ref:/gm) ?? []).length, "related Ref gone").to.eq(0);
    });
  });

  it("row 71: Delete on a selected relation edge removes that Ref from the DBML", () => {
    cy.dbmlText().then((before) => {
      expect((before.match(/^\s*Ref:/gm) ?? []).length, "fixture Ref count").to.eq(1);
      expect(before).to.include("Ref: vendas.pedido.cliente_id > vendas.cliente.id");
    });

    cy.get(".edge-path--fk").click({ force: true });
    cy.get(".edge-path--fk").closest("[data-testid^='rf__edge-']").should("have.class", "selected");

    fireDeleteKey("Delete");
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect((after.match(/^\s*Ref:/gm) ?? []).length, "exactly that Ref gone").to.eq(0);
      expect(after, "tables remain").to.include("Table vendas.pedido {");
      expect(after).to.include("Table vendas.cliente {");
    });
  });

  it("row 71: Delete on a selected lineage edge removes that Lineage entry from the DBML", () => {
    showLineageEdges();

    cy.dbmlText().then((before) => {
      expect(before).to.include("vendas.resumo < vendas.pedido");
    });

    cy.get(".edge-path--lineage").click({ force: true });
    cy.get(".edge-path--lineage")
      .closest("[data-testid^='rf__edge-']")
      .should("have.class", "selected");

    fireDeleteKey("Delete");
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after, "L1 lineage entry gone").to.not.include("vendas.resumo < vendas.pedido");
      expect((after.match(/^\s*Ref:/gm) ?? []).length, "FK Ref untouched").to.eq(1);
      expect(after).to.include("Table vendas.resumo {");
      expect(after).to.include("Table vendas.pedido {");
    });
  });

  it("row 78: double-click table title prompts and renames in the DBML", () => {
    cy.window().then((w) => {
      cy.stub(w, "prompt").as("promptDlg").returns("vendas.pedido_novo");
    });

    tableTitle(SMOKE_NODES.pedido).dblclick({ force: true });
    cy.get("@promptDlg").should("have.been.called");

    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after, "renamed table").to.include("Table vendas.pedido_novo {");
      expect(after, "old table id gone").to.not.include("Table vendas.pedido {");
      expect(after, "Ref migrated").to.include("vendas.pedido_novo.cliente_id");
    });
  });

  it("row 79: Table menu Delete + confirm removes the table and its refs from the DBML", () => {
    cy.window().then((w) => {
      cy.stub(w, "confirm").as("confirmDlg").returns(true);
    });

    cy.get(nodeSel(SMOKE_NODES.pedido)).find('[aria-label="Table menu"]').click({ force: true });
    cy.get("[role='menu']").contains("[role='menuitem']", "Delete").click();
    cy.get("@confirmDlg").should("have.been.called");

    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after, "pedido table gone").to.not.include("Table vendas.pedido {");
      expect((after.match(/^\s*Ref:/gm) ?? []).length, "related Ref gone").to.eq(0);
      expect(after).to.include("Table vendas.cliente {");
    });
  });

  it("row 85: drag the bottom-right resize handle stores a rounded size", () => {
    cy.request("GET", "/api/project").then((res) => {
      const before = res.body as ProjectBody;
      const prev = before.canvas?.sizes?.[SMOKE_NODES.pedido];

      selectTable(SMOKE_NODES.pedido);
      dragResizeHandle(SMOKE_NODES.pedido, 120, 80);
      saveViaPaletteShortcut();

      cy.request("GET", "/api/project").then((afterRes) => {
        const after = afterRes.body as ProjectBody;
        const size = after.canvas?.sizes?.[SMOKE_NODES.pedido];
        expect(size, "stored size exists").to.be.an("object");
        const stored = size as { width?: number; height?: number };
        expect(stored.width, "width").to.be.a("number");
        expect(stored.height, "height").to.be.a("number");
        expect(stored.width, "width rounded").to.eq(Math.round(stored.width!));
        expect(stored.height, "height rounded").to.eq(Math.round(stored.height!));
        expect(stored.width, "minWidth").to.be.at.least(200);
        expect(stored.height, "minHeight").to.be.at.least(120);
        if (typeof prev === "object" && prev) {
          const sameW = prev.width === stored.width;
          const sameH = prev.height === stored.height;
          expect(sameW && sameH, "size changed vs previous").to.eq(false);
        }
      });
    });
  });

  it('row 86: "+ coluna" adds nova_coluna string to the DBML', () => {
    selectTable(SMOKE_NODES.item);
    cy.get(nodeSel(SMOKE_NODES.item)).contains("button", "+ coluna").click({ force: true });
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after).to.include("nova_coluna string");
      const start = after.indexOf("Table vendas.item {");
      const end = after.indexOf("Table vendas.resumo {");
      expect(start, "item block").to.be.gte(0);
      expect(after.slice(start, end > start ? end : undefined)).to.include("nova_coluna string");
    });
  });

  it("row 87: Enter commits an inline column rename to the DBML", () => {
    selectTable(SMOKE_NODES.item);
    columnNameSpan(SMOKE_NODES.item, "sku").dblclick({ force: true });
    cy.get(nodeSel(SMOKE_NODES.item)).find("input.col-edit").should("be.visible");
    cy.get(nodeSel(SMOKE_NODES.item)).find("input.col-edit").clear().type("sku_novo{enter}");
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after).to.include("sku_novo");
      const start = after.indexOf("Table vendas.item {");
      const end = after.indexOf("Table vendas.resumo {");
      const block = after.slice(start, end > start ? end : undefined);
      expect(block).to.include("sku_novo");
      expect(block).to.not.match(/^\s*sku\s+/m);
    });
  });

  it("row 87: Escape cancels an inline column rename and leaves the DBML unchanged", () => {
    cy.dbmlText().then((before) => {
      selectTable(SMOKE_NODES.item);
      columnNameSpan(SMOKE_NODES.item, "sku").dblclick({ force: true });
      cy.get(nodeSel(SMOKE_NODES.item)).find("input.col-edit").should("be.visible");
      cy.get(nodeSel(SMOKE_NODES.item))
        .find("input.col-edit")
        .clear()
        .type("should_not_stick{esc}");
      cy.get(nodeSel(SMOKE_NODES.item)).find("input.col-edit").should("not.exist");
      saveViaPaletteShortcut();

      cy.dbmlText().should((after) => {
        expect(after, "Escape left the document unchanged").to.eq(before);
        expect(after).to.not.include("should_not_stick");
        expect(after).to.include("sku");
      });
    });
  });

  it("row 88: Alt+click a column opens the source drawer at that column's line", () => {
    columnNameSpan(SMOKE_NODES.pedido, "cliente_id").click({ altKey: true, force: true });
    cy.get('[data-testid="source-drawer"]').should("be.visible");

    // SourceDrawer returns null for Editor while closed; goToColumn uses a single rAF.
    // A second Alt+click (same gesture) runs after the editor is mounted.
    columnNameSpan(SMOKE_NODES.pedido, "cliente_id").click({ altKey: true, force: true });
    cy.get('[data-testid="source-drawer"] .cm-activeLine').should("contain", "cliente_id");
  });
});
