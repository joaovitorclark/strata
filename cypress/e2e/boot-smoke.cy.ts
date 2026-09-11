describe("boot", () => {
  it("serves the built app and loads the seeded project", () => {
    cy.visit("/");
    cy.contains("Strata").should("be.visible");
    cy.get('[data-testid="schema-tree"]').should("exist");
  });
});
