import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import * as api from "@/infrastructure/api";
import type { DomainMeta, ProjectMeta } from "@/infrastructure/api";
import { sortDomainsByName, domainBadge } from "@/features/domains/domainPickerHelpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type View = "domains" | "projects";
type NewDomainMode = "local" | "clone" | null;

const ICON_SIZE = 14;
const ICON_STROKE = 1.5;

export function DomainPicker({ onOpened }: { onOpened: (domain: DomainMeta) => void }) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("domains");
  const [domains, setDomains] = useState<DomainMeta[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DomainMeta | null>(null);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newDomainMode, setNewDomainMode] = useState<NewDomainMode>(null);
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainUrl, setNewDomainUrl] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachUrl, setAttachUrl] = useState("");

  const refreshDomains = useCallback(async () => {
    try {
      const { domains: list } = await api.listDomains();
      setDomains(list);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // Load is async; setState runs in the promise, not the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- LDB fetch-on-mount
    void refreshDomains();
  }, [refreshDomains]);

  const openDomain = useCallback(async (domain: DomainMeta) => {
    setError(null);
    try {
      await api.activateDomain(domain.id);
      const { projects: list } = await api.listProjects();
      setSelectedDomain(domain);
      setProjects(list);
      setView("projects");
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, []);

  const backToDomains = useCallback(async () => {
    await api.clearContext().catch(() => {});
    setSelectedDomain(null);
    setProjects([]);
    setView("domains");
    await refreshDomains();
  }, [refreshDomains]);

  const openProject = useCallback(
    async (projectId: string) => {
      if (!selectedDomain) return;
      setError(null);
      try {
        await api.activateProject(projectId);
        onOpened(selectedDomain);
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    },
    [selectedDomain, onOpened],
  );

  const handleCreateDomain = useCallback(async () => {
    setError(null);
    try {
      if (newDomainMode === "clone") {
        if (!newDomainUrl.trim()) return;
        await api.cloneDomain(newDomainUrl.trim(), newDomainName.trim() || undefined);
      } else {
        if (!newDomainName.trim()) return;
        await api.createDomain(newDomainName.trim());
      }
      setNewDomainMode(null);
      setNewDomainName("");
      setNewDomainUrl("");
      await refreshDomains();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [newDomainMode, newDomainName, newDomainUrl, refreshDomains]);

  /**
   * Versiona um domínio local (git init + remote opcional). O `DomainMeta`
   * retornado já vem com `hasGit: true`, então substituir o `selectedDomain`
   * atualiza a badge na hora e faz `openProject` abrir a versão correta.
   */
  const handleAttachGit = useCallback(async () => {
    if (!selectedDomain) return;
    setError(null);
    try {
      const updated = await api.attachGitToDomain(selectedDomain.id, attachUrl.trim() || undefined);
      setSelectedDomain(updated);
      setDomains((list) => list.map((d) => (d.id === updated.id ? updated : d)));
      setAttachOpen(false);
      setAttachUrl("");
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [selectedDomain, attachUrl]);

  const handleRemoveDomain = useCallback(
    async (domain: DomainMeta) => {
      const ok = window.confirm(t("domains.picker.removeConfirm", { name: domain.name }));
      if (!ok) return;
      setError(null);
      try {
        await api.deleteDomain(domain.id);
        await refreshDomains();
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    },
    [refreshDomains, t],
  );

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    setError(null);
    try {
      await api.createProject(newProjectName.trim());
      setNewProjectName("");
      const { projects: list } = await api.listProjects();
      setProjects(list);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [newProjectName]);

  return (
    <div
      className="flex h-screen flex-col gap-4 bg-background p-6 text-foreground"
      data-domain-picker
    >
      <header className="flex items-center gap-3">
        <strong className="text-base font-semibold tracking-[-0.02em]">{t("app.name")}</strong>
        {view === "projects" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => void backToDomains()}
          >
            {t("domains.picker.back")}
          </Button>
        )}
      </header>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {view === "domains" && (
        <section className="flex max-w-md flex-col gap-2">
          <h2 className="text-lg font-semibold">{t("domains.picker.choose")}</h2>
          {sortDomainsByName(domains).map((d) => (
            <div key={d.id} className="relative flex items-stretch">
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-2 py-2.5 pr-9"
                aria-label={d.name}
                onClick={() => void openDomain(d)}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "uppercase tracking-wide",
                    d.hasGit ? "border-success text-success" : "text-muted-foreground",
                  )}
                >
                  {domainBadge(d)}
                </Badge>
                <span className="truncate">{d.name}</span>
              </Button>
              <button
                type="button"
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-destructive"
                title={t("domains.picker.removeTitle")}
                aria-label={t("domains.picker.removeAria", { name: d.name })}
                onClick={() => void handleRemoveDomain(d)}
              >
                <X size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            </div>
          ))}

          {newDomainMode === null ? (
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setNewDomainMode("local")}>
                {t("domains.picker.newLocal")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setNewDomainMode("clone")}>
                {t("domains.picker.cloneRepo")}
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                placeholder={t("domains.picker.domainName")}
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
              />
              {newDomainMode === "clone" && (
                <Input
                  placeholder={t("domains.picker.repoUrl")}
                  value={newDomainUrl}
                  onChange={(e) => setNewDomainUrl(e.target.value)}
                />
              )}
              <Button type="button" onClick={() => void handleCreateDomain()}>
                {t("domains.picker.create")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setNewDomainMode(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          )}
        </section>
      )}

      {view === "projects" && selectedDomain && (
        <section className="flex max-w-md flex-col gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Badge
              variant="outline"
              className={cn(
                "uppercase tracking-wide",
                selectedDomain.hasGit ? "border-success text-success" : "text-muted-foreground",
              )}
            >
              {domainBadge(selectedDomain)}
            </Badge>
            {selectedDomain.name}
          </h2>
          {!selectedDomain.hasGit &&
            (attachOpen ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder={t("domains.picker.remoteOptional")}
                  value={attachUrl}
                  onChange={(e) => setAttachUrl(e.target.value)}
                />
                <Button type="button" onClick={() => void handleAttachGit()}>
                  {t("domains.picker.confirm")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setAttachOpen(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  title={t("domains.picker.attachTitle")}
                  onClick={() => setAttachOpen(true)}
                >
                  {t("domains.picker.attachRepo")}
                </Button>
              </div>
            ))}
          {projects.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant="outline"
              className="h-auto justify-start py-2.5"
              onClick={() => void openProject(p.id)}
            >
              <span className="truncate">{p.name}</span>
            </Button>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder={t("domains.picker.newProject")}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <Button type="button" onClick={() => void handleCreateProject()}>
              {t("domains.picker.newProjectButton")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
