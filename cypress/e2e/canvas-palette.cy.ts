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
const TABLE = SMOKE_NODES.cliente;
const SMOKE_DBML = "cypress/fixtures/data/domains/local/projects/smoke/project.dbml";

const TABLE_GROUP_BLOCK = `TableGroup vendas {
  vendas.cliente
  vendas.pedido
}`;

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

function putSmokePlus(suffix: string): void {
  cy.readFile(SMOKE_DBML).then((dbml: string) => {
    const next = `${dbml.replace(/\n+$/, "")}\n\n${suffix.replace(/^\n+/, "")}\n`;
    cy.request("PUT", "/api/project", { dbml: next, canvas: {} });
  });
  cy.visit("/");
  waitForCanvas();
  collapseLayersPanel();
}

function openTableMenu(tableId: string): void {
  cy.get(nodeSel(tableId)).find('[aria-label="Table menu"]').click({ force: true });
  cy.get('[role="menu"]').should("be.visible");
  cy.get('[role="menu"]').contains("Colour").should("be.visible");
}

function openGroupPalette(): void {
  cy.get('[title="Cor do grupo"]').click({ force: true });
  cy.get(".color-palette--group").should("be.visible");
}

describe("canvas colour and layer palette", () => {
  beforeEach(() => {
    cy.resetFixture("smoke");
    waitForCanvas();
    collapseLayersPanel();
  });

  it("row 80: Table menu opens the colour/layer palette", () => {
    openTableMenu(TABLE);
    cy.get('[role="menu"]').then(($menu) => {
      for (const hex of TABLE_COLORS) {
        expect($menu.find(`[aria-label="${hex}"]`).length, `swatch ${hex}`).to.be.greaterThan(0);
      }
    });
    cy.get('[role="menu"]').contains("No colour").should("be.visible");
    cy.get('[role="menu"]').contains("Layer").should("be.visible");
  });

  it("row 81: picking a swatch writes Colors { table: hex }", () => {
    cy.dbmlText().should((before) => {
      expect(colorOfKey(before, TABLE), "fixture has no table colour").to.eq(undefined);
    });

    openTableMenu(TABLE);
    cy.get('[role="menu"]').find(`[aria-label="${SWATCH}"]`).click({ force: true });
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      const hex = colorOfKey(after, TABLE);
      expect(hex, "Colors {} gained the table").to.eq(SWATCH);
      expect(TABLE_COLORS as readonly string[], "hex is a palette swatch").to.include(hex);
    });
  });

  it("row 82: No colour removes the Colors entry", () => {
    putSmokePlus(`Colors {\n  ${TABLE}: ${SWATCH}\n}`);
    cy.dbmlText().should((before) => {
      expect(colorOfKey(before, TABLE)).to.eq(SWATCH);
      expect(layerContains(before, "bronze", TABLE)).to.eq(true);
    });

    openTableMenu(TABLE);
    cy.get('[role="menu"]').contains("No colour").click({ force: true });
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(colorOfKey(after, TABLE), "Colors {} lost the table").to.eq(undefined);
      expect(layerContains(after, "bronze", TABLE), "still in bronze").to.eq(true);
    });
    cy.get(nodeSel(TABLE)).find("[aria-hidden].bg-layer-bronze").should("exist");
  });

  it("row 83: picking a layer moves LayerGroup membership", () => {
    cy.dbmlText().should((before) => {
      expect(layerContains(before, "bronze", TABLE)).to.eq(true);
      expect(layerContains(before, "ouro", TABLE)).to.eq(false);
      expect(layerContains(before, "ouro", SMOKE_NODES.resumo)).to.eq(true);
    });

    openTableMenu(TABLE);
    cy.get('[role="menu"]').contains('[role="menuitem"]', "Ouro").click({ force: true });
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(layerContains(after, "bronze", TABLE), "left bronze").to.eq(false);
      expect(layerContains(after, "ouro", TABLE), "joined ouro").to.eq(true);
      expect(layerContains(after, "ouro", SMOKE_NODES.resumo), "resumo stays").to.eq(true);
      expect(layerContains(after, "prata", SMOKE_NODES.pedido)).to.eq(true);
    });
  });

  it("row 84: No layer clears LayerGroup membership", () => {
    cy.dbmlText().should((before) => {
      expect(layerContains(before, "bronze", TABLE)).to.eq(true);
    });

    openTableMenu(TABLE);
    cy.get('[role="menu"]').contains("No layer").click({ force: true });
    saveViaPaletteShortcut();

    cy.dbmlText().should((after) => {
      expect(layerContains(after, "bronze", TABLE)).to.eq(false);
      expect(layerContains(after, "prata", TABLE)).to.eq(false);
      expect(layerContains(after, "ouro", TABLE)).to.eq(false);
    });
  });

  describe("TableGroup colour", () => {
    it("row 90: group palette swatch writes Colors { @group: hex }", () => {
      putSmokePlus(TABLE_GROUP_BLOCK);
      cy.get('[title="Cor do grupo"]').should("exist");
      cy.dbmlText().should((before) => {
        expect(colorOfKey(before, "@vendas")).to.eq(undefined);
      });

      openGroupPalette();
      cy.get(".color-palette--group .color-palette__row button").first().click({ force: true });
      saveViaPaletteShortcut();

      cy.dbmlText().should((after) => {
        const hex = colorOfKey(after, "@vendas");
        expect(hex, "Colors {} gained @vendas").to.eq(SWATCH);
        expect(TABLE_COLORS as readonly string[]).to.include(hex);
      });
    });

    it("row 91: Sem cor removes the @group Colors entry", () => {
      putSmokePlus(`${TABLE_GROUP_BLOCK}\n\nColors {\n  @vendas: ${SWATCH}\n}`);
      cy.get('[title="Cor do grupo"]').should("exist");
      cy.dbmlText().should((before) => {
        expect(colorOfKey(before, "@vendas")).to.eq(SWATCH);
      });

      openGroupPalette();
      cy.get(".color-palette--group").find('[aria-label="Sem cor"]').click({ force: true });
      saveViaPaletteShortcut();

      cy.dbmlText().should((after) => {
        expect(colorOfKey(after, "@vendas"), "@vendas removed").to.eq(undefined);
      });
    });
  });
});
