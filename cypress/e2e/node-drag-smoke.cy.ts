function translateOf(style: string | undefined): { x: number; y: number } {
  const m = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/.exec(style ?? "");
  if (!m) throw new Error(`no translate in style: ${style}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

describe("dragNode helper", () => {
  it("actually moves a node", () => {
    cy.visit("/?project=smoke");
    cy.get('[data-testid="rf__node-vendas.pedido"]').then(($n) => {
      const before = translateOf($n.attr("style"));
      cy.dragNode("vendas.pedido", 120, 80);
      cy.get('[data-testid="rf__node-vendas.pedido"]').should(($after) => {
        const a = translateOf($after.attr("style"));
        expect(a.x).to.be.closeTo(before.x + 120, 4);
        expect(a.y).to.be.closeTo(before.y + 80, 4);
      });
    });
  });
});
