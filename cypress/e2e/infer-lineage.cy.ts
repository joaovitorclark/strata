import { openLayersTab, selectCanvasDetailLevel, setEdgeVisibility } from "./canvas-support";

const DOMAIN = "infer";
const PROJECT = "infer";
const PARSED_EDGE = "fl:raw.alpha.id->gold.rename_simple.customer_id";
const DECLARED_EDGE = "fl:raw.alpha.nome->gold.rename_simple.nome";
const YML = "models/infer/gold/_rename_simple.yml";

type DomainRow = { id: string; slug: string };
type ProjectRow = { id: string; slug: string };

function e2eDataDir(): string {
  const fromEnv = Cypress.env("E2E_DATA_DIR");
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : ".e2e-data";
}

function visitInfer(): void {
  cy.request("GET", "/api/domains").then((res) => {
    const body = res.body as { domains: DomainRow[] };
    const domain = body.domains.find((d) => d.slug === DOMAIN);
    if (!domain) throw new Error(`domain ${DOMAIN} not found`);
    cy.request("POST", `/api/domains/${domain.id}/activate`).then(() => {
      cy.request("GET", "/api/projects").then((pres) => {
        const projects = pres.body as { projects: ProjectRow[] };
        const proj = projects.projects.find((p) => p.slug === PROJECT);
        if (!proj) throw new Error("project infer not found");
        cy.request("POST", `/api/projects/${proj.id}/activate`).then(() => {
          cy.request("GET", "/api/project").its("body.format").should("eq", "dbt");
          cy.visit("/");
          cy.get('[data-testid="rf__node-gold.rename_simple"]', { timeout: 20000 }).should("exist");
        });
      });
    });
  });
}

function restoreInfer(): void {
  const root = e2eDataDir();
  cy.exec(
    `rm -rf "${root}/domains/infer" && mkdir -p "${root}/domains" && cp -R cypress/fixtures/data/domains/infer "${root}/domains/infer"`,
  );
}

function fileContents(
  tree: Record<string, { mtimeMs: number; content: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (key === "projects.json") continue;
    out[key] = value.content;
  }
  return out;
}

function dbtFiles(): Cypress.Chainable<Record<string, string>> {
  return cy.request("GET", "/api/project").then((res) => {
    expect(res.body.format).to.eq("dbt");
    return res.body.files as Record<string, string>;
  });
}

function showFieldLineage(): void {
  selectCanvasDetailLevel("Colunas");
  setEdgeVisibility("Linhagem", true);
  openLayersTab();
  cy.get(".layers-panel__lineage-btn").click({ force: true });
  cy.get(".layers-panel__lineage-btn").should("have.class", "is-active");
}

describe("S13 infer lineage", () => {
  afterEach(() => {
    cy.request("GET", "/api/domains").then((res) => {
      const body = res.body as { domains: DomainRow[] };
      const domain = body.domains.find((d) => d.slug === "local");
      if (!domain) throw new Error("domain local not found");
      cy.request("POST", `/api/domains/${domain.id}/activate`);
    });
  });

  it("G10: opening infer/ shows dotted inferred edges and writes zero bytes", () => {
    restoreInfer();
    const dir = `${e2eDataDir()}/domains/infer`;
    visitInfer();
    cy.task("snapshotTree", dir).then((before) => {
      showFieldLineage();
      cy.get(".edge-path--field-lineage-inferred").should("have.length.at.least", 1);
      cy.task("snapshotTree", dir).then((after) => {
        expect(
          fileContents(after as Record<string, { mtimeMs: number; content: string }>),
        ).to.deep.equal(
          fileContents(before as Record<string, { mtimeMs: number; content: string }>),
        );
      });
    });
  });

  it("G11: confirm a parsed edge turns it dashed and writes inferred: in YAML", () => {
    restoreInfer();
    cy.intercept("PUT", "**/api/projects/*").as("dbtPut");
    visitInfer();
    showFieldLineage();
    cy.get(`.react-flow__edge[data-id="${PARSED_EDGE}"]`).click({ force: true });
    cy.get('[data-testid="infer-tooltip"] [data-testid="infer-confirm"]').click({ force: true });
    cy.wait("@dbtPut");
    cy.get(`.react-flow__edge[data-id="${PARSED_EDGE}"] .edge-path--field-lineage-inferred`).should(
      "not.exist",
    );
    cy.get(`.react-flow__edge[data-id="${PARSED_EDGE}"] .edge-path--field-lineage`).should("exist");
    dbtFiles().then((files) => {
      expect(files[YML]).to.contain("from: raw.alpha.id");
      expect(files[YML]).to.contain("inferred: parsed");
    });
  });

  it("G12: turning off inferred lineage hides inferred edges and keeps declared ones", () => {
    restoreInfer();
    visitInfer();
    showFieldLineage();
    cy.get(".edge-path--field-lineage-inferred").should("have.length.at.least", 1);
    cy.get(`.react-flow__edge[data-id="${DECLARED_EDGE}"] .edge-path--field-lineage`).should(
      "exist",
    );
    cy.get('[data-testid="edge-visibility"]').click();
    cy.get('[role="menuitemcheckbox"]').contains("Linhagem inferida").click();
    cy.get(".edge-path--field-lineage-inferred").should("not.exist");
    cy.get(`.react-flow__edge[data-id="${DECLARED_EDGE}"] .edge-path--field-lineage`).should(
      "exist",
    );
  });
});
