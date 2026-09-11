import {
  restoreSmoke,
  saveViaPaletteShortcut,
  snapshotSmoke,
  SMOKE_NODES,
  nodeSel,
  translateOf,
  waitForCanvas,
  type SmokeSnapshot,
} from "./canvas-support";

describe("canvas drag persist", () => {
  let snap: SmokeSnapshot | undefined;

  beforeEach(() => {
    cy.seedProject("smoke");
    waitForCanvas();
    snapshotSmoke().then((s) => {
      snap = s;
    });
  });

  afterEach(() => {
    if (snap) restoreSmoke(snap);
  });

  it("dragNode position survives Cmd+S and reload", () => {
    const id = SMOKE_NODES.pedido;
    const sel = nodeSel(id);

    cy.get(sel).then(($n) => {
      const before = translateOf($n.attr("style"));
      cy.dragNode(id, 120, 80);
      cy.get(sel).should(($after) => {
        const a = translateOf($after.attr("style"));
        expect(a.x).to.be.closeTo(before.x + 120, 4);
        expect(a.y).to.be.closeTo(before.y + 80, 4);
      });
    });

    cy.get(sel)
      .invoke("attr", "style")
      .then((style) => {
        const moved = translateOf(style);
        saveViaPaletteShortcut();
        cy.reload();
        waitForCanvas();
        cy.get(sel).should(($n) => {
          const again = translateOf($n.attr("style"));
          expect(again.x).to.be.closeTo(moved.x, 4);
          expect(again.y).to.be.closeTo(moved.y, 4);
        });
      });
  });
});
