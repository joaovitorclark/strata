export type FixtureProject = "smoke" | "wide" | "large";

declare global {
  namespace Cypress {
    interface Chainable {
      /** Task 36 implements cy.dragNode. Stub throws if called. */
      dragNode(id: string, dx: number, dy: number): Chainable<void>;
      /** Activate a committed fixture project (smoke / wide / large) and visit `/`. */
      seedProject(name: FixtureProject): Chainable<void>;
    }
  }
}

Cypress.Commands.add("dragNode", (_id: string, _dx: number, _dy: number) => {
  throw new Error("Task 36 implements cy.dragNode");
});

Cypress.Commands.add("seedProject", (name: FixtureProject) => {
  cy.request("GET", "/api/projects").then((res) => {
    const body = res.body as {
      projects: Array<{ id: string; slug: string }>;
    };
    const proj = body.projects.find((p) => p.slug === name);
    if (!proj) {
      throw new Error(
        `fixture project "${name}" not found — run cypress/fixtures/seed.mjs once and commit the output`,
      );
    }
    cy.request("POST", `/api/projects/${proj.id}/activate`);
    cy.visit("/");
  });
});
