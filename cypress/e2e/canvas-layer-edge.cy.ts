import { nodeSel, SMOKE_NODES, waitForCanvas } from "./canvas-support";

const LAYER_BY_NODE: Record<string, { cls: string; token: string }> = {
  [SMOKE_NODES.cliente]: { cls: "bg-layer-bronze", token: "--layer-bronze" },
  [SMOKE_NODES.pedido]: { cls: "bg-layer-silver", token: "--layer-silver" },
  [SMOKE_NODES.item]: { cls: "bg-layer-silver", token: "--layer-silver" },
  [SMOKE_NODES.resumo]: { cls: "bg-layer-gold", token: "--layer-gold" },
};

describe("canvas layer edge", () => {
  beforeEach(() => {
    cy.seedProject("smoke");
    waitForCanvas();
  });

  it("each node's 3px left edge resolves to its medallion layer token", () => {
    for (const [id, { cls, token }] of Object.entries(LAYER_BY_NODE)) {
      cy.get(nodeSel(id))
        .find(`[aria-hidden].${cls}`)
        .should(($bars) => {
          const win = $bars[0]?.ownerDocument.defaultView;
          if (!win) throw new Error("no view");
          const bar = [...$bars].find((el) => win.getComputedStyle(el).width === "3px");
          expect(bar, `${id} 3px layer edge`).to.exist;
          const probe = win.document.createElement("div");
          probe.style.backgroundColor = `hsl(var(${token}))`;
          win.document.body.appendChild(probe);
          const expected = win.getComputedStyle(probe).backgroundColor;
          probe.remove();
          expect(win.getComputedStyle(bar!).backgroundColor, `${id} ${token}`).to.eq(expected);
        });
    }
  });
});
