import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Pencil, Pin, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProjectMeta } from "@/infrastructure/api";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_SIZE = 14;
const ICON_STROKE = 1.5;

type Props = {
  projects: ProjectMeta[];
  currentProjectId: string;
  saveState: "idle" | "dirty" | "saving" | "saved" | "error";
  onSwitch: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string, name?: string) => void;
  onDelete: (id: string) => void;
  pinnedLabel?: string;
};

export function ProjectSwitcher({
  projects,
  currentProjectId,
  saveState,
  onSwitch,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  pinnedLabel,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = projects.find((p) => p.id === currentProjectId);

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

  const handleCreate = () => {
    const name = window.prompt(t("projects.createPrompt"));
    if (!name?.trim()) return;
    setOpen(false);
    onCreate(name.trim());
  };

  const handleRename = (proj: ProjectMeta) => {
    const name = window.prompt(t("projects.renamePrompt"), proj.name);
    if (!name?.trim() || name.trim() === proj.name) return;
    setOpen(false);
    onRename(proj.id, name.trim());
  };

  const handleDuplicate = (proj: ProjectMeta) => {
    const name = window.prompt(
      t("projects.duplicatePrompt"),
      t("projects.duplicateDefault", { name: proj.name }),
    );
    if (name === null) return;
    setOpen(false);
    onDuplicate(proj.id, name.trim() || undefined);
  };

  const handleDelete = (proj: ProjectMeta) => {
    const confirmed = window.confirm(t("projects.deleteConfirm", { name: proj.name }));
    if (!confirmed) return;
    setOpen(false);
    onDelete(proj.id);
  };

  const handleSwitch = (id: string) => {
    setOpen(false);
    if (id !== currentProjectId) onSwitch(id);
  };

  const isDirty = saveState === "dirty";

  if (pinnedLabel) {
    return (
      <TooltipProvider delayDuration={300}>
        <div
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-sidebar px-2.5 py-1 font-semibold"
          title={t("projects.pinnedTitle")}
          data-project-switcher="pinned"
        >
          <Pin size={ICON_SIZE} strokeWidth={ICON_STROKE} className="text-primary" aria-hidden />
          <span className="max-w-[160px] truncate">{pinnedLabel}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={t("projects.renameProject")}
                onClick={() => current && handleRename(current)}
                disabled={!current}
              >
                <Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("projects.renameProject")}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  void handleCreate;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative inline-block" ref={rootRef} data-project-switcher>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-w-[180px] gap-1.5"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {isDirty ? (
                <span
                  className="size-2 shrink-0 rounded-full bg-warning"
                  aria-label={t("projects.unsaved")}
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate">{current?.name ?? "…"}</span>
              <ChevronDown size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("projects.switch")}</TooltipContent>
        </Tooltip>

        {open && (
          <div
            className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[240px] rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
            role="menu"
          >
            <div className="max-h-[280px] overflow-y-auto">
              {projects.map((proj) => {
                const isActive = proj.id === currentProjectId;
                return (
                  <div
                    key={proj.id}
                    className={cn(
                      "group flex items-center gap-1 px-1 py-0.5 hover:bg-accent",
                      isActive && "bg-primary/10",
                    )}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1.5 text-left text-sm",
                        isActive && "font-semibold text-primary",
                      )}
                      onClick={() => handleSwitch(proj.id)}
                    >
                      <span className="inline-flex w-3.5 shrink-0" aria-hidden>
                        {isActive ? <Check size={ICON_SIZE} strokeWidth={ICON_STROKE} /> : null}
                      </span>
                      <span className="truncate">{proj.name}</span>
                    </button>
                    <div className="flex shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={t("projects.rename")}
                            onClick={() => handleRename(proj)}
                          >
                            <Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{t("projects.rename")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={t("projects.duplicate")}
                            onClick={() => handleDuplicate(proj)}
                          >
                            <Copy size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{t("projects.duplicate")}</TooltipContent>
                      </Tooltip>
                      {projects.length > 1 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 hover:text-destructive"
                              aria-label={t("projects.delete")}
                              onClick={() => handleDelete(proj)}
                            >
                              <X size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">{t("projects.delete")}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-1 border-t border-border pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-1.5"
                onClick={() => current && handleRename(current)}
                disabled={!current}
              >
                <Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                {t("projects.renameProject")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
