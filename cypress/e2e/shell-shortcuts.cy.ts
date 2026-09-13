function shortcutDispatchKey(
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
function shortcutPressMod(key: string, shiftKey = false) {
  shortcutDispatchKey(key, { metaKey: true, ctrlKey: true, shiftKey });
}

describe("shell shortcuts", () => {
  beforeEach(() => {
    cy.intercept("PUT", "/api/projects/**", { body: { ok: true } }).as("putProject");
    cy.intercept("POST", "/api/export", { body: { files: ["output/stub"] } });
    cy.seedProject("smoke");
    cy.get('[data-testid="schema-tree"]').should("exist");
    cy.get('[data-testid="rf__node-vendas.pedido"]').should("exist");
  });

  it("⌘S saves (PUT intercepted so fixtures stay clean)", () => {
    shortcutPressMod("s");
    cy.wait("@putProject");
  });

  it("⌘Z undoes, ⌘⇧Z and ⌘Y redo", () => {
    cy.window().then((win) => {
      cy.stub(win, "prompt").returns("tmp.probe");
    });
    cy.contains("button", "+ Tabela").click();
    cy.get('[data-testid="rf__node-tmp.probe"]').should("exist");
    // History snapshot is debounced 400ms in useWorkspace.
    cy.wait(500);

    shortcutPressMod("z");
    cy.get('[data-testid="rf__node-tmp.probe"]').should("not.exist");

    shortcutPressMod("z", true);
    cy.get('[data-testid="rf__node-tmp.probe"]').should("exist");

    shortcutPressMod("z");
    cy.get('[data-testid="rf__node-tmp.probe"]').should("not.exist");

    shortcutPressMod("y");
    cy.get('[data-testid="rf__node-tmp.probe"]').should("exist");
  });

  it("Escape clears the canvas table selection", () => {
    cy.get('[data-testid="rf__node-vendas.cliente"]').click("top");
    cy.get('[data-testid="rf__node-vendas.cliente"]').should("have.class", "selected");
    cy.get('[data-testid="inspector"]').should("contain", "vendas.cliente");

    shortcutDispatchKey("Escape");
    cy.get('[data-testid="rf__node-vendas.cliente"]').should("not.have.class", "selected");
    cy.get('[data-testid="inspector"]').should("contain", "Selecione uma tabela");
  });

  it("? opens the shortcuts overlay (⌘Y is listed)", () => {
    cy.get(".react-flow__pane").click("topLeft");
    shortcutDispatchKey("?");
    cy.get('[data-testid="shortcuts-overlay"]').should("be.visible");
    cy.get('[data-testid="shortcuts-overlay"] kbd').then(($kbds) => {
      const keys = [...$kbds].map((el) => el.textContent ?? "");
      expect(
        keys.some((k) => k === "⌘Y" || k === "Ctrl+Y"),
        "⌘Y redo row",
      ).to.eq(true);
    });
  });
});
