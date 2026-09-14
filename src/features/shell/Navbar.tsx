import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Link, Moon, Search, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EXPORTERS, exporterCommandId } from "@/features/command-palette/actions";
import { useSchemaStore } from "@/features/schema/store";
import {
  applyThemeClass,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeName,
} from "@/features/shell/AppShell";
import { HIDDEN_URL_LIMIT, serializeUrlState } from "@/features/shell/urlState";
import { flushUrlSync } from "@/features/shell/useUrlSync";
import type { ExportFormat } from "@/infrastructure/api";
import { cn } from "@/lib/utils";

const ICON_SIZE = 17;
const ICON_STROKE = 1.5;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const BTN =
  FOCUS +
  " inline-flex h-7 shrink-0 items-center rounded-md px-2 text-xs text-foreground " +
  "hover:bg-accent disabled:opacity-40";

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* localStorage may be unavailable */
  }
}

function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

function useWideChrome(minWidth = 1280): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [minWidth]);
  return wide;
}

function StrataMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={20}
      height={20}
      aria-hidden
      className="shrink-0 text-primary"
    >
      <g fill="currentColor">
        <path d="M16 4.4 30 8 16 11.6 2 8Z" />
        <path d="M16 12.4 30 16 16 19.6 2 16Z" opacity="0.72" />
        <path d="M16 20.4 30 24 16 27.6 2 24Z" opacity="0.45" />
      </g>
    </svg>
  );
}

export type NavbarHistory = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export type NavbarEditActions = {
  onAddTable: () => void;
  onAddMetadata: () => void;
  onImport: () => void;
  onOrganize: () => void;
};

export type NavbarSave = {
  label: string;
  state: string;
  autoSave: boolean;
  onSave: () => void;
  onToggleAutoSave: () => void;
  onDiff: () => void;
};

export type NavbarProps = {
  domain?: string;
  project?: string;
  onSearch?: () => void;
  onExport?: () => void;
  onExportOption?: (format: ExportFormat, dialect?: "spark" | "oracle") => void;
  onBackToDomains?: () => void;
  leading?: ReactNode;
  history?: NavbarHistory;
  editActions?: NavbarEditActions;
  save?: NavbarSave;
  onHelp?: () => void;
};

