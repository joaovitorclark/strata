function paletteDispatchKey(
  key: string,
  mods: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {},
) {
  cy.window().then((win) => {
    win.dispatchEvent(
      new win.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        metaKey: Boolean(mods.metaKey),
        ctrlKey: Boolean(mods.ctrlKey),
        shiftKey: Boolean(mods.shiftKey),
      }),
    );
  });
}

/** One event with both mods: handler is `metaKey || ctrlKey`, so it runs once. */
function palettePressMod(key: string, shiftKey = false) {
  paletteDispatchKey(key, { metaKey: true, ctrlKey: true, shiftKey });
}

function openPaletteViaShortcut() {
  palettePressMod("k");
  cy.get('[data-testid="command-palette"]').should("exist");
}

function paletteInput() {
  return cy.get('[data-testid="command-palette"] input');
}

function paletteOptions() {
  return cy.get('[data-testid="command-palette"] [role="option"]');
}

describe("shell command palette", () => {
  beforeEach(() => {
    cy.intercept("PUT", "/api/projects/**", { body: { ok: true } });
    cy.intercept("POST", "/api/export", { body: { files: ["output/stub"] } });
    cy.seedProject("smoke");
    cy.get('[data-testid="schema-tree"]').should("exist");
    cy.get('[data-testid="rf__node-vendas.pedido"]').should("exist");
  });

  it("opens from the navbar Buscar button", () => {
    cy.get('[data-testid="command-palette"]').should("not.exist");
    cy.get('[data-testid="navbar"] button[aria-label="Buscar"]').click();
    cy.get('[data-testid="command-palette"]').should("be.visible");
  });

  it("⌘K opens, typing filters, results cap at 12, arrows move highlight", () => {
    openPaletteViaShortcut();
    paletteInput().should("be.visible");

    paletteInput().click().type("e", { delay: 0 });
    paletteOptions().should("have.length.at.most", 12);
    paletteOptions().should("have.length", 12);

    paletteOptions().eq(0).should("have.attr", "data-selected", "true");
    paletteInput().type("{downarrow}");
    paletteOptions().eq(1).should("have.attr", "data-selected", "true");
    paletteInput().type("{uparrow}");
    paletteOptions().eq(0).should("have.attr", "data-selected", "true");
  });

  it("Enter runs the highlighted command and closes the palette", () => {
    openPaletteViaShortcut();
    paletteInput().click().clear().type("Organizar DBML", { delay: 0 });
    paletteOptions().should("have.length.at.least", 1);
    paletteInput().type("{enter}");
    cy.get('[data-testid="command-palette"]').should("not.exist");
    cy.contains("Organizado: tabelas → refs → records").should("be.visible");
  });

  it("clicking a result runs it and closes the palette", () => {
    // RecordsPanel is not in the DOM until a table is selected.
    cy.get('[data-testid="rf__node-vendas.pedido"]').click("top", { force: true });
    openPaletteViaShortcut();
    paletteInput().click().clear().type("Abrir painel Dados", { delay: 0 });
    paletteOptions().contains("Abrir painel Dados").click();
    cy.get('[data-testid="command-palette"]').should("not.exist");
    cy.contains("Dados (amostra)").parents(".is-open").should("exist");
  });

  it("Escape closes the palette", () => {
    openPaletteViaShortcut();
    paletteDispatchKey("Escape");
    cy.get('[data-testid="command-palette"]').should("not.exist");
  });

  it("click outside the palette closes it", () => {
    openPaletteViaShortcut();
    cy.get('[data-testid="command-palette"]')
      .parent()
      .then(($overlay) => {
        const rect = $overlay[0].getBoundingClientRect();
        cy.wrap($overlay).trigger("mousedown", {
          eventConstructor: "MouseEvent",
          bubbles: true,
          clientX: rect.left + 20,
          clientY: rect.top + 8,
          force: true,
        });
      });
    cy.get('[data-testid="command-palette"]').should("not.exist");
  });

  it("choosing a table focuses it on the canvas and scrolls the DBML drawer", () => {
    cy.get('[data-testid="status-bar"] button[aria-label="DBML"]').click();
    cy.get('[data-testid="source-drawer"]').should("be.visible");

    openPaletteViaShortcut();
    paletteInput().click().clear().type("vendas.resumo", { delay: 0 });
    paletteOptions().contains("vendas.resumo").click();
    cy.get('[data-testid="command-palette"]').should("not.exist");

    cy.get('[data-testid="rf__node-vendas.resumo"]').should("have.class", "selected");
    cy.get('[data-testid="inspector"]').should("contain", "vendas.resumo");

    cy.get('[data-testid="source-drawer"]').should("be.visible");
    cy.get('[data-testid="source-drawer"]').should("contain", "Table vendas.resumo");
  });

  it("choosing a column focuses the table, selects the column, and scrolls the drawer", () => {
    cy.get('[data-testid="status-bar"] button[aria-label="DBML"]').click();
    cy.get('[data-testid="source-drawer"]').should("be.visible");

    openPaletteViaShortcut();
    paletteInput().click().clear().type("cliente_id", { delay: 0 });
    paletteOptions().contains("cliente_id").click();
    cy.get('[data-testid="command-palette"]').should("not.exist");

    cy.get('[data-testid="rf__node-vendas.pedido"]').should("have.class", "selected");
    cy.get('[data-testid="inspector"]').should("contain", "cliente_id");

    cy.get('[data-testid="source-drawer"]').should("be.visible");
    cy.get('[data-testid="source-drawer"]').should("contain", "cliente_id");
  });
});
