import { saveViaPaletteShortcut, waitForCanvas } from "./canvas-support";

const EXISTING_REF = "Ref: vendas.pedido.cliente_id > vendas.cliente.id";
const NEW_REF = "Ref: vendas.item.sku > vendas.pedido.id";
const RETARGETED_REF = "Ref: vendas.pedido.cliente_id > vendas.item.id";

function refCount(dbml: string): number {
  return (dbml.match(/^\s*Ref:/gm) ?? []).length;
}

describe("reconnectHandle helper", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  // Guard + row 69. Asserts DBML Ref *text*, not a rendered edge.
  // connectHandles cannot reach this path: it mousedowns a column Handle and
  // hits onConnect (new Ref). Reconnect is EdgeAnchor onMouseDown → onReconnect.
  it("retargets the existing Ref in the DBML without adding one", () => {
    cy.dbmlText().then((before) => {
      expect(refCount(before), "fixture baseline").to.equal(1);
      expect(before).to.contain(EXISTING_REF);

      cy.reconnectHandle("target", "vendas.item", "t:id");
      saveViaPaletteShortcut();

      cy.dbmlText().should((after) => {
        expect(refCount(after), "Ref count unchanged").to.equal(1);
        expect(after).to.contain(RETARGETED_REF);
        expect(after).not.to.contain(EXISTING_REF);
      });
    });
  });
});

describe("canvas creation gestures", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  it("row 40: dragging a column handle onto another column adds exactly one Ref", () => {
    cy.dbmlText().then((before) => {
      expect(refCount(before), "fixture baseline").to.equal(1);

      cy.connectHandles("vendas.item", "s:sku", "vendas.pedido", "t:id");
      saveViaPaletteShortcut();

      cy.dbmlText().should((after) => {
        expect(refCount(after), "exactly one new Ref").to.equal(2);
        expect(after).to.contain("vendas.item.sku");
      });
    });
  });

  it("row 66: dropping a source handle on a target handle orients the Ref with PK as target", () => {
    cy.connectHandles("vendas.item", "s:sku", "vendas.pedido", "t:id");
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after).to.contain(NEW_REF);
      expect(refCount(after)).to.equal(2);
    });
  });
});
