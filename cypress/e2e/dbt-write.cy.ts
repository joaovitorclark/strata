import {
  nodeSel,
  openLayersTab,
  selectCanvasDetailLevel,
  setEdgeVisibility,
} from "./canvas-support";

const DBT_DEMO = "dbt-demo";
const DIM = "gold.dim_cliente";
const FATO = "gold.fato_pedido";

type DomainRow = { id: string; slug: string };
type ProjectRow = { id: string; slug: string };

function visitVendas(): void {
  cy.request("GET", "/api/domains").then((res) => {
    const body = res.body as { domains: DomainRow[] };
    const domain = body.domains.find((d) => d.slug === DBT_DEMO);
    if (!domain) throw new Error(`domain ${DBT_DEMO} not found`);
    cy.request("POST", `/api/domains/${domain.id}/activate`).then(() => {
      cy.request("GET", "/api/projects").then((pres) => {
        const projects = pres.body as { projects: ProjectRow[] };
        const proj = projects.projects.find((p) => p.slug === "vendas");
        if (!proj) throw new Error("project vendas not found");
        cy.request("POST", `/api/projects/${proj.id}/activate`).then(() => {
          cy.request("GET", "/api/project").its("body.format").should("eq", "dbt");
          cy.visit("/");
          cy.get(`[data-testid="rf__node-${DIM}"]`, { timeout: 20000 }).should("exist");
        });
      });
    });
  });
}

function dbtFiles(): Cypress.Chainable<Record<string, string>> {
  return cy.request("GET", "/api/project").then((res) => {
    expect(res.body.format).to.eq("dbt");
    return res.body.files as Record<string, string>;
  });
}

function modelsOnly(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    if (k.startsWith("models/")) out[k] = v;
  }
  return out;
}

function waitPut(): void {
  cy.wait("@dbtPut");
}

function undoOnce(): void {
  cy.window().then((win) => {
    win.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }));
  });
  waitPut();
}

function enableLineageMode(): void {
  openLayersTab();
  cy.get(".layers-panel__lineage-btn").click({ force: true });
  cy.get(".layers-panel__lineage-btn").should("have.class", "is-active");
}

function e2eDataDir(): string {
  const fromEnv = Cypress.env("E2E_DATA_DIR");
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : ".e2e-data";
}

function restoreDbtDemo(): void {
  const root = e2eDataDir();
  cy.exec(
    `rm -rf "${root}/domains/dbt-demo" && mkdir -p "${root}/domains" && cp -R cypress/fixtures/data/domains/dbt-demo "${root}/domains/dbt-demo"`,
  );
}

