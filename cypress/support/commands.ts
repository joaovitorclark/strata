function visitApp(): void {
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.removeItem("strata.detailLevel");
    },
  });
}

export type FixtureProject = "smoke" | "wide" | "large";

declare global {
  namespace Cypress {
    interface Chainable {
      /** Drag a React Flow node by (dx, dy) using mouse events (never pointer*). */
      dragNode(id: string, dx: number, dy: number): Chainable<void>;
      /** Activate a committed fixture project (smoke / wide / large) and visit `/`. */
      seedProject(name: FixtureProject): Chainable<void>;
      /** Re-seed, restore committed DBML+canvas, reload. Built on seedProject. */
      resetFixture(name: FixtureProject): Chainable<void>;
      /** Persisted document of the active project (`GET /api/project`). */
      dbmlText(): Chainable<string>;
      /** Connect two column handles with mouse events (never pointer*). */
      connectHandles(
        fromNode: string,
        fromHandle: string,
        toNode: string,
        toHandle: string,
      ): Chainable<void>;
      /**
       * Drag a relation-edge updater onto another column handle (never pointer*).
       * `which` is the end being moved: RF `.react-flow__edgeupdater-source|target`.
       */
      reconnectHandle(
        which: "source" | "target",
        toNode: string,
        toHandle: string,
      ): Chainable<void>;
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
    visitApp();
  });
});

Cypress.Commands.add("dbmlText", () => {
  return cy
    .request("GET", "/api/project")
    .then((res) => res.body?.dbml ?? "")
    .then((t: string) => t as unknown as Cypress.Chainable<string>);
});

Cypress.Commands.add("resetFixture", (name: FixtureProject) => {
  // Same activate as seedProject, then restore bytes, then a single visit.
  // seedProject+reload loaded the SPA twice and left tests stuck on "Carregando…".
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
  });
  cy.readFile(`cypress/fixtures/data/domains/local/projects/${name}/project.dbml`).then((dbml) => {
    cy.readFile(`cypress/fixtures/data/domains/local/projects/${name}/canvas.json`).then(
      (canvas) => {
        cy.request("PUT", "/api/project", { dbml, canvas });
        cy.request("GET", "/api/project").then((res) => {
          expect(res.body?.dbml, "resetFixture wrote the committed DBML").to.eq(dbml);
        });
      },
    );
  });
  visitApp();
});

Cypress.Commands.add(
  "connectHandles",
  (fromNode: string, fromHandle: string, toNode: string, toHandle: string) => {
    const sel = (n: string, h: string) => `[data-nodeid="${n}"][data-handleid="${h}"]`;

    cy.get(sel(fromNode, fromHandle)).then(($src) => {
      const s = $src[0].getBoundingClientRect();
      const sx = s.left + s.width / 2;
      const sy = s.top + s.height / 2;

      cy.get(sel(toNode, toHandle)).then(($dst) => {
        const d = $dst[0].getBoundingClientRect();
        const dx = d.left + d.width / 2;
        const dy = d.top + d.height / 2;

        // Start on the handle: React Flow binds this through the Handle's
        // onMouseDown prop.
        cy.wrap($src).trigger("mousedown", { button: 0, clientX: sx, clientY: sy, force: true });

        // Move on the document: React Flow registers mousemove/mouseup there,
        // not on the handle. Two moves — the first opens the connection, the
        // second positions it over the target.
        cy.document()
          .trigger("mousemove", { clientX: (sx + dx) / 2, clientY: (sy + dy) / 2, force: true })
          .trigger("mousemove", { clientX: dx, clientY: dy, force: true });

        // Release over the target handle. The drop target is resolved from the
        // element under these coordinates, so they must be the target's centre.
        cy.wrap($dst).trigger("mouseup", { clientX: dx, clientY: dy, force: true });
      });
    });
  },
);

Cypress.Commands.add(
  "reconnectHandle",
  (which: "source" | "target", toNode: string, toHandle: string) => {
    const dstSel = `[data-nodeid="${toNode}"][data-handleid="${toHandle}"]`;

    // EdgeAnchor (xyflow EdgeUpdateAnchors): onMouseDown → onReconnectSourceMouseDown /
    // onReconnectTargetMouseDown. XYHandle.onPointerDown then binds mousemove/mouseup
    // on the document (never pointer*).
    cy.get(".edge-path--fk")
      .should("have.length", 1)
      .closest("[data-testid^='rf__edge-']")
      .find(`.react-flow__edgeupdater-${which}`)
      .then(($upd) => {
        const u = $upd[0].getBoundingClientRect();
        const ux = u.left + u.width / 2;
        const uy = u.top + u.height / 2;

        cy.get(dstSel).then(($dst) => {
          const d = $dst[0].getBoundingClientRect();
          const dx = d.left + d.width / 2;
          const dy = d.top + d.height / 2;

          cy.wrap($upd).trigger("mousedown", { button: 0, clientX: ux, clientY: uy, force: true });

          cy.document()
            .trigger("mousemove", { clientX: (ux + dx) / 2, clientY: (uy + dy) / 2, force: true })
            .trigger("mousemove", { clientX: dx, clientY: dy, force: true });

          cy.wrap($dst).trigger("mouseup", { clientX: dx, clientY: dy, force: true });
        });
      });
  },
);
