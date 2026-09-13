import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import "@/i18n";
import { GitPanel } from "@/features/domains/GitPanel";
import type { DomainMeta, GitStatusResponse } from "@/infrastructure/api";
import * as api from "@/infrastructure/api";

vi.mock("@/infrastructure/api", () => ({
  getGitStatus: vi.fn(),
  switchGitBranch: vi.fn(),
  gitCommit: vi.fn(),
  gitPull: vi.fn(),
  gitPush: vi.fn(),
  getPrUrl: vi.fn(),
  submitGitCredential: vi.fn(),
}));

const domain: DomainMeta = {
  id: "dom-1",
  slug: "acme",
  name: "Acme",
  dir: "/tmp/acme",
  hasGit: true,
  remoteUrl: "https://github.com/acme/repo.git",
  createdAt: "",
  updatedAt: "",
};

const gitStatus: GitStatusResponse = {
  hasGit: true,
  branch: "main",
  ahead: 0,
  behind: 0,
  dirty: false,
  files: [],
  branches: ["main", "dev"],
};

async function openPanel() {
  render(<GitPanel domain={domain} onRepoChanged={vi.fn()} />);
  const trigger = await screen.findByRole("button", { name: /main/ });
  fireEvent.click(trigger);
  return trigger;
}

describe("GitPanel", () => {
  beforeEach(() => {
    vi.mocked(api.getGitStatus).mockResolvedValue(gitStatus);
    vi.mocked(api.switchGitBranch).mockResolvedValue({ ok: true, branch: "dev" });
    vi.mocked(api.gitCommit).mockResolvedValue({ ok: true, branch: "main" });
    vi.mocked(api.gitPull).mockResolvedValue({ ok: true });
    vi.mocked(api.gitPush).mockResolvedValue({ ok: true, branch: "main" });
    vi.mocked(api.getPrUrl).mockResolvedValue({
      url: "https://github.com/acme/repo/compare/main?expand=1",
      host: "github.com",
      remoteUrl: domain.remoteUrl,
      branch: "main",
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens and closes the dropdown from the branch button", async () => {
    const trigger = await openPanel();
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("switches to a listed branch and notifies onRepoChanged", async () => {
    const onRepoChanged = vi.fn();
    render(<GitPanel domain={domain} onRepoChanged={onRepoChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: /main/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "dev" }));
    await waitFor(() => expect(api.switchGitBranch).toHaveBeenCalledWith("dom-1", "dev", false));
    expect(onRepoChanged).toHaveBeenCalledOnce();
  });

  it("creates a branch from the name field (button and Enter)", async () => {
    await openPanel();
    const input = screen.getByPlaceholderText("nova-branch");
    fireEvent.change(input, { target: { value: "feat-x" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar branch" }));
    await waitFor(() => expect(api.switchGitBranch).toHaveBeenCalledWith("dom-1", "feat-x", true));

    fireEvent.change(screen.getByPlaceholderText("nova-branch"), { target: { value: "feat-y" } });
    fireEvent.keyDown(screen.getByPlaceholderText("nova-branch"), { key: "Enter" });
    await waitFor(() => expect(api.switchGitBranch).toHaveBeenCalledWith("dom-1", "feat-y", true));
  });

  it("commits with the message field (button and Enter)", async () => {
    await openPanel();
    const input = screen.getByPlaceholderText("mensagem do commit");
    fireEvent.change(input, { target: { value: "feat: x" } });
    fireEvent.click(screen.getByRole("button", { name: "commit" }));
    await waitFor(() => expect(api.gitCommit).toHaveBeenCalledWith("dom-1", "feat: x"));

    fireEvent.change(screen.getByPlaceholderText("mensagem do commit"), {
      target: { value: "fix: y" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("mensagem do commit"), { key: "Enter" });
    await waitFor(() => expect(api.gitCommit).toHaveBeenCalledWith("dom-1", "fix: y"));
  });

  it("pulls, and shows the dirty-tree refusal from the server", async () => {
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "pull" }));
    await waitFor(() => expect(api.gitPull).toHaveBeenCalledWith("dom-1"));

    vi.mocked(api.gitPull).mockRejectedValueOnce(
      new Error("Há mudanças não commitadas — salve ou commite antes de atualizar."),
    );
    fireEvent.click(screen.getByRole("button", { name: "pull" }));
    expect(await screen.findByText(/não commitadas/)).toBeTruthy();
  });

  it("pushes the current branch", async () => {
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "push" }));
    await waitFor(() => expect(api.gitPush).toHaveBeenCalledWith("dom-1"));
  });

  it("opens the host compare URL, or shows a message when there is none", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Abrir PR" }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        "https://github.com/acme/repo/compare/main?expand=1",
        "_blank",
        "noreferrer",
      ),
    );
    open.mockRestore();

    vi.mocked(api.getPrUrl).mockResolvedValueOnce({
      url: null,
      host: "git.empresa.com",
      remoteUrl: "x",
      branch: "main",
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir PR" }));
    expect(await screen.findByText(/Sem link automático/)).toBeTruthy();
  });

  it("Credenciais opens the credentials wizard", async () => {
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Credenciais" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /github.com/ })).toBeTruthy();
  });

  it("Escape or click outside closes the dropdown", async () => {
    await openPanel();
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(await screen.findByRole("button", { name: /main/ }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders nothing when the domain has no git", () => {
    const { container } = render(<GitPanel domain={{ ...domain, hasGit: false }} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("GitPanel source", () => {
  it("uses tokens, not hex literals or flavour names", () => {
    const src = readFileSync("src/features/domains/GitPanel.tsx", "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(src).not.toMatch(/macchiato|latte/i);
  });
});
