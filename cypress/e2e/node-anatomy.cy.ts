import {
  collapseLayersPanel,
  nodeSel,
  saveViaPaletteShortcut,
  selectCanvasDetailLevel,
  SMOKE_NODES,
  waitForCanvas,
} from "./canvas-support";

const LEVELS = ["Nome", "Chaves", "Colunas", "Documentação"] as const;
const THEMES = ["dark", "light"] as const;

function clickPane(): void {
  cy.get(".react-flow__pane").click(20, 20, { force: true });
}

function menuTrigger(tableId: string = SMOKE_NODES.pedido) {
  return cy.get(nodeSel(tableId)).find('[data-testid="table-menu-trigger"]');
}

function seedCompositePk(): void {
  cy.request("GET", "/api/project").then((res) => {
    const dbml = String(res.body.dbml).replace(
      /Table vendas\.pedido \{[\s\S]*?\n\}/,
      `Table vendas.pedido {
  periodo date
  regiao varchar
  cliente_id bigint
  total decimal(18,2)
  Indexes {
    (periodo, regiao) [pk]
  }
}`,
    );
    cy.request("PUT", "/api/project", { dbml, canvas: res.body.canvas });
  });
  cy.reload();
  waitForCanvas();
  collapseLayersPanel();
  clickPane();
}

function seedPedidoOverflow(): void {
  cy.request("GET", "/api/project").then((res) => {
    const extra = Array.from({ length: 4 }, (_, i) => `  extra_${i + 1} int`).join("\n");
    const dbml = String(res.body.dbml).replace(
      /Table vendas\.pedido \{[\s\S]*?\n\}/,
      `Table vendas.pedido {
  id bigint [pk]
  cliente_id bigint
  total decimal(18,2)
${extra}
}`,
    );
    cy.request("PUT", "/api/project", { dbml, canvas: res.body.canvas });
  });
  cy.reload();
  waitForCanvas();
  collapseLayersPanel();
  clickPane();
}

function setTheme(theme: "dark" | "light"): void {
  cy.get("html").then(($html) => {
    const isDark = $html.hasClass("dark");
    if ((theme === "dark") === isDark) return;
    cy.get('[aria-label="Alternar tema"]').click({ force: true });
  });
  cy.get("html").should(theme === "dark" ? "have.class" : "not.have.class", "dark");
}

function captureNode(theme: string, level: string): void {
  const file = `${theme}-${level.toLowerCase()}`;
  cy.get(nodeSel(SMOKE_NODES.pedido)).scrollIntoView();
  cy.get(".react-flow").screenshot(file, { overwrite: true });
}

