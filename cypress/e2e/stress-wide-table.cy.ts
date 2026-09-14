import {
  COLUMN_VIRTUAL_VIEW_ROWS,
  COLUMN_VIRTUALIZE_THRESHOLD,
} from "../../src/features/canvas/utils/scaleLimits";
import { collapseLayersPanel, ensureHubFull, pathEndScreen, restoreSmoke } from "../support/stress";

/** TableColumnList uses overscan 5 (scaleLimits.COLUMN_VIRTUAL_OVERSCAN is 3). */
const LIST_OVERSCAN = 5;

describe("stress wide table", () => {
  beforeEach(() => {
    cy.seedProject("wide");
    cy.get('[data-testid="rf__node-wide.hub"]').should("exist");
    collapseLayersPanel();
    ensureHubFull();
  });

  after(() => {
    restoreSmoke();
  });

  it("virtualises the 187-column hub to a window near COLUMN_VIRTUAL_VIEW_ROWS", () => {
    cy.get('[data-testid="rf__node-wide.hub"]').then(($hub) => {
      const rendered = $hub.find('[data-handleid^="t:"]').length;
      const cap = COLUMN_VIRTUAL_VIEW_ROWS + 2 * LIST_OVERSCAN;
      expect(rendered, "virtualised row count").to.be.at.most(cap);
      expect(rendered, "must not paint all 187 columns").to.be.below(COLUMN_VIRTUALIZE_THRESHOLD);
      expect(rendered, "window is occupied").to.be.at.least(COLUMN_VIRTUAL_VIEW_ROWS - 4);
      expect($hub.find(".overflow-y-auto").length, "scroll viewport").to.eq(1);
    });
  });

  it("G10: 187-col hub in Colunas still virtualized (≤ 30 .col-row)", () => {
    cy.get('[data-testid="rf__node-wide.hub"]').then(($hub) => {
      expect($hub.find(".col-row").length, "virtualised .col-row").to.be.at.most(30);
    });
  });

  it("narrows the in-node filter with c18 (fixture has no _at columns)", () => {
    // Plan example `_at` does not match the committed wide fixture (id + c002…c187, all int).
    cy.get('[data-testid="rf__node-wide.hub"] input[aria-label="Filter columns"]')
      .click({ force: true })
      .clear({ force: true })
      .type("c18", { force: true });
    cy.get('[data-testid="rf__node-wide.hub"]').should(($hub) => {
      const names = [...$hub.find('[data-handleid^="t:"]')].map(
        (el) => el.getAttribute("data-handleid")?.slice(2) ?? "",
      );
      expect(names.length, "filtered rows").to.be.greaterThan(0);
      expect(names.length, "filter drops the 187-column list").to.be.below(20);
      for (const name of names) {
        expect(name.toLowerCase()).to.include("c18");
      }
      expect(names).to.include("c187");
      expect(names).to.not.include("c002");
      // c018 matches the filter but sits at the top of the 9-hit list; the
      // hub's painted window is ~8 rows, so it is not in the DOM. Do not
      // require it — the filter is already proven by c180–c187 / ¬c002.
    });
  });

  it("scrolls a connected edge to the column viewport edge instead of outside the node", () => {
    // Prefix selector: the id contains `->`. Re-query each time — scrolling a
    // virtualised handle out of the window unmounts the RF edge (alias goes stale).
    const edgeSel = '[data-testid^="rf__edge-wide.left"]';
    cy.get(edgeSel).should("have.length.at.least", 1);

    const measure = () =>
      cy.get(edgeSel).then(($edge) => {
        const paths = [...$edge.find("path")];
        const path = paths.find((el) => {
          const p = el as unknown as SVGPathElement;
          return Boolean(p.getAttribute("d") && p.getTotalLength() > 0);
        }) as unknown as SVGPathElement | undefined;
        if (!path) throw new Error("FK edge path not found");
        const end = pathEndScreen(path);
        return cy.get('[data-testid="rf__node-wide.hub"]').then(($hub) => {
          const box = $hub[0].getBoundingClientRect();
          return { end, box };
        });
      });

    measure().then((before) => {
      // 80px ≈ 3 rows: enough to move the clamp, inside overscan 5 so `t:id` stays mounted.
      cy.get('[data-testid="rf__node-wide.hub"] .overflow-y-auto').scrollTo(0, 80);
      cy.wait(150);
      measure().then((after) => {
        expect(after.end.y, "target stays inside the hub node (not drifted out)").to.be.at.least(
          after.box.top - 2,
        );
        expect(after.end.y, "target stays above the hub footer").to.be.at.most(
          after.box.bottom + 2,
        );
        expect(
          Math.abs(after.end.y - before.end.y),
          "scrolling hub.id out of view moves the clamped endpoint",
        ).to.be.at.least(2);
        // kind `above`: clamped near the column-viewport top, not the node bottom
        const mid = (after.box.top + after.box.bottom) / 2;
        expect(after.end.y, "above-kind clamp is the top edge").to.be.below(mid);
      });
    });
  });
});
