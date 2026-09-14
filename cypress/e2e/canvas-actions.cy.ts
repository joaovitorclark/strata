import {
  collapseLayersPanel,
  nodeSel,
  saveViaPaletteShortcut,
  SMOKE_NODES,
  waitForCanvas,
} from "./canvas-support";

/** Same order as `TABLE_COLORS` in `src/features/canvas/tableColors.ts`. */
const TABLE_COLORS = [
  "#c6a0f6",
  "#8aadf4",
  "#a6da95",
  "#eed49f",
  "#f5a97f",
  "#ed8796",
  "#8bd5ca",
  "#91d7e3",
  "#b7bdf8",
  "#f5bde6",
  "#ee99a0",
  "#939ab7",
] as const;

const SWATCH = TABLE_COLORS[0];
const SMOKE_DBML = "cypress/fixtures/data/domains/local/projects/smoke/project.dbml";

const TABLE_GROUP_BLOCK = `TableGroup vendas {
  vendas.cliente
  vendas.pedido
}`;

const EXTRA_CLIENTE_REF = "Ref: vendas.item.id > vendas.cliente.id";

const META_DBML = `Table vendas.cliente {
  id bigint [pk]
  nome string
}

Table vendas.pedido {
  id bigint [pk, note: 'surrogate']
  cliente_id bigint
  total decimal(18,2)
  Note: 'pedidos da loja'
}

Table vendas.item {
  id bigint [pk]
  sku string
}

Table vendas.resumo {
  id bigint [pk]
  total decimal(18,2)
}

Ref: vendas.pedido.cliente_id > vendas.cliente.id

LineageFields {
  vendas.resumo.id < vendas.pedido.id
  vendas.resumo.total < vendas.pedido.total
  vendas.pedido.cliente_id < vendas.cliente.id
}

LayerGroup bronze {
  vendas.cliente
}
LayerGroup prata {
  vendas.pedido
  vendas.item
}
LayerGroup ouro {
  vendas.resumo
}

Records vendas.pedido(id, cliente_id) {
  1, 10
  2, 11
}

Dbt {
  table vendas.pedido {
    resource_type: model
    materialization: incremental
    tags: ['core']
  }
}
`;

type ProjectBody = {
  dbml: string;
  canvas?: {
    sizes?: Record<string, { width?: number; height?: number } | number>;
    positions?: Record<string, { x: number; y: number }>;
  };
};

function colorsBody(dbml: string): string | undefined {
  return /Colors\s*\{([\s\S]*?)\}/.exec(dbml)?.[1];
}

