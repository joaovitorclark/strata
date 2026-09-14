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

export function waitForInitialFit(): void {
  cy.get(".react-flow__viewport").should(($v) => {
    const style = $v.attr("style") ?? "";
    const z = viewportScaleOf(style);
    const t = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/.exec(style);
    const moved = t != null && (Number(t[1]) !== 0 || Number(t[2]) !== 0);
    const identityMatrix =
      /matrix\(\s*1(?:\.0+)?,\s*0(?:\.0+)?,\s*0(?:\.0+)?,\s*1(?:\.0+)?,\s*0(?:\.0+)?,\s*0(?:\.0+)?\s*\)/.test(
        style,
      );
    expect(z !== 1 || moved, "initial fit applied").to.eq(true);
    expect(identityMatrix, "viewport still identity matrix").to.eq(false);
  });
}

/** Layers panel sits in the left tab (S02); kept as a no-op so callers stay valid. */
export function collapseLayersPanel(): void {
  /* overlays no longer cover React Flow controls */
}

export function openLayersTab(): void {
  cy.get('[data-testid="left-panel-layers"]').click({ force: true });
  cy.get(".layers-panel").should("be.visible");
}

export function setEdgeVisibility(kind: "Relações" | "Linhagem", on: boolean): void {
  cy.get('[data-testid="edge-visibility"]').click();
  cy.get('[role="menuitemcheckbox"]')
    .contains(kind)
    .then(($item) => {
      const checked =
        $item.attr("data-state") === "checked" || $item.attr("aria-checked") === "true";
      if (checked !== on) cy.wrap($item).click();
      else cy.get("body").type("{esc}");
    });
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

/**
 * Left-button rubber-band over the union of the given nodes.
 * Relies on `selectionOnDrag && panOnDrag !== true` (xyflow Pane uses pointer capture).
 * Guard: `canvas-rubber-band.cy.ts` forces panOnDrag true and expects zero `.selected`.
 */
export function rubberBandCovering(ids: readonly string[]): void {
  for (const id of ids) {
    cy.get(nodeSel(id)).should("exist");
  }
  cy.get(".react-flow__pane").then(($pane) => {
    const el = $pane[0];
    const win = el.ownerDocument.defaultView!;
    const pane = el.getBoundingClientRect();
    const rects = ids.map((id) => {
      const node = el.ownerDocument.querySelector(nodeSel(id));
      if (!node) throw new Error(`missing node ${id}`);
      return node.getBoundingClientRect();
    });
    const x1 = Math.max(pane.left + 4, Math.min(...rects.map((r) => r.left)) - 16);
    const y1 = Math.max(pane.top + 4, Math.min(...rects.map((r) => r.top)) - 16);
    const x2 = Math.min(pane.right - 4, Math.max(...rects.map((r) => r.right)) + 16);
    const y2 = Math.min(pane.bottom - 4, Math.max(...rects.map((r) => r.bottom)) + 16);
    const pe = (type: string, clientX: number, clientY: number, buttons: number) =>
      new win.PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: win,
        button: 0,
        buttons,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        clientX,
        clientY,
      });
    el.dispatchEvent(pe("pointerdown", x1, y1, 1));
    el.dispatchEvent(pe("pointermove", x1 + 12, y1 + 12, 1));
    el.dispatchEvent(pe("pointermove", x2, y2, 1));
    el.dispatchEvent(pe("pointerup", x2, y2, 0));
  });
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
  if (remaining === 16) waitForInitialFit();
  cy.get(".react-flow__viewport").then(($vp) => {
    const z = viewportScaleOf($vp.attr("style"));
    if (pred(z)) return;
    if (remaining <= 0) {
      throw new Error(`zoom ${direction} stuck at scale ${z}`);
    }
    const btn =
      direction === "out"
        ? '[data-testid="canvas-toolbar"] [data-zoom="out"]'
        : '[data-testid="canvas-toolbar"] [data-zoom="in"]';
    cy.get(btn).click({ force: true });
    // S03: zoomIn/Out tween 150ms (scaleBy 1.2). Wait for the step to mostly
    // settle — a 1px change used to pass with duration 0 and then the next
    // click cancelled the d3 interpolate.
    cy.get(".react-flow__viewport").should(($next) => {
      const n = viewportScaleOf($next.attr("style"));
      if (direction === "out") expect(n).to.be.lessThan(z * 0.86);
      else expect(n).to.be.greaterThan(z * 1.14);
    });
    zoomUntil(pred, direction, remaining - 1);
  });
}

export function animationNameOf(el: Element): string {
  const win = el.ownerDocument.defaultView;
  if (!win) throw new Error("no view");
  return win.getComputedStyle(el).animationName;
}
