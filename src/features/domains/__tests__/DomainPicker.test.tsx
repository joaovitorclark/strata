import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import "@/i18n";
import { DomainPicker } from "@/features/domains/DomainPicker";
import type { DomainMeta, ProjectMeta } from "@/infrastructure/api";
import * as api from "@/infrastructure/api";

vi.mock("@/infrastructure/api", () => ({
  listDomains: vi.fn(),
  activateDomain: vi.fn(),
  listProjects: vi.fn(),
  clearContext: vi.fn(),
  activateProject: vi.fn(),
  cloneDomain: vi.fn(),
  createDomain: vi.fn(),
  attachGitToDomain: vi.fn(),
  deleteDomain: vi.fn(),
  createProject: vi.fn(),
}));

const localDomain: DomainMeta = {
  id: "dom-local",
  slug: "local",
  name: "Local",
  dir: "/tmp/local",
  hasGit: false,
  remoteUrl: null,
  createdAt: "",
  updatedAt: "",
};

const gitDomain: DomainMeta = {
  id: "dom-git",
  slug: "acme",
  name: "Acme",
  dir: "/tmp/acme",
  hasGit: true,
  remoteUrl: "https://github.com/acme/repo.git",
  createdAt: "",
  updatedAt: "",
};

const project: ProjectMeta = {
  id: "proj-1",
  name: "vendas",
  slug: "vendas",
  createdAt: "",
  updatedAt: "",
};

async function renderPicker() {
  render(<DomainPicker onOpened={vi.fn()} />);
  await screen.findByRole("button", { name: "Acme" });
}

async function openLocalDomain() {
  render(<DomainPicker onOpened={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Local" }));
  await screen.findByRole("button", { name: "Anexar repositório" });
}

describe("DomainPicker", () => {
  beforeEach(() => {
    vi.mocked(api.listDomains).mockResolvedValue({
      domains: [gitDomain, localDomain],
      activeDomainSlug: null,
    });
    vi.mocked(api.activateDomain).mockResolvedValue({ ok: true, domain: localDomain });
    vi.mocked(api.listProjects).mockResolvedValue({ projects: [project], activeId: project.id });
    vi.mocked(api.clearContext).mockResolvedValue({ ok: true });
    vi.mocked(api.activateProject).mockResolvedValue(undefined);
    vi.mocked(api.cloneDomain).mockResolvedValue(gitDomain);
    vi.mocked(api.createDomain).mockResolvedValue(localDomain);
    vi.mocked(api.attachGitToDomain).mockResolvedValue({ ...localDomain, hasGit: true });
    vi.mocked(api.deleteDomain).mockResolvedValue(undefined);
    vi.mocked(api.createProject).mockResolvedValue(project);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("activates a domain and shows its projects", async () => {
    const onOpened = vi.fn();
    render(<DomainPicker onOpened={onOpened} />);
    fireEvent.click(await screen.findByRole("button", { name: "Acme" }));
    await waitFor(() => expect(api.activateDomain).toHaveBeenCalledWith("dom-git"));
    expect(await screen.findByRole("button", { name: "vendas" })).toBeTruthy();
  });

  it("removes a domain after confirm", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Remover Acme" }));
    await waitFor(() => expect(api.deleteDomain).toHaveBeenCalledWith("dom-git"));
    confirm.mockRestore();
  });

  it("reveals the local-domain form", async () => {
    await renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "+ Novo domínio local" }));
    expect(screen.getByPlaceholderText("Nome do domínio")).toBeTruthy();
    expect(screen.queryByPlaceholderText(/URL do repositório/)).toBeNull();
  });

  it("reveals the clone form with name and URL", async () => {
    await renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "+ Clonar repositório" }));
    expect(screen.getByPlaceholderText("Nome do domínio")).toBeTruthy();
    expect(screen.getByPlaceholderText("URL do repositório (https ou ssh)")).toBeTruthy();
  });

  it("Criar creates a local domain or clones the given URL", async () => {
    await renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "+ Novo domínio local" }));
    fireEvent.change(screen.getByPlaceholderText("Nome do domínio"), {
      target: { value: "Novo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(api.createDomain).toHaveBeenCalledWith("Novo"));

    fireEvent.click(await screen.findByRole("button", { name: "+ Clonar repositório" }));
    fireEvent.change(screen.getByPlaceholderText("Nome do domínio"), {
      target: { value: "Clonado" },
    });
    fireEvent.change(screen.getByPlaceholderText("URL do repositório (https ou ssh)"), {
      target: { value: "https://github.com/a/b.git" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() =>
      expect(api.cloneDomain).toHaveBeenCalledWith("https://github.com/a/b.git", "Clonado"),
    );
  });

  it("Cancelar dismisses the new-domain form", async () => {
    await renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "+ Novo domínio local" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByPlaceholderText("Nome do domínio")).toBeNull();
    expect(screen.getByRole("button", { name: "+ Novo domínio local" })).toBeTruthy();
  });

  it("← Domínios clears context and returns to the domain list", async () => {
    render(<DomainPicker onOpened={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Acme" }));
    fireEvent.click(await screen.findByRole("button", { name: "← Domínios" }));
    await waitFor(() => expect(api.clearContext).toHaveBeenCalled());
    expect(await screen.findByText("Escolha um domínio")).toBeTruthy();
  });

  it("Anexar repositório reveals the optional remote URL field", async () => {
    await openLocalDomain();
    fireEvent.click(screen.getByRole("button", { name: "Anexar repositório" }));
    expect(screen.getByPlaceholderText("URL do remote (opcional — https ou ssh)")).toBeTruthy();
  });

  it("Confirmar attaches git to the domain", async () => {
    await openLocalDomain();
    fireEvent.click(screen.getByRole("button", { name: "Anexar repositório" }));
    fireEvent.change(screen.getByPlaceholderText("URL do remote (opcional — https ou ssh)"), {
      target: { value: "https://github.com/a/b.git" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(api.attachGitToDomain).toHaveBeenCalledWith("dom-local", "https://github.com/a/b.git"),
    );
  });

  it("clicking a project activates it and opens the editor", async () => {
    const onOpened = vi.fn();
    render(<DomainPicker onOpened={onOpened} />);
    fireEvent.click(await screen.findByRole("button", { name: "Acme" }));
    fireEvent.click(await screen.findByRole("button", { name: "vendas" }));
    await waitFor(() => expect(api.activateProject).toHaveBeenCalledWith("proj-1"));
    expect(onOpened).toHaveBeenCalledWith(gitDomain);
  });

  it("creates a project in the active domain", async () => {
    render(<DomainPicker onOpened={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Acme" }));
    const input = await screen.findByPlaceholderText("Nome do novo projeto");
    fireEvent.change(input, { target: { value: "estoque" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Novo projeto" }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith("estoque"));
  });
});

describe("DomainPicker source", () => {
  it("uses tokens, not hex literals or flavour names", () => {
    const src = readFileSync("src/features/domains/DomainPicker.tsx", "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(src).not.toMatch(/macchiato|latte/i);
  });
});
