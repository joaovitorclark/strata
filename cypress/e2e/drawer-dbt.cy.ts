import { nodeSel, selectCanvasDetailLevel } from "./canvas-support";

const DBT_DEMO = "dbt-demo";
const DIM = "gold.dim_cliente";
const YML = "models/vendas/gold/_dim_cliente.yml";

type DomainRow = { id: string; slug: string };
type ProjectRow = { id: string; slug: string };

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
        cy.request("POST", `/api/projects/${proj.id}/activate`).then(() => {
          cy.request("GET", "/api/project").its("body.format").should("eq", "dbt");
          cy.visit("/");
          cy.get(`[data-testid="rf__node-${DIM}"]`, { timeout: 20000 }).should("exist");
        });
      });
    });
  });
}

function dbtFiles(): Cypress.Chainable<Record<string, string>> {
  return cy.request("GET", "/api/project").then((res) => {
    expect(res.body.format).to.eq("dbt");
    return res.body.files as Record<string, string>;
  });
}

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

function openDimDrawer(): void {
  cy.get(nodeSel(DIM)).click("top", { force: true });
  cy.get('[data-testid="drawer-tab-dbt"]').should("have.attr", "data-state", "active");
  cy.get('[data-testid="dbt-yaml-editor"] .cm-content', { timeout: 20000 }).should(
    "contain",
    "name: dim_cliente",
  );
}

function typeYamlDescription(current: string, tag: string): void {
  const needle = "  - name: dim_cliente\n";
  expect(current, YML).to.include(needle);
  const next = current.replace(needle, `${needle}    description: ${tag}\n`);
  cy.get('[data-testid="dbt-yaml-editor"] .cm-content').click({ force: true });
  cy.get('[data-testid="dbt-yaml-editor"] .cm-content').type("{selectall}", { delay: 0 });
  cy.get('[data-testid="dbt-yaml-editor"] .cm-content').type(next, {
    delay: 0,
    parseSpecialCharSequences: false,
  });
  cy.get('[data-testid="dbt-yaml-editor"] .cm-content').should("contain", `description: ${tag}`);
}

describe("D3 dbt code drawer", () => {
  beforeEach(() => {
    restoreDbtDemo();
    cy.intercept("PUT", "**/api/projects/*").as("dbtPut");
    visitVendas();
  });

  afterEach(() => {
    cy.request("GET", "/api/domains").then((res) => {
      const body = res.body as { domains: DomainRow[] };
      const domain = body.domains.find((d) => d.slug === "local");
      if (!domain) throw new Error("domain local not found");
      cy.request("POST", `/api/domains/${domain.id}/activate`);
    });
  });

  it("G6: selected table shows yaml; description save changes only that line", () => {
    openDimDrawer();
    dbtFiles().then((before) => {
      typeYamlDescription(before[YML], "g6-drawer");
      cy.get('[data-testid="source-drawer"] [data-testid="drawer-save"]').click({ force: true });
      cy.wait("@dbtPut");
      dbtFiles().then((after) => {
        expect(after[YML]).to.contain("description: g6-drawer");
        const stripped = after[YML].split("\n")
          .filter((l) => !l.includes("g6-drawer"))
          .join("\n");
        expect(stripped).to.eq(before[YML]);
        for (const path of Object.keys(before)) {
          if (path === YML) continue;
          expect(after[path], path).to.eq(before[path]);
        }
      });
    });
  });

  it("G7: invalid yaml shows a line error and does not write disk", () => {
    openDimDrawer();
    dbtFiles().then((before) => {
      cy.get('[data-testid="dbt-yaml-editor"] .cm-content')
        .click({ force: true })
        .type("{selectall}:::not-yaml", { delay: 0 });
      cy.get('[data-testid="source-drawer"] [data-testid="drawer-save"]').click({ force: true });
      cy.get('[data-testid="dbt-yaml-editor"]').should("contain", "⚠");
      cy.get("@dbtPut.all").should("have.length", 0);
      dbtFiles().then((after) => {
        expect(after).to.deep.eq(before);
      });
    });
  });

  it("G8: DDL add column writes yaml and shows the column on the canvas", () => {
    selectCanvasDetailLevel("Colunas");
    openDimDrawer();
    cy.get('[data-testid="drawer-tab-ddl"]').click({ force: true });
    cy.get('[data-testid="ddl-editor"] .cm-content').should("contain", "dim_cliente");
    cy.contains(".cm-line", "PRIMARY KEY").click({ force: true });
    cy.focused().type("{home}  g8_col STRING,{enter}");
    cy.get('[data-testid="ddl-editor"] [data-testid="drawer-save"]').click({ force: true });
    cy.wait("@dbtPut");
    dbtFiles().then((after) => {
      expect(after[YML]).to.match(/name:\s*g8_col/);
    });
    cy.get(nodeSel(DIM))
      .contains(".col-row span", /^g8_col$/)
      .should("exist");
  });

  it("G9: Diff tab after an edit shows the file and a per-model summary", () => {
    openDimDrawer();
    dbtFiles().then((files) => {
      typeYamlDescription(files[YML], "g9-drawer");
      cy.get('[data-testid="source-drawer"] [data-testid="drawer-save"]').click({ force: true });
      cy.wait("@dbtPut");
      cy.get('[data-testid="drawer-tab-diff"]').click({ force: true });
      cy.get('[data-testid="dbt-file-diff"]').should("be.visible");
      cy.get('[data-testid="dbt-diff-file"]').should("contain", YML);
      cy.get('[data-testid="dbt-diff-models"]').should("contain", "dim_cliente");
    });
  });
});
