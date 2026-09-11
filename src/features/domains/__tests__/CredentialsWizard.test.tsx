import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import "@/i18n";
import { CredentialsWizard } from "@/features/domains/CredentialsWizard";
import * as api from "@/infrastructure/api";

vi.mock("@/infrastructure/api", () => ({
  submitGitCredential: vi.fn(),
}));

describe("CredentialsWizard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("links to the host token-creation page when a known host URL exists", () => {
    render(
      <CredentialsWizard domainId="dom-1" host="github.com" onDone={vi.fn()} onCancel={vi.fn()} />,
    );
    const link = screen.getByRole("link", {
      name: "Abrir página de criar token em github.com",
    });
    expect(link.getAttribute("href")).toContain("github.com/settings/tokens/new");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("fills Usuário", () => {
    render(
      <CredentialsWizard domainId="dom-1" host="github.com" onDone={vi.fn()} onCancel={vi.fn()} />,
    );
    const user = screen.getByPlaceholderText("Usuário") as HTMLInputElement;
    fireEvent.change(user, { target: { value: "me" } });
    expect(user.value).toBe("me");
  });

  it("fills Token as a password field", () => {
    render(
      <CredentialsWizard domainId="dom-1" host="github.com" onDone={vi.fn()} onCancel={vi.fn()} />,
    );
    const token = screen.getByPlaceholderText("Token") as HTMLInputElement;
    expect(token.type).toBe("password");
    fireEvent.change(token, { target: { value: "tok" } });
    expect(token.value).toBe("tok");
  });

  it("Salvar stores the credential via git credential approve", async () => {
    vi.mocked(api.submitGitCredential).mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    render(
      <CredentialsWizard domainId="dom-1" host="github.com" onDone={onDone} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText("Usuário"), { target: { value: "me" } });
    fireEvent.change(screen.getByPlaceholderText("Token"), { target: { value: "tok" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(api.submitGitCredential).toHaveBeenCalledWith("dom-1", "github.com", "me", "tok"),
    );
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("Cancelar dismisses the wizard", () => {
    const onCancel = vi.fn();
    render(
      <CredentialsWizard domainId="dom-1" host="github.com" onDone={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("CredentialsWizard source", () => {
  it("does not keep the token in React state, log it, or use hex", () => {
    const src = readFileSync("src/features/domains/CredentialsWizard.tsx", "utf8");
    expect(src).not.toMatch(/setToken\b/);
    expect(src).not.toMatch(/const \[token/);
    expect(src).not.toMatch(/console\.(log|debug|info|warn|error)/);
    expect(src).toMatch(/type=["']password["']/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(src).not.toMatch(/macchiato|latte/i);
  });
});
