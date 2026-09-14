import { selectCanvasDetailLevel, setEdgeVisibility, translateOf } from "./canvas-support";

const AVISO = "Edição de projetos dbt chega na próxima versão";
const POS_X = 888;
const POS_Y = 321;
const DBT_DEMO = "dbt-demo";
const DATA_ROOT = ".e2e-data-d1/domains/dbt-demo";

type DomainRow = { id: string; slug: string };
type ProjectRow = { id: string; slug: string };

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

function visitDbtDemo(project: "vendas" | "vendas-dbml"): void {
  activateDomain(DBT_DEMO);
  activateProject(project);
  cy.visit("/");
  cy.get('[data-testid="rf__node-gold.dim_cliente"]', { timeout: 20000 }).should("exist");
}

function countTables(): Cypress.Chainable<number> {
  return cy.get(".react-flow__node-table").its("length");
}

function countFk(): Cypress.Chainable<number> {
  return cy.get(".edge-path--fk").its("length");
}

function countLineage(): Cypress.Chainable<number> {
  return cy.get(".edge-path--lineage").its("length");
}

describe("D1 dbt read-only", () => {
  afterEach(() => {
    activateDomain("local");
  });

  it("G10: dbt vendas matches vendas-dbml nodes, FK+lineage edges, views, positions", () => {
    visitDbtDemo("vendas");
    cy.get('[data-testid="view-tabs"]').click({ force: true });
    cy.get('[data-testid="view-item-comercial"]').should("exist");
    cy.get('[data-testid="view-item-operacional"]').should("exist");
    cy.get("body").type("{esc}");

    cy.get('[data-testid="rf__node-gold.dim_cliente"]').should(($n) => {
      const t = translateOf($n.attr("style") ?? $n[0].getAttribute("style") ?? "");
      expect(t, "canvas.yml positions applied").to.deep.equal({ x: POS_X, y: POS_Y });
    });

    selectCanvasDetailLevel("Colunas");
    cy.get(".edge-path--fk").should("have.length.at.least", 1);
    countTables().as("nodes");
    countFk().as("fk");

    setEdgeVisibility("Linhagem", true);
    cy.get(".react-flow__pane").click(20, 20, { force: true });
    selectCanvasDetailLevel("Nome");
    cy.get(".edge-path--lineage").should("have.length.at.least", 1);
    countLineage().as("lin");

    cy.then(function () {
      const nodes = this.nodes as number;
      const fk = this.fk as number;
      const lin = this.lin as number;
      expect(nodes, "vendas tables").to.be.at.least(8);
      visitDbtDemo("vendas-dbml");
      selectCanvasDetailLevel("Colunas");
      countTables().should("eq", nodes);
      countFk().should("eq", fk);
      setEdgeVisibility("Linhagem", true);
      cy.get(".react-flow__pane").click(20, 20, { force: true });
      selectCanvasDetailLevel("Nome");
      countLineage().should("eq", lin);
    });
  });

  it("G11: edits disabled with aviso; dbt files on disk unchanged", () => {
    visitDbtDemo("vendas");
    cy.task<Record<string, { mtimeMs: number; content: string }>>("snapshotTree", DATA_ROOT).then(
      (before) => {
        cy.contains("button", "+ Tabela").should("be.disabled").and("have.attr", "title", AVISO);

        cy.window().then((win) => cy.stub(win, "prompt").as("prompt"));
        cy.get('[data-testid="rf__node-gold.dim_cliente"] .font-medium')
          .first()
          .dblclick({ force: true });
        cy.get("@prompt").should("not.have.been.called");
        cy.contains(AVISO).should("be.visible");

        cy.get(
          '[data-testid="rf__node-gold.dim_cliente"] [data-testid="table-menu-trigger"]',
        ).click({
          force: true,
        });
        cy.contains("[role='menuitem']", "Delete").should("have.attr", "data-disabled");
        cy.contains("[role='menuitem']", "Delete").click({ force: true });
        cy.contains(AVISO).should("be.visible");
        cy.get("body").type("{esc}");

        selectCanvasDetailLevel("Colunas");
        cy.get(".edge-path--fk")
          .its("length")
          .then((fkBefore) => {
            cy.connectHandles("gold.fato_pedido", "s:cliente_id", "raw.cliente", "t:id");
            cy.get(".edge-path--fk").should("have.length", fkBefore);
          });

        cy.task<Record<string, { mtimeMs: number; content: string }>>(
          "snapshotTree",
          DATA_ROOT,
        ).then((after) => {
          expect(Object.keys(after).sort()).to.deep.equal(Object.keys(before).sort());
          for (const rel of Object.keys(before)) {
            expect(after[rel].mtimeMs, `mtime ${rel}`).to.eq(before[rel].mtimeMs);
            expect(after[rel].content, `content ${rel}`).to.eq(before[rel].content);
          }
        });
      },
    );
  });
});
