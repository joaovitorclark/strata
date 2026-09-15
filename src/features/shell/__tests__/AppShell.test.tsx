import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import "@/i18n";
import App from "@/App";
import { AppShell, resolveTheme, shellColumns } from "@/features/shell/AppShell";
import { useSchemaStore } from "@/features/schema/store";
import * as api from "@/infrastructure/api";

vi.mock("@/features/canvas", () => ({
  Canvas: () => <div data-testid="canvas-stub" />,
  nodeTypes: {},
  edgeTypes: {},
}));

vi.mock("@/infrastructure/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/api")>();
  return {
    ...actual,
    listProjects: vi.fn().mockResolvedValue({ activeId: "", projects: [] }),
    loadProjectById: vi.fn().mockResolvedValue({ dbml: "", canvas: {} }),
    loadProject: vi.fn().mockResolvedValue({ dbml: "", canvas: {} }),
    getMeta: vi.fn().mockResolvedValue({
      root: "",
      dataDir: "",
      inputDir: "",
      port: 0,
      pinnedProject: null,
      pinnedProjectId: null,
    }),
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveProjectById: vi.fn().mockResolvedValue(undefined),
    saveDbtChanges: vi.fn().mockResolvedValue([]),
    exportFormat: vi.fn().mockResolvedValue({ files: [] }),
    getGitStatus: vi.fn().mockResolvedValue({
      hasGit: false,
      branch: "main",
      ahead: 0,
      behind: 0,
      dirty: false,
      files: [],
      branches: ["main"],
    }),
  };
});

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
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    vi.mocked(api.listProjects).mockResolvedValue({ activeId: "", projects: [] });
  });

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