export function Navbar({
  domain = "Domain",
  project = "project",
  onSearch,
  onExport,
  onExportOption,
  onBackToDomains,
  leading,
  history,
  editActions,
  save,
  onHelp,
}: NavbarProps = {}) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<ThemeName>(() => resolveTheme(readStoredTheme()));
  const shortcut = isMacPlatform() ? "⌘K" : "Ctrl+K";
  const nextTheme: ThemeName = theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const wide = useWideChrome();
  const selectedTable = useSchemaStore((s) => s.selectedTable);
  const hiddenCount = useSchemaStore((s) => s.hiddenTableIds.length);
  const omitHidden = hiddenCount > HIDDEN_URL_LIMIT;

  const toggleTheme = () => {
    setTheme(nextTheme);
    applyThemeClass(nextTheme);
    persistTheme(nextTheme);
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      toast.success(t("shell.linkCopied"));
    } catch {
      /* clipboard may be unavailable */
    }
  };

  const copyCurrentLink = () => {
    flushUrlSync();
    void copyText(window.location.href);
  };

  const copyTableLink = () => {
    const store = useSchemaStore.getState();
    if (!store.selectedTable) return;
    const href = serializeUrlState(
      {
        project: store.currentProjectId || undefined,
        detail: store.detailLevel,
        focus: store.selectedTable,
      },
      `${window.location.origin}${window.location.pathname}`,
    );
    void copyText(href);
  };

  const copyViewLink = () => {
    flushUrlSync();
    void copyText(window.location.href);
  };

  const editButtons = editActions ? (
    <>
      <button type="button" className={BTN} onClick={editActions.onAddTable}>
        {t("shell.addTable")}
      </button>
      <button type="button" className={BTN} onClick={editActions.onAddMetadata}>
        {t("shell.addMetadata")}
      </button>
      <button type="button" className={BTN} onClick={editActions.onImport}>
        {t("shell.importInput")}
      </button>
      <button type="button" className={BTN} onClick={editActions.onOrganize}>
        {t("shell.organizeDbml")}
      </button>
    </>
  ) : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-chrome="navbar"
        data-testid="navbar"
        className={
          "flex h-10 flex-nowrap items-center gap-2 overflow-hidden border-b border-border " +
          "bg-sidebar px-3 text-sidebar-foreground"
        }
      >
        <div className="flex min-w-0 shrink items-center gap-2">
          <StrataMark />
          <span className="text-base font-semibold tracking-[-0.02em] text-foreground">
            {t("app.name")}
          </span>
          <nav aria-label={t("shell.breadcrumb")} className="ml-2 min-w-0">
            <ol className="flex items-center gap-1.5 text-sm">
              <li className="truncate text-muted-foreground">{domain}</li>
              <li aria-hidden className="text-muted-foreground">
                /
              </li>
              <li className="truncate text-foreground">{project}</li>
            </ol>
          </nav>
          {onBackToDomains ? (
            <button
              type="button"
              onClick={onBackToDomains}
              aria-label={t("shell.backToDomains")}
              className={cn(
                FOCUS,
                "ml-1 inline-flex h-7 shrink-0 items-center rounded-md px-2 text-xs",
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {t("shell.backToDomains")}
            </button>
          ) : null}
          {leading ? <div className="ml-1 flex min-w-0 items-center gap-1.5">{leading}</div> : null}
        </div>

        {history ? (
          <>
            <Separator orientation="vertical" className="h-5 shrink-0" />
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                className={BTN}
                onClick={history.onUndo}
                disabled={!history.canUndo}
                aria-label={t("shell.undo")}
              >
                {t("shell.undo")}
              </button>
              <button
                type="button"
                className={BTN}
                onClick={history.onRedo}
                disabled={!history.canRedo}
                aria-label={t("shell.redo")}
              >
                {t("shell.redo")}
              </button>
            </div>
          </>
        ) : null}

        {editActions ? (
          <>
            <Separator orientation="vertical" className="h-5 shrink-0" />
            {wide ? (
              <div className="flex shrink-0 items-center gap-0.5">{editButtons}</div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={BTN} aria-label={t("shell.more")}>
                    {t("shell.more")}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={editActions.onAddTable}>
                    {t("shell.addTable")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={editActions.onAddMetadata}>
                    {t("shell.addMetadata")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={editActions.onImport}>
                    {t("shell.importInput")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={editActions.onOrganize}>
                    {t("shell.organizeDbml")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onSearch}
                aria-keyshortcuts={isMacPlatform() ? "Meta+K" : "Control+K"}
                aria-label={t("shell.search")}
                className={cn(
                  FOCUS,
                  "inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2",
                  "text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Search size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                <span className="hidden sm:inline">{t("shell.search")}</span>
                <kbd className="rounded-sm border border-border bg-muted px-1 text-2xs text-muted-foreground">
                  {shortcut}
                </kbd>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("shell.search")}</TooltipContent>
          </Tooltip>

          {save ? (
            <>
              <Separator orientation="vertical" className="h-5 shrink-0" />
              <button
                type="button"
                className={BTN}
                onClick={save.onDiff}
                aria-label={t("shell.diff")}
              >
                {t("shell.diff")}
              </button>
              <button
                type="button"
                data-testid="navbar-save"
                className={BTN}
                onClick={save.onSave}
                aria-label={t("shell.save")}
                disabled={save.state === "saving" || save.state === "saved"}
              >
                {save.label}
              </button>
              <label className="inline-flex shrink-0 items-center gap-1 text-xs">
                <Switch
                  checked={save.autoSave}
                  onCheckedChange={() => save.onToggleAutoSave()}
                  aria-label={t("shell.autosave")}
                />
                <span className="sr-only">{t("shell.autosave")}</span>
              </label>
            </>
          ) : null}

          <div className="flex shrink-0 items-center">
            <button
              type="button"
              data-testid="copy-link"
              aria-label={t("shell.copyLink")}
              className={cn(
                FOCUS,
                "inline-flex h-8 items-center gap-1.5 rounded-l-md border border-input bg-background px-2.5",
                "text-sm hover:bg-accent hover:text-accent-foreground",
              )}
              onClick={copyCurrentLink}
            >
              <Link size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              {t("shell.copyLink")}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="copy-link-menu"
                  aria-label={t("shell.copyLinkMenu")}
                  className={cn(
                    FOCUS,
                    "inline-flex h-8 items-center rounded-r-md border border-l-0 border-input bg-background px-1.5",
                    "text-sm hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <ChevronDown size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" data-testid="copy-link-menu-content">
                <DropdownMenuItem disabled={!selectedTable} onSelect={copyTableLink}>
                  {t("shell.copyLinkTable")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={copyViewLink}>
                  {t("shell.copyLinkView")}
                </DropdownMenuItem>
                {omitHidden ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t("shell.copyLinkHiddenWarning")}
                  </p>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {onExportOption ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("shell.export")}
                  className={cn(
                    FOCUS,
                    "inline-flex h-8 items-center gap-1.5 rounded-md border border-input",
                    "bg-background px-2.5 text-sm hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {t("shell.export")}
                  <span className="rounded-sm bg-primary/15 px-1.5 py-px text-2xs font-medium text-primary">
                    {t("shell.exportFormatDbt")}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-64" data-testid="export-menu">
                {EXPORTERS.map((exporter) => (
                  <DropdownMenuItem
                    key={exporterCommandId(exporter)}
                    onSelect={() => {
                      onExportOption(
                        exporter.id,
                        "dialect" in exporter ? exporter.dialect : undefined,
                      );
                    }}
                  >
                    {t(exporter.labelKey)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              onClick={onExport}
              aria-label={t("shell.export")}
              className={cn(
                FOCUS,
                "inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5",
                "text-sm hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {t("shell.export")}
              <span className="rounded-sm bg-primary/15 px-1.5 py-px text-2xs font-medium text-primary">
                {t("shell.exportFormatDbt")}
              </span>
            </button>
          )}

          {onHelp ? (
            <button
              type="button"
              onClick={onHelp}
              aria-label={t("shell.help")}
              className={cn(
                FOCUS,
                "inline-flex size-8 items-center justify-center rounded-md text-foreground",
                "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              ?
            </button>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={t("shell.themeToggle")}
                aria-pressed={theme === "dark"}
                className={cn(
                  FOCUS,
                  "inline-flex size-8 items-center justify-center rounded-md text-foreground",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <ThemeIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t(`theme.${nextTheme}`)}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {typeof window !== "undefined" && typeof window.matchMedia === "function" ? (
        <Toaster />
      ) : null}
    </TooltipProvider>
  );
}
