const DBT_DEMO = "dbt-demo";
const TABLE = "gold.d5_managed";
const SQL = "models/vendas/gold/d5_managed.sql";
const YML = "models/vendas/gold/_d5_managed.yml";
const LOCK = ".strata/generated.lock.yml";
const GITATTR = ".gitattributes";

type DomainRow = { id: string; slug: string };
type ProjectRow = { id: string; slug: string };

function e2eDataDir(): string {
  const fromEnv = Cypress.env("E2E_DATA_DIR");
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : ".e2e-data";
}

function restoreDbtDemo(): void {
  const root = e2eDataDir();
  cy.exec(
    `rm -rf "${root}/domains/dbt-demo" && mkdir -p "${root}/domains" && cp -R cypress/fixtures/data/domains/dbt-demo "${root}/domains/dbt-demo"`,
  );
}

function visitVendas(): void {
  cy.request("GET", "/api/domains").then((res) => {
    const body = res.body as { domains: DomainRow[] };
    const domain = body.domains.find((d) => d.slug === DBT_DEMO);
    if (!domain) throw new Error(`domain ${DBT_DEMO} not found`);
    cy.request("POST", `/api/domains/${domain.id}/activate`).then(() => {
      cy.request("GET", "/api/projects").then((pres) => {
        const projects = pres.body as { projects: ProjectRow[] };
        const proj = projects.projects.find((p) => p.slug === "vendas");
        if (!proj) throw new Error("project vendas not found");
        cy.wrap(proj.id).as("vendasId");
        cy.request("POST", `/api/projects/${proj.id}/activate`).then(() => {
          cy.request("GET", "/api/project").its("body.format").should("eq", "dbt");
          cy.visit("/");
          cy.get('[data-testid="rf__node-gold.dim_cliente"]', { timeout: 20000 }).should("exist");
        });
      });
    });
  });
}

describe("D5 managed drift", () => {
  beforeEach(() => {
    restoreDbtDemo();
    cy.intercept("PUT", "**/api/projects/*").as("dbtPut");
    visitVendas();
  });

  afterEach(() => {
    restoreDbtDemo();
    cy.request("GET", "/api/domains").then((res) => {
      const body = res.body as { domains: DomainRow[] };
      const domain = body.domains.find((d) => d.slug === "local");
      if (!domain) throw new Error("domain local not found");
      cy.request("POST", `/api/domains/${domain.id}/activate`);
    });
  });

  it("G9: API sql edit → reload → drift; Tornar manual removes markers on disk", function () {
    cy.window().then((win) => {
      cy.stub(win, "prompt").returns(TABLE);
    });
    cy.contains("button", "+ Tabela").should("not.be.disabled").click();
    cy.wait("@dbtPut");
    cy.get(`[data-testid="rf__node-${TABLE}"]`, { timeout: 20000 }).should("exist");

    cy.get<string>("@vendasId").then((projectId) => {
      cy.request("GET", "/api/project").then((res) => {
        const files = res.body.files as Record<string, string>;
        expect(files[SQL], "managed sql").to.be.a("string");
        cy.request("PUT", `/api/projects/${projectId}`, {
          format: "dbt",
          changes: { [SQL]: `${files[SQL]}\n-- cy-drift\n` },
        });
      });
    });

    cy.reload();
    cy.get(`[data-testid="rf__node-${TABLE}"]`, { timeout: 20000 }).should("exist");
    cy.get(`[data-testid="rf__node-${TABLE}"]`).click("top", { force: true });
    cy.get('[data-testid="managed-drift"]', { timeout: 15000 }).should("exist");
    cy.get('[data-testid="managed-make-manual"]').click();
    cy.wait("@dbtPut");

    cy.request("GET", "/api/project").then((res) => {
      const files = res.body.files as Record<string, string>;
      expect(files[YML] ?? "").to.not.contain("strata:managed");
      expect(files[YML] ?? "").to.not.match(/managed:\s*true/);
      expect(files[LOCK] ?? "").to.not.contain(SQL);
      expect(files[SQL]).to.contain("-- cy-drift");
    });

    cy.task("snapshotTree", `${e2eDataDir()}/domains/dbt-demo`).then((tree) => {
      const files = tree as Record<string, { content: string }>;
      expect(files[GITATTR]?.content ?? "").to.not.contain(`${SQL} linguist-generated=true`);
      expect(files[LOCK]?.content ?? "").to.not.contain(SQL);
      expect(files[YML]?.content ?? "").to.not.contain("strata:managed");
    });
  });
});
