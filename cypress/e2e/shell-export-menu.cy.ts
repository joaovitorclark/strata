/** pt-BR fallback labels — same order as EXPORTERS in actions.ts. */
const EXPORTER_LABELS = [
  "Exportar dbt",
  "Exportar Spark DDL",
  "Exportar Oracle DDL",
  "Exportar PostgreSQL DDL",
  "Exportar erwin (ANSI)",
  "Exportar Mermaid",
  "Exportar Dicionário de dados (XLSX)",
  "Exportar Contexto para LLM (Markdown+JSON)",
  "Exportar LocalDrawDB (Spark)",
  "Exportar LocalDrawDB (Oracle)",
] as const;

function exportTrigger() {
  return cy.get('[data-testid="navbar"] button[aria-label="Exportar"]');
}

describe("shell export menu", () => {
  beforeEach(() => {
    // Stub writes so opening/keyboard in the menu cannot dirty committed fixtures.
    cy.intercept("PUT", "/api/projects/**", { body: { ok: true } });
    cy.intercept("POST", "/api/export", { body: { files: ["output/stub"] } });
    cy.seedProject("smoke");
    cy.get('[data-testid="schema-tree"]').should("exist");
    cy.get('[data-testid="rf__node-vendas.pedido"]').should("exist");
  });

  it("opens from Exportar, lists all ten EXPORTERS, arrows move focus, Escape restores trigger", () => {
    exportTrigger().should("be.visible").click();
    cy.get('[data-testid="export-menu"]').should("be.visible");
    cy.get('[data-testid="export-menu"] [role="menuitem"]').should("have.length", 10);

    for (const label of EXPORTER_LABELS) {
      cy.get('[data-testid="export-menu"] [role="menuitem"]').contains(label).should("be.visible");
    }

    cy.get('[data-testid="export-menu"] [role="menuitem"]').first().focus();
    cy.focused().should("contain.text", EXPORTER_LABELS[0]);
    cy.focused().type("{downarrow}");
    cy.focused().should("contain.text", EXPORTER_LABELS[1]);
    cy.focused().type("{downarrow}");
    cy.focused().should("contain.text", EXPORTER_LABELS[2]);

    cy.focused().type("{esc}");
    cy.get('[data-testid="export-menu"]').should("not.exist");
    exportTrigger().should("have.focus");
  });
});
