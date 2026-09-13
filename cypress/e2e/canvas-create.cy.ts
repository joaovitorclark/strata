import { saveViaPaletteShortcut, waitForCanvas } from "./canvas-support";

const EXISTING_REF = "Ref: vendas.pedido.cliente_id > vendas.cliente.id";
const NEW_REF = "Ref: vendas.item.sku > vendas.pedido.id";
const RETARGETED_REF = "Ref: vendas.pedido.cliente_id > vendas.item.id";

function refCount(dbml: string): number {
  return (dbml.match(/^\s*Ref:/gm) ?? []).length;
}

function lineageEntryCount(dbml: string): number {
  const block = /Lineage\s*\{([^}]*)\}/.exec(dbml);
  if (!block) return 0;
  return block[1].split("\n").filter((line) => line.includes("<")).length;
}

function enableLineageMode(): void {
  cy.get('[data-testid="left-panel-layers"]').click({ force: true });
  cy.get(".layers-panel").should("be.visible");
  cy.get(".layers-panel__lineage-btn").click();
  cy.get(".layers-panel__lineage-btn").should("have.class", "is-active");
  cy.get(".lineage-port-handle").should("have.length.at.least", 8);
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

  it("row 67: lineage mode, drag between edge ports adds a table-level Lineage entry", () => {
    cy.dbmlText().then((before) => {
      expect(lineageEntryCount(before), "fixture lineage").to.equal(1);
      expect(before).to.contain("vendas.resumo < vendas.pedido");
      expect(before).not.to.match(/vendas\.item\s*<\s*vendas\.cliente/);

      enableLineageMode();
      cy.connectHandles("vendas.cliente", "lin-r-s", "vendas.item", "lin-l-t");
      saveViaPaletteShortcut();

      cy.dbmlText().should((after) => {
        expect(lineageEntryCount(after), "Lineage {} gained one entry").to.equal(2);
        expect(after).to.match(/vendas\.item\s*<\s*vendas\.cliente/);
        expect(after).to.contain("vendas.resumo < vendas.pedido");
      });
    });
  });

  it("row 68: try fl: field handles; ColumnRow does not mount them", () => {
    enableLineageMode();
    cy.get(".lineage-port-handle").should("have.length.at.least", 8);

    cy.get("body").then(($body) => {
      const fieldSources = $body.find('[data-handleid^="fl:s:"]').length;
      const fieldTargets = $body.find('[data-handleid^="fl:t:"]').length;

      if (fieldSources === 0 || fieldTargets === 0) {
        expect(fieldSources, "fl:s: handles (ColumnRow has only s:/t:)").to.equal(0);
        expect(fieldTargets, "fl:t: handles").to.equal(0);
        return;
      }

      cy.connectHandles("vendas.item", "fl:s:sku", "vendas.pedido", "fl:t:id");
      saveViaPaletteShortcut();
      cy.dbmlText().should((after) => {
        expect(after).to.contain("LineageFields");
        expect(after).to.contain("vendas.pedido.id < vendas.item.sku");
      });
    });
  });
});
