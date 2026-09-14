import type { HeightSample, LodState } from "./heightSample";

export type { HeightSample, LodState } from "./heightSample";

export type HeightRow = {
  id: string;
  state: LodState;
  density: HeightSample["density"];
  offsetHeight: number;
  predicted: number;
  delta: number;
};

export function restoreSmoke(): void {
  cy.request("GET", "/api/projects").then((res) => {
    const body = res.body as { projects: Array<{ id: string; slug: string }> };
    const smoke = body.projects.find((p) => p.slug === "smoke");
    if (!smoke) throw new Error('fixture project "smoke" not found');
    cy.request("POST", `/api/projects/${smoke.id}/activate`);
  });
}

export function readScale(el: HTMLElement): number {
  const t = el.style.transform ?? "";
  const m = /scale\(\s*([\d.]+)\s*\)/.exec(t);
  return m ? Number(m[1]) : 1;
}

export function viewportScale(): Cypress.Chainable<number> {
  return cy.get(".react-flow__viewport").then(($vp) => readScale($vp[0] as HTMLElement));
}

function zoomButton(dir: "in" | "out"): string {
  const zoom = dir === "in" ? "in" : "out";
  return `[data-testid="canvas-toolbar"] [data-zoom="${zoom}"]`;
}

/** Layers panel sits in the left tab (S02); no overlay over the canvas. */
export function collapseLayersPanel(): void {
  /* no-op */
}

/** Click RF Controls until viewport scale is in [min, max] (inclusive). */
export function zoomToRange(min: number, max: number): void {
  collapseLayersPanel();
  const step = (n: number) => {
    cy.get(".react-flow__viewport").then(($vp) => {
      const z = readScale($vp[0] as HTMLElement);
      if (z >= min && z <= max) return;
      if (n >= 28) {
        throw new Error(`zoom ${z} not in [${min}, ${max}] after ${n} control clicks`);
      }
      const dir: "in" | "out" = z > max ? "out" : "in";
      cy.get(zoomButton(dir)).click({ force: true });
      cy.get(".react-flow__viewport").should(($after) => {
        const next = readScale($after[0] as HTMLElement);
        expect(next, "viewport scale after zoom click").to.be.a("number");
      });
      step(n + 1);
    });
  };
  step(0);
}

export function selectCanvasDetailLevel(
  label: "Nome" | "Chaves" | "Colunas" | "Documentação",
): void {
  cy.get("body").type("{esc}");
  cy.get('[role="menuitemradio"]').should("not.exist");
  cy.get('[data-testid="detail-level-select"]').click({ force: true });
  cy.get('[role="menuitemradio"]').contains(label).click({ force: true });
  cy.get('[role="menuitemradio"]').should("not.exist");
  cy.get('[data-testid="detail-level-select"]').should("contain", label);
}

export function clickPane(): void {
  cy.get(".react-flow__pane").click(20, 20, { force: true });
}

/**
 * Pan the RF pane with mouse events (never pointer*).
 * Canvas sets `selectionOnDrag`, so xyflow pans on middle/right, not left.
 */
export function panCanvas(dx: number, dy: number): void {
  cy.get(".react-flow__pane").then(($pane) => {
    const r = $pane[0].getBoundingClientRect();
    const x = r.left + 48;
    const y = r.top + 48;
    const view = $pane[0].ownerDocument.defaultView;
    cy.wrap($pane).trigger("mousedown", {
      eventConstructor: "MouseEvent",
      button: 1,
      which: 2,
      buttons: 4,
      clientX: x,
      clientY: y,
      force: true,
      view,
    });
    cy.window().then((win) => {
      const fire = (type: string, clientX: number, clientY: number, buttons: number) => {
        win.dispatchEvent(
          new win.MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: win,
            button: 1,
            buttons,
            clientX,
            clientY,
          }),
        );
      };
      fire("mousemove", x + 8, y + 8, 4);
      fire("mousemove", x + dx, y + dy, 4);
      fire("mouseup", x + dx, y + dy, 0);
    });
  });
}

export function translateOf(style: string | undefined): { x: number; y: number } {
  const m = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/.exec(style ?? "");
  if (!m) throw new Error(`no translate in style: ${style}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

function col(name: string, type: string, pk = false) {
  return { name, type, pk, notNull: false };
}

export function wideHubTable(): HeightSample["table"] {
  const columns = [col("id", "bigint", true)];
  for (let i = 2; i <= 187; i += 1) {
    columns.push(col(`c${String(i).padStart(3, "0")}`, "int"));
  }
  return {
    id: "wide.hub",
    name: "hub",
    schema: "wide",
    columns,
    meta: { pks: ["id"], fks: [] },
  };
}

export function wideLeftTable(): HeightSample["table"] {
  return {
    id: "wide.left",
    name: "left",
    schema: "wide",
    columns: [col("id", "bigint", true), col("hub_id", "bigint")],
    meta: { pks: ["id"], fks: [{ column: "hub_id", ref: "wide.hub.id" }] },
  };
}

export function wideRightTable(): HeightSample["table"] {
  return {
    id: "wide.right",
    name: "right",
    schema: "wide",
    columns: [col("id", "bigint", true), col("hub_id", "bigint")],
    meta: { pks: ["id"], fks: [{ column: "hub_id", ref: "wide.hub.id" }] },
  };
}

const TABLES: Record<string, HeightSample["table"]> = {
  "wide.hub": wideHubTable(),
  "wide.left": wideLeftTable(),
  "wide.right": wideRightTable(),
};

export function heightSamples(
  ids: string[],
  states: LodState[],
  density: HeightSample["density"] = "cozy",
): HeightSample[] {
  return ids.flatMap((id) =>
    states.map((state) => {
      const table = TABLES[id];
      if (!table) throw new Error(`no fixture table builder for ${id}`);
      return { id, state, table, density };
    }),
  );
}

export function ensureHubFull(): void {
  const hub = '[data-testid="rf__node-wide.hub"]';
  cy.get(hub).then(($n) => {
    if ($n.find('input[aria-label="Filter columns"]').length) return;
    if (/more columns/.test($n.text() ?? "")) {
      cy.get(hub)
        .contains("button", /more columns/)
        .click({ force: true });
      return;
    }
    selectCanvasDetailLevel("Colunas");
  });
  cy.get(`${hub} input[aria-label="Filter columns"]`).should("exist");
}

export function pathEndScreen(path: SVGPathElement): { x: number; y: number } {
  const len = path.getTotalLength();
  const pt = path.getPointAtLength(len);
  const ctm = path.getScreenCTM();
  if (!ctm) throw new Error("edge path has no screen CTM");
  return {
    x: ctm.a * pt.x + ctm.c * pt.y + ctm.e,
    y: ctm.b * pt.x + ctm.d * pt.y + ctm.f,
  };
}
