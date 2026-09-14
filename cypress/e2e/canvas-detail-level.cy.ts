import type { HeightSample, LodState } from "../support/heightSample";
import {
  collapseLayersPanel,
  fireWindowKey,
  nodeSel,
  selectCanvasDetailLevel,
  setEdgeVisibility,
  SMOKE_NODES,
  waitForCanvas,
  zoomUntil,
} from "./canvas-support";

const LEVEL_LABEL: Record<LodState, "Nome" | "Chaves" | "Colunas" | "Documentação"> = {
  sigil: "Nome",
  keys: "Chaves",
  full: "Colunas",
  docs: "Documentação",
};

const PEDIDO_TABLE: HeightSample["table"] = {
  id: SMOKE_NODES.pedido,
  name: "pedido",
  schema: "vendas",
  columns: [
    { name: "id", type: "bigint", pk: true, notNull: false },
    { name: "cliente_id", type: "bigint", pk: false, notNull: false },
    { name: "total", type: "decimal(18,2)", pk: false, notNull: false },
  ],
  meta: { pks: ["id"], fks: [{ column: "cliente_id", ref: "vendas.cliente.id" }] },
};

function clickPane(): void {
  cy.get(".react-flow__pane").click(20, 20, { force: true });
}

function seedTwelvePedidoColumns(): void {
  cy.request("GET", "/api/project").then((res) => {
    const extra = Array.from({ length: 9 }, (_, i) => `  c${i + 1} int`).join("\n");
    const dbml = String(res.body.dbml).replace(
      /Table vendas\.pedido \{[\s\S]*?\n\}/,
      `Table vendas.pedido {\n  id bigint [pk]\n  cliente_id bigint\n  total decimal(18,2)\n${extra}\n}`,
    );
    cy.request("PUT", "/api/project", { dbml, canvas: res.body.canvas });
  });
  cy.reload();
  waitForCanvas();
  collapseLayersPanel();
  clickPane();
}

describe("S05 canvas detail level", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    collapseLayersPanel();
    clickPane();
  });

  it('G5: select "Colunas" → 12-column node shows 12 rows', () => {
    seedTwelvePedidoColumns();
    selectCanvasDetailLevel("Colunas");
    cy.get(nodeSel(SMOKE_NODES.pedido)).find(".col-row").should("have.length", 12);
  });

  it('G6: "Nome" → no .col-row in DOM', () => {
    selectCanvasDetailLevel("Nome");
    cy.get(nodeSel(SMOKE_NODES.pedido)).find(".col-row").should("have.length", 0);
  });

  it("G7: zoom 0.3 → same .col-row count as zoom 1 (content did not change)", () => {
    selectCanvasDetailLevel("Colunas");
    cy.get(nodeSel(SMOKE_NODES.pedido))
      .find(".col-row")
      .its("length")
      .then((atOne) => {
        zoomUntil((z) => z <= 0.3, "out");
        cy.get(nodeSel(SMOKE_NODES.pedido)).find(".col-row").should("have.length", atOne);
      });
  });

  it("G8: rendered node height == lodHeight ±1px at all 4 levels", () => {
    const states: LodState[] = ["sigil", "keys", "full", "docs"];
    const keys: Record<LodState, string> = { sigil: "1", keys: "2", full: "3", docs: "4" };
    const samples: HeightSample[] = states.map((state) => ({
      id: SMOKE_NODES.pedido,
      state,
      table: PEDIDO_TABLE,
      density: "cozy",
    }));
    cy.task<number[]>("nodeHeights", samples).then((predicted) => {
      cy.wrap(states).each((state: LodState, i: number) => {
        clickPane();
        fireWindowKey({ key: keys[state] });
        cy.get('[data-testid="detail-level-select"]').should("contain", LEVEL_LABEL[state]);
        cy.get(nodeSel(SMOKE_NODES.pedido)).should(($n) => {
          expect($n[0].offsetHeight, `${state} height`).to.be.closeTo(predicted[i], 1);
        });
      });
    });
  });

  it("G9: key 3 → Columns; key 3 with focus in an input → no change", () => {
    clickPane();
    fireWindowKey({ key: "3" });
    cy.get('[data-testid="detail-level-select"]').should("contain", "Colunas");

    selectCanvasDetailLevel("Nome");
    cy.get('[data-testid="detail-level-select"]').should("contain", "Nome");
    fireWindowKey({ key: "k", metaKey: true, ctrlKey: true });
    cy.get('[data-testid="command-palette"] input').should("exist").click().type("3");
    cy.get('[data-testid="detail-level-select"]').should("contain", "Nome");
  });

  it("S05 hotfix: Documentação aggregates lineage when an endpoint has no note", () => {
    cy.window().then((win) => {
      cy.spy(win.console, "warn").as("consoleWarn");
      cy.spy(win.console, "error").as("consoleError");
    });
    setEdgeVisibility("Linhagem", true);
    clickPane();
    selectCanvasDetailLevel("Documentação");
    cy.get('[data-testid^="rf__edge-fla:"]').should("exist");
    cy.get('[data-testid^="rf__edge-fl:"]').should("not.exist");
    cy.get("@consoleWarn")
      .invoke("getCalls")
      .then((calls: Array<{ args: unknown[] }>) => {
        expect(calls.map((c) => c.args.map(String).join(" ")).join("\n")).to.not.match(
          /Couldn't create edge/i,
        );
      });
    cy.get("@consoleError")
      .invoke("getCalls")
      .then((calls: Array<{ args: unknown[] }>) => {
        expect(calls.map((c) => c.args.map(String).join(" ")).join("\n")).to.not.match(
          /Couldn't create edge/i,
        );
      });
  });
});
