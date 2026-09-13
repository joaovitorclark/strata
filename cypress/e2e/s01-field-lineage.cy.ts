import {
  collapseLayersPanel,
  nodeSel,
  saveViaPaletteShortcut,
  SMOKE_NODES,
  waitForCanvas,
  zoomUntil,
} from "./canvas-support";
import { LOD_FULL_ABOVE, LOD_SIGIL_BELOW } from "../../src/features/canvas/utils/lod";

const NEW_MAP = "vendas.pedido.id < vendas.item.sku";

function fieldLineCount(dbml: string): number {
  const block = /LineageFields\s*\{([^}]*)\}/.exec(dbml);
  if (!block) return 0;
  return block[1].split("\n").filter((line) => line.includes("<")).length;
}

function openLayersPanel(): void {
  cy.get(".layers-panel").then(($p) => {
    if ($p.hasClass("is-collapsed")) {
      cy.wrap($p).find(".layers-panel__collapse").click({ force: true });
    }
  });
  cy.get(".layers-panel").should("not.have.class", "is-collapsed");
}

function enableLineageMode(): void {
  openLayersPanel();
  cy.get(".layers-panel__lineage-btn").click();
  cy.get(".layers-panel__lineage-btn").should("have.class", "is-active");
}

function showLineage(): void {
  openLayersPanel();
  cy.contains("label", "Mostrar linhagem").find("input[type=checkbox]").check({ force: true });
}

function zoomToFull(): void {
  collapseLayersPanel();
  zoomUntil((z) => z > LOD_FULL_ABOVE, "in");
}

function zoomToSigil(): void {
  collapseLayersPanel();
  zoomUntil((z) => z < LOD_SIGIL_BELOW, "out");
}

describe("S01 field lineage only", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
  });

  it("G16: drag fl:s: → fl:t: in lineage mode adds that LineageFields line", () => {
    cy.dbmlText().then((before) => {
      expect(before).to.not.contain(NEW_MAP);
      const n = fieldLineCount(before);

      enableLineageMode();
      zoomToFull();
      cy.get('[data-handleid="fl:s:sku"]').should("exist");
      cy.get('[data-handleid="fl:t:id"]').should("exist");

      cy.connectHandles(SMOKE_NODES.item, "fl:s:sku", SMOKE_NODES.pedido, "fl:t:id");
      saveViaPaletteShortcut();

      cy.dbmlText().should((after) => {
        expect(fieldLineCount(after), "LineageFields gained exactly one line").to.equal(n + 1);
        expect(after).to.contain(NEW_MAP);
        expect(after).to.not.contain("Lineage {");
      });
    });
  });

  it("G17: broken gesture (s: → t: in lineage mode) leaves DBML unchanged", () => {
    enableLineageMode();
    zoomToFull();
    cy.dbmlText().then((before) => {
      cy.connectHandles(SMOKE_NODES.item, "s:sku", SMOKE_NODES.pedido, "t:id");
      saveViaPaletteShortcut();
      cy.dbmlText().should((after) => {
        expect(after, "guard: relation handles in lineage mode must not mutate").to.equal(before);
      });
    });
  });

  it("G18: outside lineage mode, no fl: handle is in the DOM", () => {
    zoomToFull();
    cy.get('[data-handleid^="fl:"]').should("not.exist");
  });

  it("G19: zoom below LOD_SIGIL_BELOW shows aggregated edge with the count", () => {
    showLineage();
    zoomToSigil();
    cy.get('[data-testid^="rf__edge-fla:"]').should("exist");
    cy.contains("2 campos").should("be.visible");
    cy.get(".react-flow__edge").then(($edges) => {
      const field = [...$edges].filter((el) =>
        (el.getAttribute("data-testid") ?? "").startsWith("rf__edge-fl:"),
      );
      expect(field, "no per-field edges at sigil LOD").to.have.length(0);
    });
  });

  it("G20: zoom above LOD_FULL_ABOVE and select shows field edges", () => {
    showLineage();
    zoomToFull();
    cy.get(nodeSel(SMOKE_NODES.resumo)).click("top", { force: true });
    cy.get(nodeSel(SMOKE_NODES.resumo)).should("have.class", "selected");
    cy.get('[data-testid^="rf__edge-fl:"]').should("have.length.at.least", 2);
    cy.get('[data-testid^="rf__edge-fla:"]').should("not.exist");
  });

  it("G21: old L1 port-to-port gesture does not change the DBML", () => {
    enableLineageMode();
    zoomToFull();
    cy.get(".lineage-port-handle").should("not.exist");
    cy.get('[data-handleid="lin-r-s"]').should("not.exist");
    cy.get('[data-handleid="lin-l-t"]').should("not.exist");
    cy.dbmlText().then((before) => {
      cy.dbmlText().should((after) => {
        expect(after).to.equal(before);
        expect(after).to.not.contain("Lineage {");
      });
    });
  });
});
