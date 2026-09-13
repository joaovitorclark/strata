import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import "@/i18n";
import { EXPORTERS } from "@/features/command-palette/actions";
import { Navbar } from "@/features/shell/Navbar";
import { IconRail, RAIL_ITEMS } from "@/features/shell/IconRail";
import { StatusBar } from "@/features/shell/StatusBar";

const CHROME_FILES = [
  "src/features/shell/Navbar.tsx",
  "src/features/shell/IconRail.tsx",
  "src/features/shell/StatusBar.tsx",
];

describe("shell chrome", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders navbar mark, breadcrumb, ⌘K chip, theme, export dbt, share, avatar", () => {
    render(<Navbar domain="Local" project="vendas" />);

    expect(screen.getByText("Strata")).toBeTruthy();
    expect(screen.getByText("Local")).toBeTruthy();
    expect(screen.getByText("vendas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buscar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alternar tema" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exportar" }).textContent).toMatch(/dbt/);
    expect(screen.getByRole("button", { name: "Compartilhar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conta" })).toBeTruthy();
  });

  it("persists dark/light via THEME_STORAGE_KEY and applyThemeClass", () => {
    render(<Navbar />);
    const toggle = screen.getByRole("button", { name: "Alternar tema" });

    fireEvent.click(toggle);
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(toggle);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("renders the six rail items at 17px / 1.5 stroke", () => {
    render(<IconRail />);
    for (const id of RAIL_ITEMS) {
      const btn = document.querySelector(`[data-rail-item="${id}"]`) as HTMLButtonElement;
      expect(btn, id).not.toBeNull();
      const svg = btn.querySelector("svg");
      expect(svg?.getAttribute("width")).toBe("17");
      expect(svg?.getAttribute("stroke-width")).toBe("1.5");
    }
  });

  it("renders statusbar problems, DBML handle, zoom, and density", () => {
    render(<StatusBar problemCount={3} zoomPercent={100} />);
    expect(screen.getByRole("button", { name: "Problemas 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "DBML" })).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reduzir zoom" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aumentar zoom" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajustar à tela" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Densidade" })).toBeTruthy();
  });

  it("lets every control take keyboard focus with a visible focus ring class", () => {
    render(
      <>
        <Navbar />
        <IconRail />
        <StatusBar />
      </>,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(10);
    for (const btn of buttons) {
      expect(btn.className).toContain("focus-visible:ring-2");
      expect(btn.className).toContain("focus-visible:ring-ring");
      btn.focus();
      expect(document.activeElement).toBe(btn);
    }
  });

  it("does not port pickTooltipSide, hex literals, or flavour names", () => {
    for (const path of CHROME_FILES) {
      const src = readFileSync(path, "utf8");
      expect(src, path).not.toMatch(/pickTooltipSide/);
      expect(src, path).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(src, path).not.toMatch(/macchiato|latte/i);
    }
  });

  it("Navbar export trigger renders and EXPORTERS has 10 entries", () => {
    render(<Navbar onExportOption={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Exportar" })).toBeTruthy();
    expect(EXPORTERS).toHaveLength(10);
  });

  it("Navbar export uses shadcn DropdownMenu fed by EXPORTERS", () => {
    const src = readFileSync("src/features/shell/Navbar.tsx", "utf8");
    expect(src).toContain('from "@/components/ui/dropdown-menu"');
    expect(src).toContain("EXPORTERS.map");
    expect(src).toContain("t(exporter.labelKey)");
    expect(src).not.toMatch(/<ul[\s\S]*role="menu"/);
  });
});
