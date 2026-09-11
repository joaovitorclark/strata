export type FixtureProject = "smoke" | "wide" | "large";

declare global {
  namespace Cypress {
    interface Chainable {
      /** Drag a React Flow node by (dx, dy) using mouse events (never pointer*). */
      dragNode(id: string, dx: number, dy: number): Chainable<void>;
      /** Activate a committed fixture project (smoke / wide / large) and visit `/`. */
      seedProject(name: FixtureProject): Chainable<void>;
    }
  }
}

Cypress.Commands.add("dragNode", (id: string, dx: number, dy: number) => {
  cy.get(`[data-testid="rf__node-${id}"]`).then(($n) => {
    const r = $n[0].getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const view = $n[0].ownerDocument.defaultView;
    // Node `transform` is flow coords; mousemove is screen pixels. InitialFit
    // scales the viewport (smoke ~1.58), so unscaled dx would move translate
    // by dx/zoom.
    const vp = $n[0].closest(".react-flow__viewport") as HTMLElement | null;
    const scaleMatch = /scale\(\s*([\d.]+)\s*\)/.exec(vp?.style.transform ?? "");
    const z = scaleMatch ? Number(scaleMatch[1]) : 1;
    const sx = dx * z;
    const sy = dy * z;

    // Real MouseEvent: d3-drag reads event.view.document in nodrag(). Cypress's
    // default Event has no view, which throws and never binds mousemove.
    const mouse = (clientX: number, clientY: number) => ({
      eventConstructor: "MouseEvent",
      button: 0,
      which: 1,
      clientX,
      clientY,
      force: true,
      view,
    });

    // mousedown on the node: d3-drag binds `mousedown.drag` on the element.
    cy.wrap($n).trigger("mousedown", mouse(x, y));

    // move and up on the WINDOW: d3-drag binds those on event.view, in capture
    // phase. cy.window().trigger() is not an EventTarget in Cypress 15
    // (`dispatchEvent is not a function`); native MouseEvent on the view is.
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
      // nodeDragThreshold=4: startDrag latches on the first move and does not
      // apply it. Subsequent moves are relative to that origin, so the starter
      // offset is added into the later client coordinates.
      const startX = x + 8;
      const startY = y + 8;
      fire("mousemove", startX, startY);
      fire("mousemove", startX + sx / 2, startY + sy / 2);
      fire("mousemove", startX + sx, startY + sy);
      fire("mouseup", startX + sx, startY + sy);
    });
  });
});

Cypress.Commands.add("seedProject", (name: FixtureProject) => {
  cy.request("GET", "/api/projects").then((res) => {
    const body = res.body as {
      projects: Array<{ id: string; slug: string }>;
    };
    const proj = body.projects.find((p) => p.slug === name);
    if (!proj) {
      throw new Error(
        `fixture project "${name}" not found — run cypress/fixtures/seed.mjs once and commit the output`,
      );
    }
    cy.request("POST", `/api/projects/${proj.id}/activate`);
    cy.visit("/");
  });
});
