import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import App from "@/App";
import { AppShell, resolveTheme, shellColumns } from "@/features/shell/AppShell";

const SLOTS = ["navbar", "rail", "tree", "canvas", "inspector", "drawer", "statusbar"] as const;

describe("resolveTheme", () => {
  it("falls back to dark when nothing is stored", () => {
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme("")).toBe("dark");
    expect(resolveTheme("system")).toBe("dark");
  });

  it("accepts only dark and light", () => {
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });
});

describe("shellColumns", () => {
  it("matches identity.md §6 with canvas always 1fr", () => {
    expect(shellColumns(false, false)).toBe("46px 176px 1fr auto");
    expect(shellColumns(true, false)).toBe("46px 0px 1fr auto");
    expect(shellColumns(false, true)).toBe("46px 176px 1fr 0px");
    expect(shellColumns(true, true)).toBe("46px 0px 1fr 0px");
  });
});

describe("AppShell", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders the seven named slots and a dotted-grid canvas region", () => {
    const { container } = render(<AppShell />);

    for (const slot of SLOTS) {
      expect(container.querySelector(`[data-slot="${slot}"]`), slot).not.toBeNull();
    }

    const canvas = container.querySelector('[data-slot="canvas"]');
    expect(canvas?.classList.contains("strata-canvas")).toBe(true);
    expect(container.querySelector(".react-flow")).toBeNull();
  });

  it("fills named slots without changing the grid", () => {
    const { container } = render(<AppShell navbar={<span>nav-fill</span>} />);
    const root = container.querySelector("[data-shell='root']") as HTMLElement;
    const middle = container.querySelector("[data-shell='middle']") as HTMLElement;

    expect(container.querySelector('[data-slot="navbar"]')?.textContent).toBe("nav-fill");
    expect(root.style.gridTemplateRows).toBe("auto 1fr auto");
    expect(middle.style.gridTemplateColumns).toBe("46px 176px 1fr auto");
  });

  it("lays out navbar / middle / statusbar and the four-column middle row", () => {
    const { container } = render(<AppShell />);
    const root = container.querySelector("[data-shell='root']") as HTMLElement;
    const middle = container.querySelector("[data-shell='middle']") as HTMLElement;

    expect(root.style.gridTemplateRows).toBe("auto 1fr auto");
    expect(middle.style.gridTemplateColumns).toBe("46px 176px 1fr auto");
  });

  it("applies .dark on the document root by default", () => {
    render(<AppShell />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("honours a stored light preference", () => {
    localStorage.setItem("theme", "light");
    render(<AppShell />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("App", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("dark");
  });

  it("composes AppShell", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[data-shell='root']")).not.toBeNull();
    expect(
      container.querySelector('[data-slot="canvas"]')?.classList.contains("strata-canvas"),
    ).toBe(true);
  });
});