function colorOfKey(dbml: string, key: string): string | undefined {
  const body = colorsBody(dbml);
  if (body == null) return undefined;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^\\s*${escaped}:\\s*(#[0-9a-fA-F]{3,8})\\s*$`, "m").exec(body);
  return m?.[1];
}

function layerBody(dbml: string, name: string): string {
  const m = new RegExp(`LayerGroup\\s+${name}\\b[^{]*\\{([^}]*)\\}`, "i").exec(dbml);
  return m?.[1] ?? "";
}

function layerContains(dbml: string, name: string, tableId: string): boolean {
  return layerBody(dbml, name)
    .split("\n")
    .map((l) => l.trim().replace(/["`]/g, ""))
    .includes(tableId);
}

function layerGroupNames(dbml: string): string[] {
  const names: string[] = [];
  const re = /LayerGroup\s+("?[^"\s[{]+"?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dbml))) names.push(m[1].replace(/"/g, ""));
  return names;
}

function hexToRgb(hex: string): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function putDbml(dbml: string): void {
  cy.request("PUT", "/api/project", { dbml, canvas: {} });
  cy.visit("/");
  waitForCanvas();
  collapseLayersPanel();
}

function putSmokePlus(suffix: string): void {
  cy.readFile(SMOKE_DBML).then((dbml: string) => {
    const next = `${dbml.replace(/\n+$/, "")}\n\n${suffix.replace(/^\n+/, "")}\n`;
    putDbml(next);
  });
}

function putSmokeTransformed(transform: (dbml: string) => string): void {
  cy.readFile(SMOKE_DBML).then((dbml: string) => {
    putDbml(transform(dbml));
  });
}

function expandLayersPanel(): void {
  cy.get('[data-testid="left-panel-layers"]').click({ force: true });
  cy.get(".layers-panel").should("be.visible");
}

function selectTable(id: string): void {
  cy.get(nodeSel(id)).click("top", { force: true });
  cy.get(nodeSel(id)).should("have.class", "selected");
}

function tableTitle(id: string) {
  return cy.get(nodeSel(id)).find('[title="Duplo-clique para renomear a tabela"]');
}

function columnNameSpan(tableId: string, name: string) {
  return cy.get(nodeSel(tableId)).contains(".col-row span", new RegExp(`^${name}$`));
}

function openTableMenu(tableId: string): void {
  cy.get(nodeSel(tableId)).find('[aria-label="Table menu"]').click({ force: true });
  cy.get('[role="menu"]').should("be.visible");
}

function openGroupPalette(): void {
  cy.get('[title="Cor do grupo"]').click({ force: true });
  cy.get(".color-palette--group").should("be.visible");
}

function ensureColumnPanelExpanded(): void {
  cy.get(".column-panel").then(($p) => {
    if ($p.hasClass("is-collapsed")) {
      cy.wrap($p).find('[aria-label="Expandir editor"]').click({ force: true });
    }
  });
  cy.get(".column-panel").should("not.have.class", "is-collapsed");
}

function clickColumn(tableId: string, column: string): void {
  selectTable(tableId);
  columnNameSpan(tableId, column).click({ force: true });
  cy.get(".column-panel").should("be.visible");
  cy.get(".column-panel__col").should("have.text", column);
  cy.get(".column-panel__tbl").should("contain", tableId);
}

function openStatusLog(): void {
  cy.get('[data-testid="status-log"]').click({ force: true });
  cy.get(".status-log__pop").should("be.visible");
}

function tableBlock(dbml: string, tableId: string): string {
  const start = dbml.indexOf(`Table ${tableId} {`);
  if (start < 0) return "";
  const rest = dbml.slice(start);
  const close = rest.indexOf("\n}");
  return close >= 0 ? rest.slice(0, close + 2) : rest;
}

/** Mouse-only resize (d3-drag on NodeResizeControl). Never pointer*. */
function dragResizeHandle(tableId: string, dx: number, dy: number): void {
  cy.get(nodeSel(tableId))
    .find(".react-flow__resize-control.handle.bottom.right")
    .then(($h) => {
      const el = $h[0];
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const view = el.ownerDocument.defaultView;
      const mouse = (clientX: number, clientY: number) => ({
        eventConstructor: "MouseEvent" as const,
        button: 0,
        which: 1,
        clientX,
        clientY,
        force: true,
        view,
      });
      cy.wrap($h).trigger("mousedown", mouse(x, y));
      cy.window().then((win) => {
        const fire = (type: string, clientX: number, clientY: number) => {
          win.dispatchEvent(
            new win.MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: win,
              button: 0,
              clientX,
              clientY,
            }),
          );
        };
        const startX = x + 8;
        const startY = y + 8;
        fire("mousemove", startX, startY);
        fire("mousemove", startX + dx / 2, startY + dy / 2);
        fire("mousemove", startX + dx, startY + dy);
        fire("mouseup", startX + dx, startY + dy);
      });
    });
}

describe("CanvasActions contract", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    collapseLayersPanel();
  });

  it("row 47: clicking a column row opens ColumnPanel for that table+column", () => {
    cy.get(".column-panel").should("not.exist");
    clickColumn(SMOKE_NODES.pedido, "cliente_id");
    cy.get(".column-panel__col").should("have.text", "cliente_id");
    cy.get(".column-panel__tbl").should("have.text", SMOKE_NODES.pedido);
  });

  it("row 48: ColumnPanel rename updates the column in every Ref", () => {
    putSmokePlus(EXTRA_CLIENTE_REF);
    cy.dbmlText().should((before) => {
      expect(before).to.include("Ref: vendas.pedido.cliente_id > vendas.cliente.id");
      expect(before).to.include(EXTRA_CLIENTE_REF);
    });

    clickColumn(SMOKE_NODES.cliente, "id");
    ensureColumnPanelExpanded();
    cy.get("#column-panel-name").type("{selectall}cliente_pk{enter}");
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      const block = tableBlock(after, SMOKE_NODES.cliente);
      expect(block, "definition renamed").to.match(/^\s*cliente_pk\s+/m);
      expect(block).to.not.match(/^\s*id\s+/m);
      expect(after).to.include("Ref: vendas.pedido.cliente_id > vendas.cliente.cliente_pk");
      expect(after).to.include("Ref: vendas.item.id > vendas.cliente.cliente_pk");
      expect(after).to.not.include("vendas.cliente.id");
      expect((after.match(/^\s*Ref:/gm) ?? []).length, "Ref count").to.eq(2);
    });
  });

  it("row 48: duplicate column name is rejected with a status message", () => {
    cy.dbmlText().then((before) => {
      clickColumn(SMOKE_NODES.item, "sku");
      ensureColumnPanelExpanded();
      cy.get("#column-panel-name").type("{selectall}id{enter}");
      openStatusLog();
      cy.get(".status-log__pop").should(
        "contain",
        'Coluna "id" já existe em "vendas.item" — escolha outro nome.',
      );
      saveViaPaletteShortcut();
      cy.dbmlText().should((after) => {
        expect(after, "duplicate left the document unchanged").to.eq(before);
        expect(tableBlock(after, SMOKE_NODES.item)).to.match(/^\s*sku\s+/m);
      });
    });
  });

  it("row 49: ColumnPanel go-to opens the source drawer on that column's line", () => {
    clickColumn(SMOKE_NODES.pedido, "cliente_id");
    ensureColumnPanelExpanded();
    cy.get(".column-panel").contains("button", "Editar no DBML").click();
    cy.get('[data-testid="source-drawer"]').should("be.visible");

    // SourceDrawer returns null for Editor while closed; goToColumn uses a single rAF.
    cy.get(".column-panel").contains("button", "Editar no DBML").click();
    cy.get('[data-testid="source-drawer"] .cm-activeLine').should("contain", "cliente_id");
  });

  it("row 50: renaming a table updates the DBML and migrates canvas ids", () => {
    cy.window().then((w) => {
      cy.stub(w, "prompt").as("promptDlg").returns("vendas.pedido_novo");
    });

    tableTitle(SMOKE_NODES.pedido).dblclick({ force: true });
    cy.get("@promptDlg").should("have.been.called");
    saveViaPaletteShortcut();

    cy.get(nodeSel("vendas.pedido_novo")).should("exist");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("not.exist");

    cy.dbmlText().should((after) => {
      expect(after).to.include("Table vendas.pedido_novo {");
      expect(after).to.not.include("Table vendas.pedido {");
      expect(after).to.include("vendas.pedido_novo.cliente_id");
    });

    cy.request("GET", "/api/project").then((res) => {
      const body = res.body as ProjectBody;
      const positions = body.canvas?.positions ?? {};
      expect(positions["vendas.pedido_novo"], "canvas id migrated").to.exist;
      expect(positions[SMOKE_NODES.pedido], "old canvas id gone").to.eq(undefined);
    });
  });

  it("row 50: duplicate table id is rejected with a status message", () => {
    cy.window().then((w) => {
      cy.stub(w, "prompt").as("promptDlg").returns("vendas.cliente");
    });

    cy.dbmlText().then((before) => {
      tableTitle(SMOKE_NODES.pedido).dblclick({ force: true });
      cy.get("@promptDlg").should("have.been.called");
      openStatusLog();
      cy.get(".status-log__pop").should("contain", 'Tabela "vendas.cliente" já existe');
      cy.get(nodeSel(SMOKE_NODES.pedido)).should("exist");
      saveViaPaletteShortcut();
      cy.dbmlText().should((after) => {
        expect(after, "duplicate left the document unchanged").to.eq(before);
        expect(after).to.include("Table vendas.pedido {");
      });
    });
  });

  it("row 51: Table menu Delete removes the table and its related Ref lines", () => {
    cy.window().then((w) => {
      cy.stub(w, "confirm").as("confirmDlg").returns(true);
    });

    cy.dbmlText().should((before) => {
      expect(before).to.include("Table vendas.pedido {");
      expect((before.match(/^\s*Ref:/gm) ?? []).length).to.eq(1);
    });

    openTableMenu(SMOKE_NODES.pedido);
    cy.get("[role='menu']").contains("[role='menuitem']", "Delete").click();
    cy.get("@confirmDlg").should("have.been.called");
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after).to.not.include("Table vendas.pedido {");
      expect((after.match(/^\s*Ref:/gm) ?? []).length, "related Ref gone").to.eq(0);
      expect(after).to.not.include("vendas.pedido.cliente_id");
      expect(after).to.include("Table vendas.cliente {");
    });
  });

  it('row 52: "+ coluna" appends nova_coluna string in that table', () => {
    selectTable(SMOKE_NODES.item);
    cy.get(nodeSel(SMOKE_NODES.item)).contains("button", "+ coluna").click({ force: true });
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(tableBlock(after, SMOKE_NODES.item)).to.include("nova_coluna string");
      expect(tableBlock(after, SMOKE_NODES.pedido)).to.not.include("nova_coluna string");
    });
  });

  it("row 53: coloured table header colour matches the Colors {} entry", () => {
    putSmokePlus(`Colors {\n  ${SMOKE_NODES.cliente}: ${SWATCH}\n}`);
    cy.dbmlText().should((dbml) => {
      expect(colorOfKey(dbml, SMOKE_NODES.cliente)).to.eq(SWATCH);
    });
  });

  it("row 54: picking then clearing a table colour writes then removes Colors {}", () => {
    cy.dbmlText().should((before) => {
      expect(colorOfKey(before, SMOKE_NODES.cliente)).to.eq(undefined);
    });

    openTableMenu(SMOKE_NODES.cliente);
    cy.get('[role="menu"]').find(`[aria-label="${SWATCH}"]`).click({ force: true });
    saveViaPaletteShortcut();
    cy.dbmlText().should((after) => {
      expect(colorOfKey(after, SMOKE_NODES.cliente)).to.eq(SWATCH);
      expect(TABLE_COLORS as readonly string[]).to.include(SWATCH);
    });

    openTableMenu(SMOKE_NODES.cliente);
    cy.get('[role="menu"]').contains("No colour").click({ force: true });
    saveViaPaletteShortcut();
    cy.dbmlText().should((after) => {
      expect(colorOfKey(after, SMOKE_NODES.cliente), "Colors {} lost the table").to.eq(undefined);
    });
  });

  it("row 55: group colour writes then removes the @group Colors entry", () => {
    putSmokePlus(TABLE_GROUP_BLOCK);
    cy.get('[title="Cor do grupo"]').should("exist");
    cy.dbmlText().should((before) => {
      expect(colorOfKey(before, "@vendas")).to.eq(undefined);
    });

    openGroupPalette();
    cy.get(".color-palette--group .color-palette__row button").first().click({ force: true });
    saveViaPaletteShortcut();
    cy.dbmlText().should((after) => {
      expect(colorOfKey(after, "@vendas")).to.eq(SWATCH);
    });

    openGroupPalette();
    cy.get(".color-palette--group").find('[aria-label="Sem cor"]').click({ force: true });
    saveViaPaletteShortcut();
    cy.dbmlText().should((after) => {
      expect(colorOfKey(after, "@vendas"), "@vendas removed").to.eq(undefined);
    });
  });

  it("row 56: dragging the bottom-right resize handle stores rounded width/height", () => {
    cy.request("GET", "/api/project").then((res) => {
      const before = res.body as ProjectBody;
      const prev = before.canvas?.sizes?.[SMOKE_NODES.pedido];

      selectTable(SMOKE_NODES.pedido);
      dragResizeHandle(SMOKE_NODES.pedido, 120, 80);
      saveViaPaletteShortcut();

      cy.request("GET", "/api/project").then((afterRes) => {
        const after = afterRes.body as ProjectBody;
        const size = after.canvas?.sizes?.[SMOKE_NODES.pedido];
        expect(size, "stored size exists").to.be.an("object");
        const stored = size as { width?: number; height?: number };
        expect(stored.width, "width").to.be.a("number");
        expect(stored.height, "height").to.be.a("number");
        expect(stored.width, "width rounded").to.eq(Math.round(stored.width!));
        expect(stored.height, "height rounded").to.eq(Math.round(stored.height!));
        expect(stored.width, "minWidth").to.be.at.least(200);
        expect(stored.height, "minHeight").to.be.at.least(120);
        if (typeof prev === "object" && prev) {
          const sameW = prev.width === stored.width;
          const sameH = prev.height === stored.height;
          expect(sameW && sameH, "size changed vs previous").to.eq(false);
        }
      });
    });
  });

  it("row 58: a layer chip's colour matches its LayerGroup colour", () => {
    const bronze = TABLE_COLORS[4];
    const prata = TABLE_COLORS[1];
    const ouro = TABLE_COLORS[2];
    putSmokeTransformed((dbml) =>
      dbml
        .replace("LayerGroup bronze {", `LayerGroup bronze [color: ${bronze}] {`)
        .replace("LayerGroup prata {", `LayerGroup prata [color: ${prata}] {`)
        .replace("LayerGroup ouro {", `LayerGroup ouro [color: ${ouro}] {`),
    );
    expandLayersPanel();

    const expectDot = (label: string, hex: string) => {
      cy.contains(".layers-panel__row", label)
        .find(".layer-dot")
        .should(($dot) => {
          const el = $dot[0] as HTMLElement;
          const style = (el.getAttribute("style") ?? "").toLowerCase();
          const bg = el.ownerDocument.defaultView!.getComputedStyle(el).backgroundColor;
          const ok =
            style.includes(hex.toLowerCase()) ||
            bg.replace(/\s/g, "") === hexToRgb(hex).replace(/\s/g, "");
          expect(ok, `${label} chip ${hex} (style=${style} computed=${bg})`).to.eq(true);
        });
    };

    expectDot("Bronze", bronze);
    expectDot("Prata", prata);
    expectDot("Ouro", ouro);
  });

  it("row 59: assigning a layer moves LayerGroup membership", () => {
    cy.dbmlText().should((before) => {
      expect(layerContains(before, "bronze", SMOKE_NODES.cliente)).to.eq(true);
      expect(layerContains(before, "ouro", SMOKE_NODES.cliente)).to.eq(false);
    });

    openTableMenu(SMOKE_NODES.cliente);
    cy.get('[role="menu"]').contains('[role="menuitem"]', "Ouro").click({ force: true });
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(layerContains(after, "bronze", SMOKE_NODES.cliente), "left bronze").to.eq(false);
      expect(layerContains(after, "ouro", SMOKE_NODES.cliente), "joined ouro").to.eq(true);
      expect(layerContains(after, "ouro", SMOKE_NODES.resumo), "resumo stays").to.eq(true);
    });
  });

  it("row 59: No layer clears LayerGroup membership", () => {
    cy.dbmlText().should((before) => {
      expect(layerContains(before, "bronze", SMOKE_NODES.cliente)).to.eq(true);
    });

    openTableMenu(SMOKE_NODES.cliente);
    cy.get('[role="menu"]').contains("No layer").click({ force: true });
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(layerContains(after, "bronze", SMOKE_NODES.cliente)).to.eq(false);
      expect(layerContains(after, "prata", SMOKE_NODES.cliente)).to.eq(false);
      expect(layerContains(after, "ouro", SMOKE_NODES.cliente)).to.eq(false);
    });
  });

  it("row 60: the layer list the node sees matches the LayerGroup blocks", () => {
    putSmokePlus(`LayerGroup lake [color: ${TABLE_COLORS[11]}] {\n}\n`);
    cy.dbmlText().then((dbml) => {
      const groups = layerGroupNames(dbml);
      expect(groups.map((n) => n.toLowerCase())).to.include.members([
        "bronze",
        "prata",
        "ouro",
        "lake",
      ]);

      openTableMenu(SMOKE_NODES.cliente);
      cy.get('[role="menu"] [role="menuitem"]').then(($items) => {
        const texts = [...$items].map((el) => (el.textContent ?? "").trim());
        for (const name of groups) {
          const found = texts.some((t) => t.toLowerCase() === name.toLowerCase());
          expect(found, `table menu lists LayerGroup ${name}`).to.eq(true);
        }
        expect(texts, "No layer still offered").to.include("No layer");
      });
    });
  });

  it("row 61: + camada creates a LayerGroup with that name and colour", () => {
    expandLayersPanel();
    cy.window().then((w) => {
      cy.stub(w, "prompt").as("layerPrompt").returns("lake");
    });

    cy.get(".layers-panel").contains("button", "+ camada").click();
    cy.get("@layerPrompt").should("have.been.called");
    cy.get('.layers-panel [data-pending-layer="lake"]').should("be.visible");
    cy.get(`.layers-panel [data-pending-layer="lake"] button[aria-label="${SWATCH}"]`).click();
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(after).to.match(/LayerGroup\s+lake\s*\[color:\s*#c6a0f6\]/);
      expect(TABLE_COLORS as readonly string[]).to.include(SWATCH);
    });
  });

  it("row 62: collapsing a TableGroup hides member tables; expanding shows them", () => {
    putSmokePlus(TABLE_GROUP_BLOCK);
    cy.get('[data-testid="rf__node-group:vendas"]').should("exist");
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("be.visible");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("be.visible");
    cy.get(nodeSel(SMOKE_NODES.item)).should("be.visible");

    cy.get('[aria-label="Colapsar grupo"]').click({ force: true });
    cy.get(".group-node").should("have.class", "is-collapsed");
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("not.exist");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("not.exist");
    cy.get(nodeSel(SMOKE_NODES.item)).should("be.visible");
    cy.get(nodeSel(SMOKE_NODES.resumo)).should("be.visible");

    cy.get('[aria-label="Expandir grupo"]').click({ force: true });
    cy.get(".group-node").should("not.have.class", "is-collapsed");
    cy.get(nodeSel(SMOKE_NODES.cliente)).should("be.visible");
    cy.get(nodeSel(SMOKE_NODES.pedido)).should("be.visible");
  });

  it("row 63: tableMeta sources, sample, PK/FK, dbt badges and notes match the model", () => {
    putDbml(META_DBML);

    cy.get(nodeSel(SMOKE_NODES.pedido)).click("top", { force: true });
    cy.get('[data-testid="inspector"]').should("contain", "vendas.pedido");
    cy.get('[data-testid="inspector"]').should("contain", "Origens (mapeamentos)");
    cy.get('[data-testid="inspector"]').should("contain", "vendas.cliente");
    cy.get('[data-testid="inspector"]').should("contain", "Exemplo de dados");
    cy.get('[data-testid="inspector"]').should("contain", "id");
    cy.get('[data-testid="inspector"]').should("contain", "cliente_id");
    cy.get('[data-testid="inspector"]').should("contain", "10");
    cy.get('[data-testid="inspector"]').should("contain", "id");
    cy.get('[data-testid="inspector"]').should("contain", "cliente_id");
    cy.get('[data-testid="inspector"]').should("contain", "model");
    cy.get('[data-testid="inspector"]').should("contain", "incremental");
    cy.get('[data-testid="inspector"]').should("contain", "#core");
    cy.get('[data-testid="inspector"]').should("contain", "pedidos da loja");
    cy.get('[data-testid="inspector"]').should("contain", "surrogate");

    cy.get(nodeSel(SMOKE_NODES.cliente)).click("top", { force: true });
    cy.get('[data-testid="inspector"]').should("contain", "referenciada por");
    cy.get('[data-testid="inspector"]').should("contain", "vendas.pedido");
  });
});
