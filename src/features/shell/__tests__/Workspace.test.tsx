import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@/i18n";
import App from "@/App";
import { AppGate } from "@/features/domains/AppGate";
import { useSchemaStore } from "@/features/schema/store";
import { EXPORTERS } from "@/features/command-palette/actions";
import type { DomainMeta, ProjectMeta } from "@/infrastructure/api";
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
    getContext: vi.fn(),
    clearContext: vi.fn().mockResolvedValue({ ok: true }),
    listDomains: vi.fn(),
    activateDomain: vi.fn(),
    listProjects: vi.fn(),
    loadProjectById: vi.fn(),
    loadProject: vi.fn(),
    getMeta: vi.fn(),
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveProjectById: vi.fn().mockResolvedValue(undefined),
    exportFormat: vi.fn().mockResolvedValue({ files: ["output/dbt/"] }),
    importFromInput: vi.fn().mockResolvedValue({
      dbml: "",
      imported: [],
      warnings: [],
    }),
    importFromInputForProject: vi.fn().mockResolvedValue({
      dbml: "",
      imported: [],
      warnings: [],
    }),
    activateProject: vi.fn().mockResolvedValue(undefined),
    createProject: vi.fn(),
    renameProject: vi.fn().mockResolvedValue(undefined),
    duplicateProject: vi.fn(),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    createDomain: vi.fn(),
    cloneDomain: vi.fn(),
    attachGitToDomain: vi.fn(),
    deleteDomain: vi.fn(),
    getGitStatus: vi.fn(),
    switchGitBranch: vi.fn(),
    gitCommit: vi.fn(),
    gitPull: vi.fn(),
    gitPush: vi.fn(),
    getPrUrl: vi.fn(),
    submitGitCredential: vi.fn(),
  };
});

const domain: DomainMeta = {
  id: "dom-1",
  slug: "acme",
  name: "Acme",
  dir: "/tmp/acme",
  hasGit: false,
  remoteUrl: null,
  createdAt: "",
  updatedAt: "",
};

const gitDomain: DomainMeta = { ...domain, hasGit: true, remoteUrl: "https://github.com/a/b.git" };

const project: ProjectMeta = {
  id: "p1",
  name: "vendas",
  slug: "vendas",
  createdAt: "",
  updatedAt: "",
};

function mockEditorApis() {
  vi.mocked(api.listProjects).mockResolvedValue({ activeId: project.id, projects: [project] });
  vi.mocked(api.loadProjectById).mockResolvedValue({ dbml: "", canvas: {} });
  vi.mocked(api.loadProject).mockResolvedValue({ dbml: "", canvas: {} });
  vi.mocked(api.getMeta).mockResolvedValue({
    root: "",
    dataDir: "",
    inputDir: "",
    port: 0,
    pinnedProject: null,
    pinnedProjectId: null,
  });
  vi.mocked(api.getGitStatus).mockResolvedValue({
    hasGit: true,
    branch: "main",
    ahead: 0,
    behind: 0,
    dirty: false,
    files: [],
    branches: ["main"],
  });
}

describe("AppGate / Workspace cutover", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    mockEditorApis();
    vi.mocked(api.getContext).mockResolvedValue({ domain: null });
    vi.mocked(api.listDomains).mockResolvedValue({
      domains: [gitDomain],
      activeDomainSlug: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows DomainPicker when getContext has no domain", async () => {
    render(<AppGate />);
    expect(await screen.findByText("Escolha um domínio")).toBeTruthy();
    expect(api.getContext).toHaveBeenCalled();
  });

  it("fills editor slots, palette, overlay, exporters, and CanvasActions", async () => {
    render(<App domain={domain} onBackToDomains={vi.fn()} />);

    await waitFor(() => expect(api.listProjects).toHaveBeenCalled());
    await waitFor(() => expect(api.loadProjectById).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(api.getMeta).toHaveBeenCalled());

    const slots = ["navbar", "rail", "tree", "canvas", "inspector", "drawer", "statusbar"];
    for (const slot of slots) {
      expect(document.querySelector(`[data-slot="${slot}"]`), slot).not.toBeNull();
    }
    expect(screen.getByTestId("canvas-stub")).toBeTruthy();
    expect(document.querySelector('[data-canvas-actions="ready"]')).not.toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Buscar" })[0]);
    expect(screen.getByTestId("command-palette")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Atalhos e gestos" }));
    expect(screen.getByTestId("shortcuts-overlay")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    const items = document.querySelectorAll("[data-export-id]");
    expect(items.length).toBe(10);
    expect(EXPORTERS).toHaveLength(10);
  });

  it("navbar export runs exportFormat for dbt", async () => {
    render(<App domain={domain} />);
    await waitFor(() => expect(api.listProjects).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Exportar dbt" }));
    await waitFor(() =>
      expect(api.exportFormat).toHaveBeenCalledWith(expect.any(String), "dbt", undefined),
    );
  });

  it("save button calls saveProjectById", async () => {
    render(<App domain={domain} />);
    await waitFor(() => expect(api.loadProjectById).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy());
    useSchemaStore.getState().setSaveState("dirty");
    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      return btn;
    });
    fireEvent.click(saveBtn);
    await waitFor(() => expect(api.saveProjectById).toHaveBeenCalled());
    expect(api.saveProjectById).toHaveBeenCalledWith(
      "p1",
      expect.any(String),
      expect.objectContaining({ positions: expect.any(Object), colors: expect.any(Object) }),
    );
  });

  it("falls back to GET /api/project when listProjects fails", async () => {
    vi.mocked(api.listProjects).mockRejectedValueOnce(new Error("offline"));
    render(<App domain={domain} />);
    await waitFor(() => expect(api.loadProject).toHaveBeenCalled());
  });

  it("← Domínios calls onBackToDomains after save", async () => {
    const onBack = vi.fn();
    render(<App domain={domain} onBackToDomains={onBack} />);
    await waitFor(() => expect(api.loadProjectById).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "← Domínios" }));
    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect(api.saveProjectById).toHaveBeenCalled();
  });

  it("Importar (input/) calls importFromInputForProject", async () => {
    render(<App domain={domain} />);
    await waitFor(() => expect(api.loadProjectById).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Importar (input/)" }));
    await waitFor(() => expect(api.importFromInputForProject).toHaveBeenCalled());
  });

  it("mounts GitPanel and loads git status when the domain has git", async () => {
    render(<App domain={gitDomain} />);
    await waitFor(() => expect(api.getGitStatus).toHaveBeenCalledWith("dom-1"));
  });
});
