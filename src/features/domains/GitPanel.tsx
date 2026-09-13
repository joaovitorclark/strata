import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import * as api from "@/infrastructure/api";
import type { DomainMeta, GitStatusResponse } from "@/infrastructure/api";
import { formatGitSummary, hostFromRemote, isAuthError } from "@/features/domains/gitPanelHelpers";
import { CredentialsWizard } from "@/features/domains/CredentialsWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ICON_SIZE = 14;
const ICON_STROKE = 1.5;

/**
 * `api.ts` monta o erro como `` `${url} -> ${status}: ${serverError}` ``; o que interessa
 * ao usuário é o `serverError`. Mensagens sem esse formato passam inalteradas.
 */
function readableError(msg: string): string {
  return msg.split(": ").slice(1).join(": ") || msg;
}

export function GitPanel({
  domain,
  onRepoChanged,
}: {
  domain: DomainMeta;
  onRepoChanged?: () => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<GitStatusResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [wizardHost, setWizardHost] = useState<string | null>(null);
  const [newBranch, setNewBranch] = useState("");
  const [commitMsg, setCommitMsg] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.getGitStatus(domain.id);
      setStatus(s);
    } catch (e: unknown) {
      setStatus(null);
      setMessage((e as Error).message);
      setError(true);
    }
  }, [domain.id]);

  useEffect(() => {
    if (!domain.hasGit) return;
    // Load is async; setState runs in the promise, not the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- LDB fetch-on-mount
    void refreshStatus();
  }, [domain.hasGit, refreshStatus]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!domain.hasGit) return null;

  const git = status?.hasGit ? status : null;
  const summary = formatGitSummary(status);
  const branchLabel = git?.branch ?? "…";

  const openWizard = () =>
    setWizardHost(hostFromRemote(domain.remoteUrl) ?? t("domains.git.fallbackHost"));

  const handleFailure = (e: unknown) => {
    const msg = (e as Error)?.message ?? String(e);
    if (isAuthError(msg)) {
      openWizard();
    } else {
      setMessage(msg);
      setError(true);
    }
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    setError(false);
    try {
      await action();
    } catch (e: unknown) {
      handleFailure(e);
    } finally {
      setBusy(false);
      await refreshStatus();
    }
  };

  const handleSwitch = (name: string) => {
    if (!git || name === git.branch) return;
    return run(async () => {
      await api.switchGitBranch(domain.id, name, false);
      setMessage(t("domains.git.switched", { name }));
      onRepoChanged?.();
    });
  };

  const handleCreateBranch = () => {
    const name = newBranch.trim();
    if (!name) return;
    if (git && name === git.branch) return;
    return run(async () => {
      await api.switchGitBranch(domain.id, name, true);
      setNewBranch("");
      setMessage(t("domains.git.switched", { name }));
      onRepoChanged?.();
    });
  };

  const handleCommit = () => {
    const msg = commitMsg.trim();
    if (!msg) {
      setMessage(t("domains.git.commitRequired"));
      setError(true);
      return;
    }
    return run(async () => {
      await api.gitCommit(domain.id, msg);
      setCommitMsg("");
      setMessage(t("domains.git.committed"));
    });
  };

  const handlePull = () =>
    run(async () => {
      await api.gitPull(domain.id);
      setMessage(t("domains.git.pulled"));
      onRepoChanged?.();
    });

  const handlePush = () =>
    run(async () => {
      await api.gitPush(domain.id);
      setMessage(t("domains.git.pushed"));
    });

  const handleOpenPr = () =>
    run(async () => {
      const { url } = await api.getPrUrl(domain.id);
      if (url) window.open(url, "_blank", "noreferrer");
      else setMessage(t("domains.git.noPrUrl"));
    });

  return (
    <div className="relative inline-flex items-center" ref={rootRef} data-git-panel>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-w-[280px] gap-2"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        title={t("domains.git.operations")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="max-w-[140px] truncate font-semibold">{branchLabel}</span>
        {summary ? (
          <span className="max-w-[120px] truncate text-muted-foreground">{summary}</span>
        ) : null}
        <ChevronDown size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
      </Button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[280px] rounded-md border border-border bg-popover py-1.5 text-popover-foreground shadow-md"
          role="menu"
        >
          {summary ? (
            <div className="px-3 pb-2 pt-1.5 text-xs text-muted-foreground">{summary}</div>
          ) : null}
          {git
            ? git.branches.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="menuitem"
                  className={cn(
                    "block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    "disabled:pointer-events-none disabled:opacity-50",
                    name === git.branch && "font-semibold",
                  )}
                  disabled={busy || name === git.branch}
                  onClick={() => void handleSwitch(name)}
                >
                  {name === git.branch ? t("domains.git.current", { name }) : name}
                </button>
              ))
            : null}
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <Input
              className="h-8"
              placeholder={t("domains.git.newBranch")}
              value={newBranch}
              disabled={busy}
              onChange={(e) => setNewBranch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateBranch();
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || !newBranch.trim()}
              onClick={() => void handleCreateBranch()}
            >
              {t("domains.git.createBranch")}
            </Button>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <Input
              className="h-8"
              placeholder={t("domains.git.commitMessage")}
              value={commitMsg}
              disabled={busy}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCommit();
              }}
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => void handleCommit()}>
              {t("domains.git.commit")}
            </Button>
          </div>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            disabled={busy}
            onClick={() => void handlePull()}
          >
            {t("domains.git.pull")}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            disabled={busy}
            onClick={() => void handlePush()}
          >
            {t("domains.git.push")}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            disabled={busy}
            onClick={() => void handleOpenPr()}
          >
            {t("domains.git.openPr")}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            disabled={busy}
            onClick={openWizard}
          >
            {t("domains.git.credentials")}
          </button>
          {message ? (
            <div
              className={cn(
                "max-w-[320px] truncate px-3 py-2 text-sm italic text-muted-foreground",
                error && "text-destructive not-italic",
              )}
              title={message}
            >
              {error ? readableError(message) : message}
            </div>
          ) : null}
        </div>
      ) : null}
      {wizardHost && (
        <CredentialsWizard
          domainId={domain.id}
          host={wizardHost}
          onDone={() => {
            setWizardHost(null);
            void refreshStatus();
          }}
          onCancel={() => setWizardHost(null)}
        />
      )}
    </div>
  );
}