describe("S07 node anatomy", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    collapseLayersPanel();
    clickPane();
  });

  it("G3: composite PK → 2 rows before the double separator", () => {
    seedCompositePk();
    selectCanvasDetailLevel("Colunas");
    cy.get(nodeSel(SMOKE_NODES.pedido)).find("[data-key-area] .col-row").should("have.length", 2);
    cy.get(nodeSel(SMOKE_NODES.pedido)).find("[data-key-separator]").should("have.length", 1);
    cy.get(nodeSel(SMOKE_NODES.pedido))
      .find("[data-key-area] .col-row")
      .eq(0)
      .should("contain", "periodo");
    cy.get(nodeSel(SMOKE_NODES.pedido))
      .find("[data-key-area] .col-row")
      .eq(1)
      .should("contain", "regiao");
  });

  it("G4: ⋯ opacity 0 idle, 1 on hover and keyboard focus", () => {
    clickPane();
    menuTrigger().should("have.css", "opacity", "0");
    cy.get(nodeSel(SMOKE_NODES.pedido)).find(".table-node-shell").trigger("mouseover", {
      force: true,
      eventConstructor: "MouseEvent",
    });
    menuTrigger().should("have.css", "opacity", "1");
    cy.get(nodeSel(SMOKE_NODES.pedido)).find(".table-node-shell").trigger("mouseout", {
      force: true,
      eventConstructor: "MouseEvent",
    });
    clickPane();
    menuTrigger().should("have.css", "opacity", "0");
    menuTrigger().focus();
    menuTrigger().should("have.css", "opacity", "1");
  });

  it("G5: no element with exact text PK or FK inside .react-flow__node", () => {
    selectCanvasDetailLevel("Colunas");
    cy.get(".react-flow__node").should(($nodes) => {
      const exact = [...$nodes].flatMap((node) =>
        [...node.querySelectorAll("*")].filter((el) => {
          if (el.children.length > 0) return false;
          const text = (el.textContent ?? "").trim();
          return text === "PK" || text === "FK";
        }),
      );
      expect(exact, "PK/FK text badges").to.have.length(0);
    });
  });

  it("G6: rename via pencil writes the new name into the DBML", () => {
    selectCanvasDetailLevel("Colunas");
    cy.get(nodeSel(SMOKE_NODES.item))
      .contains(".col-row span", /^sku$/)
      .parents(".col-row")
      .find('[data-testid="col-rename"]')
      .trigger("pointerdown", { force: true, eventConstructor: "PointerEvent" });
    cy.get(nodeSel(SMOKE_NODES.item)).find("input.col-edit").should("be.visible");
    cy.get(nodeSel(SMOKE_NODES.item)).find("input.col-edit").clear().type("sku_s07{enter}");
    saveViaPaletteShortcut();
    cy.dbmlText().should((after) => {
      expect(after).to.include("sku_s07");
      const start = after.indexOf("Table vendas.item {");
      const end = after.indexOf("Table vendas.resumo {");
      const block = after.slice(start, end > start ? end : undefined);
      expect(block).to.include("sku_s07");
      expect(block).to.not.match(/^\s*sku\s+/m);
    });
  });

  it("G7: + N colunas expands the node to every column", () => {
    seedPedidoOverflow();
    selectCanvasDetailLevel("Chaves");
    cy.get(nodeSel(SMOKE_NODES.pedido)).find(".col-row").its("length").should("be.lt", 7);
    cy.get(nodeSel(SMOKE_NODES.pedido)).find("[data-overflow-more]").should("contain", "colunas");
    cy.get(nodeSel(SMOKE_NODES.pedido)).find("[data-overflow-more]").click({ force: true });
    cy.get(nodeSel(SMOKE_NODES.pedido)).find(".col-row").should("have.length", 7);
    cy.get(nodeSel(SMOKE_NODES.pedido)).find("[data-overflow-more]").should("not.exist");
  });

  it("G10: screenshot 4 detail levels × 2 themes", () => {
    cy.exec("mkdir -p cypress/screenshots/node-anatomy");
    for (const theme of THEMES) {
      setTheme(theme);
      for (const level of LEVELS) {
        clickPane();
        selectCanvasDetailLevel(level);
        cy.get('[data-testid="detail-level-select"]').should("contain", level);
        captureNode(theme, level);
      }
    }
    for (const theme of THEMES) {
      for (const level of LEVELS) {
        const file = `${theme}-${level.toLowerCase()}.png`;
        cy.readFile(`cypress/screenshots/node-anatomy.cy.ts/${file}`, "binary").then((bin) => {
          cy.writeFile(`cypress/screenshots/node-anatomy/${file}`, bin, "binary");
        });
      }
    }
  });

  it("tooltip on the table name remounts TableInfoPopover after 500ms", () => {
    cy.get(".info-popover").should("not.exist");
    cy.get(nodeSel(SMOKE_NODES.pedido))
      .find('[title="Duplo-clique para renomear a tabela"]')
      .trigger("pointermove", {
        force: true,
        eventConstructor: "PointerEvent",
        pointerType: "mouse",
      });
    cy.get(".info-popover", { timeout: 4000 }).should("exist");
  });
});