describe("D2 dbt write", () => {
  beforeEach(() => {
    restoreDbtDemo();
    cy.intercept("PUT", "**/api/projects/*").as("dbtPut");
    visitVendas();
  });

  afterEach(() => {
    cy.request("GET", "/api/domains").then((res) => {
      const body = res.body as { domains: DomainRow[] };
      const domain = body.domains.find((d) => d.slug === "local");
      if (!domain) throw new Error("domain local not found");
      cy.request("POST", `/api/domains/${domain.id}/activate`);
    });
  });

  it("G7: + Tabela writes a new model yml (diff via API)", () => {
    cy.window().then((win) => {
      cy.stub(win, "prompt").returns("gold.g7_tabela");
    });
    dbtFiles().then((before) => {
      cy.contains("button", "+ Tabela").should("not.be.disabled").click();
      waitPut();
      cy.get('[data-testid="rf__node-gold.g7_tabela"]', { timeout: 20000 }).should("exist");
      dbtFiles().then((after) => {
        const yml = after["models/vendas/gold/_g7_tabela.yml"];
        expect(yml, "new model yaml").to.contain("name: g7_tabela");
        expect(before["models/vendas/gold/_g7_tabela.yml"]).to.eq(undefined);
      });
    });
  });

  it("G8: rename column on the node changes only that name: line", () => {
    selectCanvasDetailLevel("Colunas");
    const ymlPath = "models/vendas/gold/_dim_cliente.yml";
    dbtFiles().then((before) => {
      const beforeLines = before[ymlPath].split("\n");
      cy.get(nodeSel(DIM))
        .contains(".col-row span", /^status$/)
        .parents(".col-row")
        .find('[data-testid="col-rename"]')
        .trigger("pointerdown", { force: true, eventConstructor: "PointerEvent" });
      cy.get(nodeSel(DIM)).find("input.col-edit").clear().type("status_g8{enter}");
      waitPut();
      dbtFiles().then((after) => {
        const afterLines = after[ymlPath].split("\n");
        const diffs = afterLines.filter((l, i) => l !== beforeLines[i]);
        expect(diffs.some((l) => l.includes("name: status_g8"))).to.eq(true);
        expect(after[ymlPath]).to.not.contain("name: status\n");
        expect(Object.keys(modelsOnly(after)).sort()).to.deep.eq(
          Object.keys(modelsOnly(before)).sort(),
        );
      });
    });
  });

  it("G9: dragging a relation writes constraints on the FK column", () => {
    selectCanvasDetailLevel("Colunas");
    dbtFiles().then((before) => {
      cy.connectHandles(FATO, "s:total", DIM, "t:id");
      waitPut();
      dbtFiles().then((after) => {
        const yml = after["models/vendas/gold/_fato_pedido.yml"];
        expect(yml).to.contain("foreign_key");
        expect(yml).to.contain("total");
        expect(before["models/vendas/gold/_fato_pedido.yml"]).to.not.eq(yml);
      });
    });
  });

  it("G10: dragging lineage writes config.meta.strata.lineage on the target", () => {
    selectCanvasDetailLevel("Colunas");
    setEdgeVisibility("Linhagem", true);
    enableLineageMode();
    dbtFiles().then((before) => {
      cy.connectHandles(FATO, "fl:s:total", DIM, "fl:t:email");
      waitPut();
      dbtFiles().then((after) => {
        const yml = after["models/vendas/gold/_dim_cliente.yml"];
        expect(yml).to.contain("gold.fato_pedido.total");
        expect(before["models/vendas/gold/_dim_cliente.yml"]).to.not.eq(yml);
      });
    });
  });

  it("G11: moving a table only changes canvas.yml", () => {
    dbtFiles().then((before) => {
      const modelsBefore = modelsOnly(before);
      cy.dragNode(DIM, 80, 40);
      waitPut();
      dbtFiles().then((after) => {
        expect(modelsOnly(after)).to.deep.eq(modelsBefore);
        expect(after[".strata/vendas/canvas.yml"]).to.not.eq(before[".strata/vendas/canvas.yml"]);
        expect(after[".strata/vendas/canvas.yml"]).to.contain("gold.dim_cliente");
      });
    });
  });

  it("G12: undo of + Tabela restores files byte-for-byte", () => {
    cy.window().then((win) => {
      cy.stub(win, "prompt").returns("gold.g12_tabela");
    });
    dbtFiles().then((before) => {
      cy.contains("button", "+ Tabela").click();
      waitPut();
      undoOnce();
      dbtFiles().then((after) => {
        expect(after).to.deep.eq(before);
      });
    });
  });

  it("G12 rename: undo of G8 restores files byte-for-byte", () => {
    selectCanvasDetailLevel("Colunas");
    dbtFiles().then((before) => {
      cy.get(nodeSel(DIM))
        .contains(".col-row span", /^status$/)
        .parents(".col-row")
        .find('[data-testid="col-rename"]')
        .trigger("pointerdown", { force: true, eventConstructor: "PointerEvent" });
      cy.get(nodeSel(DIM)).find("input.col-edit").clear().type("status_g12{enter}");
      waitPut();
      dbtFiles().then((mid) => {
        expect(mid["models/vendas/gold/_dim_cliente.yml"]).to.not.eq(
          before["models/vendas/gold/_dim_cliente.yml"],
        );
        undoOnce();
        dbtFiles().then((after) => {
          expect(after).to.deep.eq(before);
        });
      });
    });
  });

  it("G12 relation: undo of G9 restores files byte-for-byte", () => {
    selectCanvasDetailLevel("Colunas");
    dbtFiles().then((before) => {
      cy.connectHandles(FATO, "s:total", DIM, "t:id");
      waitPut();
      dbtFiles().then((mid) => {
        expect(mid["models/vendas/gold/_fato_pedido.yml"]).to.not.eq(
          before["models/vendas/gold/_fato_pedido.yml"],
        );
        undoOnce();
        dbtFiles().then((after) => {
          expect(after).to.deep.eq(before);
        });
      });
    });
  });

  it("G12 lineage: undo of G10 restores files byte-for-byte", () => {
    selectCanvasDetailLevel("Colunas");
    setEdgeVisibility("Linhagem", true);
    enableLineageMode();
    dbtFiles().then((before) => {
      cy.connectHandles(FATO, "fl:s:total", DIM, "fl:t:email");
      waitPut();
      dbtFiles().then((mid) => {
        expect(mid["models/vendas/gold/_dim_cliente.yml"]).to.not.eq(
          before["models/vendas/gold/_dim_cliente.yml"],
        );
        undoOnce();
        dbtFiles().then((after) => {
          expect(after).to.deep.eq(before);
        });
      });
    });
  });

  it("G12 move: undo of G11 restores files byte-for-byte", () => {
    dbtFiles().then((before) => {
      cy.dragNode(DIM, 80, 40);
      waitPut();
      dbtFiles().then((mid) => {
        expect(mid[".strata/vendas/canvas.yml"]).to.not.eq(before[".strata/vendas/canvas.yml"]);
        undoOnce();
        dbtFiles().then((after) => {
          expect(after).to.deep.eq(before);
        });
      });
    });
  });

  it("G13: delete column without deps toasts undo; with deps dialog cancel writes nothing", () => {
    selectCanvasDetailLevel("Colunas");
    cy.get(nodeSel(DIM)).find('[data-testid="col-add"]').click({ force: true });
    cy.get('[data-testid="col-add-name"]').type("tmp_drop");
    cy.get('[data-testid="col-add-name"]').trigger("keydown", { key: "Tab" });
    cy.get('[data-testid="col-add-type"]').clear().type("string{enter}");
    waitPut();
    dbtFiles().then((afterAdd) => {
      expect(afterAdd["models/vendas/gold/_dim_cliente.yml"]).to.contain("tmp_drop");
      cy.get(nodeSel(DIM))
        .contains(".col-row span", /^tmp_drop$/)
        .parents(".col-row")
        .find('[data-testid="col-delete"]')
        .click({ force: true });
      cy.get('[data-testid="column-deps-dialog"]').should("not.exist");
      cy.contains("Desfazer").should("be.visible");
      waitPut();
      cy.contains("button", "Desfazer").last().click({ force: true });
      waitPut();
      dbtFiles().then((restored) => {
        expect(restored["models/vendas/gold/_dim_cliente.yml"]).to.eq(
          afterAdd["models/vendas/gold/_dim_cliente.yml"],
        );
      });
    });

    dbtFiles().then((beforeDeps) => {
      cy.get(nodeSel(DIM))
        .contains(".col-row span", /^id$/)
        .parents(".col-row")
        .find('[data-testid="col-delete"]')
        .click({ force: true });
      cy.get('[data-testid="column-deps-dialog"]').should("be.visible");
      cy.get('[data-testid="column-deps-cancel"]').click();
      dbtFiles().then((afterCancel) => {
        expect(afterCancel["models/vendas/gold/_dim_cliente.yml"]).to.eq(
          beforeDeps["models/vendas/gold/_dim_cliente.yml"],
        );
      });
    });
  });

  it("G14: + coluna name, Tab, free type struct<a:int>, Enter", () => {
    selectCanvasDetailLevel("Colunas");
    cy.get(nodeSel(DIM)).find('[data-testid="col-add"]').click({ force: true });
    cy.get('[data-testid="col-add-name"]').type("g14_col");
    cy.get('[data-testid="col-add-name"]').trigger("keydown", { key: "Tab" });
    cy.get('[data-testid="col-add-type"]').clear().type("struct<a:int>{enter}");
    waitPut();
    dbtFiles().then((after) => {
      expect(after["models/vendas/gold/_dim_cliente.yml"]).to.match(
        /data_type:\s*["']?struct<a:int>/,
      );
      expect(after["models/vendas/gold/_dim_cliente.yml"]).to.contain("g14_col");
    });
  });

  it("G15: rename to an existing name shows inline error and writes nothing", () => {
    selectCanvasDetailLevel("Colunas");
    dbtFiles().then((before) => {
      cy.get(nodeSel(DIM))
        .contains(".col-row span", /^email$/)
        .parents(".col-row")
        .find('[data-testid="col-rename"]')
        .trigger("pointerdown", { force: true, eventConstructor: "PointerEvent" });
      cy.get(nodeSel(DIM)).find("input.col-edit").clear().type("nome{enter}");
      cy.get('[data-testid="col-rename-error"]').should("be.visible");
      cy.wait(400);
      dbtFiles().then((after) => {
        expect(after["models/vendas/gold/_dim_cliente.yml"]).to.eq(
          before["models/vendas/gold/_dim_cliente.yml"],
        );
      });
    });
  });
});
