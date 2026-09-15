import { selectCanvasDetailLevel, setEdgeVisibility } from "./canvas-support";

const VAREJO = "varejo";
const RECEITA = [
  "bronze.pedidos",
  "silver.pedido",
  "gold.fct_vendas",
  "gold.agg_vendas_diarias",
] as const;

type DomainRow = { id: string; slug: string };
type ProjectRow = { id: string; slug: string; name: string };

function activateDomain(slug: string): void {
  cy.request("GET", "/api/domains").then((res) => {
    const body = res.body as { domains: DomainRow[] };
    const domain = body.domains.find((d) => d.slug === slug);
    if (!domain) throw new Error(`domain ${slug} not found`);
    cy.request("POST", `/api/domains/${domain.id}/activate`);
  });
}

function activateProject(slug: string): void {
  cy.request("GET", "/api/projects").then((res) => {
    const body = res.body as { projects: ProjectRow[] };
    const proj = body.projects.find((p) => p.slug === slug);
    if (!proj) throw new Error(`project ${slug} not found`);
    cy.request("POST", `/api/projects/${proj.id}/activate`);
  });
}

function visitVarejo(project: "vendas" | "estoque" | "clientes"): void {
  activateDomain(VAREJO);
  activateProject(project);
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.removeItem("strata.detailLevel");
      win.performance.mark("varejo-nav-start");
    },
  });
}

describe("S15 varejo smoke", () => {
  afterEach(() => {
    activateDomain("local");
  });

  it("G8: varejo lists 3 projects; vendas opens with 34 tables and lineage edges", () => {
    activateDomain(VAREJO);
    cy.request("GET", "/api/projects").then((res) => {
      const body = res.body as { projects: ProjectRow[] };
      const slugs = body.projects.map((p) => p.slug).sort();
      expect(slugs, "varejo projects").to.deep.equal(["clientes", "estoque", "vendas"]);
    });

    visitVarejo("vendas");
    cy.get('[data-testid="schema-tree-footer"]', { timeout: 30000 }).should(
      "contain",
      "34 tabelas",
    );
    cy.get('[data-testid="rf__node-gold.fct_vendas"]', { timeout: 30000 }).should("exist");

    setEdgeVisibility("Linhagem", true);
    cy.get(".react-flow__pane").click(20, 20, { force: true });
    selectCanvasDetailLevel("Nome");
    cy.get(".edge-path--lineage").should("have.length.at.least", 1);
  });

  it("G9: view linhagem_receita shows only the revenue chain tables", () => {
    visitVarejo("vendas");
    cy.get('[data-testid="schema-tree-footer"]', { timeout: 30000 }).should(
      "contain",
      "34 tabelas",
    );
    cy.get('[data-testid="view-tabs"]').click({ force: true });
    cy.get('[data-testid="view-item-linhagem_receita"]').click({ force: true });
    cy.get('[data-testid="schema-tree-footer"]').should("contain", "4 tabelas");
    cy.get('[data-testid="schema-tree-outside"]').should("contain", "Fora desta view (30)");
    for (const id of RECEITA) {
      cy.get(`[data-testid="rf__node-${id}"]`).should("exist");
    }
    cy.get('[data-testid="rf__node-gold.dim_loja"]').should("not.exist");
    cy.get('[data-testid="rf__node-bronze.canais"]').should("not.exist");
  });

  it("G10: opening varejo (clientes wide table + vendas) records time to interactive canvas", () => {
    const started = Date.now();
    visitVarejo("clientes");
    cy.get('[data-testid="schema-tree-footer"]', { timeout: 60000 }).should(
      "contain",
      "24 tabelas",
    );
    cy.get('[data-testid="rf__node-bronze.app_eventos"]', { timeout: 60000 }).should("exist");
    cy.get('[data-testid="rf__wrapper"]').should("exist");
    cy.then(() => {
      const clientesMs = Date.now() - started;
      const vendasStarted = Date.now();
      visitVarejo("vendas");
      cy.get('[data-testid="schema-tree-footer"]', { timeout: 60000 }).should(
        "contain",
        "34 tabelas",
      );
      cy.get('[data-testid="rf__wrapper"]').should("exist");
      cy.then(() => {
        const vendasMs = Date.now() - vendasStarted;
        const estoqueStarted = Date.now();
        visitVarejo("estoque");
        cy.get('[data-testid="schema-tree-footer"]', { timeout: 60000 }).should(
          "contain",
          "28 tabelas",
        );
        cy.then(() => {
          const estoqueMs = Date.now() - estoqueStarted;
          cy.writeFile("cypress/reports/varejo-g10.json", {
            clientesMs,
            vendasMs,
            estoqueMs,
            varejoTotalMs: clientesMs + vendasMs + estoqueMs,
            recordedAt: new Date().toISOString(),
          });
        });
      });
    });
  });
});
