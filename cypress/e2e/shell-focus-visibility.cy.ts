const CHROME_BUTTONS =
  '[data-testid="navbar"] button, [data-testid="icon-rail"] button, [data-testid="status-bar"] button';

function inChrome(el: Element | null): boolean {
  return !!el?.closest(
    '[data-testid="navbar"], [data-testid="icon-rail"], [data-testid="status-bar"]',
  );
}

function assertVisibleFocusRing(el: HTMLElement) {
  const win = el.ownerDocument.defaultView;
  if (!win) throw new Error("no window");
  const cs = win.getComputedStyle(el);
  const outlineVisible = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
  const shadow = cs.boxShadow || "";
  const shadowVisible =
    shadow !== "none" &&
    shadow !== "" &&
    !/^0px 0px 0px(?: 0px)?(?: transparent)?$/.test(shadow) &&
    shadow.split(",").some((part) => /(rgb|hsl|#|var\()/.test(part));
  const focusVisible = typeof el.matches === "function" && el.matches(":focus-visible");
  const label = el.getAttribute("aria-label") || el.textContent?.trim()?.slice(0, 40) || el.tagName;
  expect(
    outlineVisible || shadowVisible || focusVisible,
    `visible focus ring on "${label}" (shadow=${shadow})`,
  ).to.eq(true);
}

describe("shell focus visibility", () => {
  beforeEach(() => {
    cy.intercept("PUT", "/api/projects/**", { body: { ok: true } });
    cy.seedProject("smoke");
    cy.get('[data-testid="navbar"]').should("exist");
    cy.get('[data-testid="icon-rail"]').should("exist");
    cy.get('[data-testid="status-bar"]').should("exist");
  });

  it("every navbar, rail, and status-bar tab stop shows a computed ring", () => {
    cy.get(CHROME_BUTTONS).should("have.length.at.least", 6);

    cy.get('[data-testid="navbar"] button')
      .first()
      .then(($btn) => {
        ($btn[0] as HTMLElement).focus();
      });

    const tabbed: string[] = [];
    Cypress._.times(24, () => {
      cy.press(Cypress.Keyboard.Keys.TAB);
      cy.document().then((doc) => {
        const el = doc.activeElement as HTMLElement | null;
        if (!inChrome(el) || el?.tagName !== "BUTTON") return;
        const id = el.getAttribute("aria-label") ?? el.tagName;
        if (!tabbed.includes(id)) tabbed.push(id);
        assertVisibleFocusRing(el);
      });
    });

    cy.then(() => {
      expect(tabbed.length, "Tab stops inside navbar/rail/status").to.be.greaterThan(4);
    });
  });
});
