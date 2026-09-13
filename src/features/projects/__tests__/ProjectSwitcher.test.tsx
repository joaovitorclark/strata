import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import "@/i18n";
import { ProjectSwitcher } from "@/features/projects/ProjectSwitcher";
import type { ProjectMeta } from "@/infrastructure/api";

const vendas: ProjectMeta = {
  id: "p1",
  name: "vendas",
  slug: "vendas",
  createdAt: "",
  updatedAt: "",
};
const estoque: ProjectMeta = {
  id: "p2",
  name: "estoque",
  slug: "estoque",
  createdAt: "",
  updatedAt: "",
};

const handlers = {
  onSwitch: vi.fn(),
  onCreate: vi.fn(),
  onRename: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
};

function renderSwitcher(overrides: Partial<Parameters<typeof ProjectSwitcher>[0]> = {}) {
  return render(
    <ProjectSwitcher
      projects={[vendas, estoque]}
      currentProjectId="p1"
      saveState="idle"
      {...handlers}
      {...overrides}
    />,
  );
}

describe("ProjectSwitcher", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens the project menu from the current project name", () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /vendas/ }));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /estoque/ })).toBeTruthy();
  });

  it("clicks another project to switch to it", () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /vendas/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /estoque/ }));
    expect(handlers.onSwitch).toHaveBeenCalledWith("p2");
  });

  it("renames a project via the row edit control (prompt)", () => {
    vi.spyOn(window, "prompt").mockReturnValue("vendas-2");
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /vendas/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Renomear" })[0]);
    expect(handlers.onRename).toHaveBeenCalledWith("p1", "vendas-2");
  });

  it("duplicates a project via the row control", () => {
    vi.spyOn(window, "prompt").mockReturnValue("vendas (cópia)");
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /vendas/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Duplicar" })[0]);
    expect(handlers.onDuplicate).toHaveBeenCalledWith("p1", "vendas (cópia)");
  });

  it("deletes via the row × when confirmed, and hides delete when only one project exists", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /vendas/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir" })[0]);
    expect(handlers.onDelete).toHaveBeenCalledWith("p1");

    cleanup();
    renderSwitcher({ projects: [vendas], currentProjectId: "p1" });
    fireEvent.click(screen.getByRole("button", { name: /vendas/ }));
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
  });

  it("Renomear projeto in the footer renames the current project", () => {
    vi.spyOn(window, "prompt").mockReturnValue("vendas-final");
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /vendas/ }));
    fireEvent.click(screen.getByRole("button", { name: "Renomear projeto" }));
    expect(handlers.onRename).toHaveBeenCalledWith("p1", "vendas-final");
  });

  it("when pinned, only the pin label and rename control are shown", () => {
    renderSwitcher({ pinnedLabel: "vendas" });
    expect(screen.getByText("vendas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Renomear projeto" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Trocar projeto/ })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("button", { name: "Duplicar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
  });
});

describe("ProjectSwitcher source", () => {
  it("uses tokens, not hex literals or flavour names", () => {
    const src = readFileSync("src/features/projects/ProjectSwitcher.tsx", "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(src).not.toMatch(/macchiato|latte/i);
  });
});
