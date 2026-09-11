/** Shared helpers for canvas-*.cy.ts. Not a spec — do not name this `*.cy.ts`. */

export const SMOKE_NODES = {
  cliente: "vendas.cliente",
  pedido: "vendas.pedido",
  item: "vendas.item",
  resumo: "vendas.resumo",
} as const;

export const PEDIDO_COLUMNS = ["id", "cliente_id", "total"] as const;

export function nodeSel(id: string): string {
  return `[data-testid="rf__node-${id}"]`;
}

export function waitForCanvas(): void {
  cy.get(nodeSel(SMOKE_NODES.pedido)).should("be.visible");
  cy.get(".react-flow__viewport")
    .should("have.attr", "style")
    .and("match", /scale\(|matrix\(/);
}

/** Layers panel sits over RF Controls; collapse it so zoom/edge specs can click them. */
export function collapseLayersPanel(): void {
  cy.get(".layers-panel").then(($p) => {
    if (!$p.hasClass("is-collapsed")) {
      cy.wrap($p).find(".layers-panel__collapse").click({ force: true });
    }
  });
  cy.get(".layers-panel").should("have.class", "is-collapsed");
}

export function translateOf(style: string | undefined): { x: number; y: number } {
  const m = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/.exec(style ?? "");
  if (!m) throw new Error(`no translate in style: ${style}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

export function viewportScaleOf(style: string | undefined): number {
  const s = style ?? "";
  const scale = /scale\(\s*([\d.]+)\s*\)/.exec(s);
  if (scale) return Number(scale[1]);
  const matrix = /matrix\(\s*([^)]+)\)/.exec(s);
  if (matrix) {
    const a = Number(matrix[1].split(",")[0]);
    if (!Number.isNaN(a)) return a;
  }
  return 1;
}

export function fireWindowKey(init: KeyboardEventInit): void {
  cy.window().then((win) => {
    win.dispatchEvent(
      new win.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

export function saveViaPaletteShortcut(): void {
  cy.intercept("PUT", "**/api/projects/*").as("saveProject");
  fireWindowKey({ key: "s", code: "KeyS", metaKey: true, ctrlKey: true });
  cy.wait("@saveProject");
}

export type SmokeSnapshot = { id: string; dbml: string; canvas: unknown };

export function smokeProjectId(): Cypress.Chainable<string> {
  return cy.request("GET", "/api/projects").then((res) => {
    const body = res.body as { projects: Array<{ id: string; slug: string }> };
    const proj = body.projects.find((p) => p.slug === "smoke");
    if (!proj) throw new Error('fixture project "smoke" not found');
    return proj.id;
  });
}

export function snapshotSmoke(): Cypress.Chainable<SmokeSnapshot> {
  return smokeProjectId().then((id) =>
    cy.request("GET", `/api/projects/${id}`).then((res) => {
      const body = res.body as { dbml: string; canvas?: unknown };
      const snap: SmokeSnapshot = { id, dbml: body.dbml, canvas: body.canvas ?? {} };
      return snap;
    }),
  );
}

export function restoreSmoke(snap: SmokeSnapshot): void {
  cy.request("PUT", `/api/projects/${snap.id}`, { dbml: snap.dbml, canvas: snap.canvas });
  cy.request("POST", `/api/projects/${snap.id}/activate`);
}

/** Count distinct column-name spans inside a table node (not LOD class names). */
export function assertColumnNameCount(
  nodeId: string,
  names: readonly string[],
  expected: number,
): void {
  cy.get(nodeSel(nodeId)).should(($n) => {
    const found = new Set<string>();
    $n.find("span").each((_, el) => {
      const text = el.textContent?.trim() ?? "";
      if (names.some((n) => n === text)) found.add(text);
    });
    expect(found.size, `column-name rows in ${nodeId}`).to.eq(expected);
  });
}

export function zoomUntil(
  pred: (z: number) => boolean,
  direction: "in" | "out",
  remaining = 16,
): void {
  cy.get(".react-flow__viewport").then(($vp) => {
    const z = viewportScaleOf($vp.attr("style"));
    if (pred(z)) return;
    if (remaining <= 0) {
      throw new Error(`zoom ${direction} stuck at scale ${z}`);
    }
    const btn =
      direction === "out" ? ".react-flow__controls-zoomout" : ".react-flow__controls-zoomin";
    cy.get('[data-testid="rf__controls"]').find(btn).click({ force: true });
    cy.get(".react-flow__viewport").should(($next) => {
      const n = viewportScaleOf($next.attr("style"));
      if (direction === "out") expect(n).to.be.lessThan(z);
      else expect(n).to.be.greaterThan(z);
    });
    zoomUntil(pred, direction, remaining - 1);
  });
}

export function animationNameOf(el: Element): string {
  const win = el.ownerDocument.defaultView;
  if (!win) throw new Error("no view");
  return win.getComputedStyle(el).animationName;
}
