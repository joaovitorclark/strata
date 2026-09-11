import { useState, type ReactNode } from "react";
import { Moon, Search, Share2, Sun, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EXPORTERS, exporterCommandId } from "@/features/command-palette/actions";
import {
  applyThemeClass,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeName,
} from "@/features/shell/AppShell";
import type { ExportFormat } from "@/infrastructure/api";
import { cn } from "@/lib/utils";

const ICON_SIZE = 17;
const ICON_STROKE = 1.5;
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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

export type NavbarProps = {
  domain?: string;
  project?: string;
  onSearch?: () => void;
  onExport?: () => void;
  onExportOption?: (format: ExportFormat, dialect?: "spark" | "oracle") => void;
  onPrimaryAction?: () => void;
  onAvatarClick?: () => void;
  onBackToDomains?: () => void;
  leading?: ReactNode;
};

export function Navbar({
  domain = "Domain",
  project = "project",
  onSearch,
  onExport,
  onExportOption,
  onPrimaryAction,
  onAvatarClick,
  onBackToDomains,
  leading,
}: NavbarProps = {}) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<ThemeName>(() => resolveTheme(readStoredTheme()));
  const shortcut = isMacPlatform() ? "⌘K" : "Ctrl+K";
  const nextTheme: ThemeName = theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  const toggleTheme = () => {
    setTheme(nextTheme);
    applyThemeClass(nextTheme);
    persistTheme(nextTheme);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-chrome="navbar"
        data-testid="navbar"
        className={
          "flex h-10 items-center gap-3 border-b border-border bg-sidebar px-3 " +
          "text-sidebar-foreground"
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          <StrataMark />
          <span className="text-base font-semibold tracking-[-0.02em] text-foreground">
            {t("app.name")}
          </span>
          <nav aria-label={t("shell.breadcrumb")} className="ml-3 min-w-0">
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
                "ml-2 inline-flex h-7 shrink-0 items-center rounded-md px-2 text-xs",
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {t("shell.backToDomains")}
            </button>
          ) : null}
          {leading ? <div className="ml-2 flex min-w-0 items-center gap-1.5">{leading}</div> : null}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
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

          <button
            type="button"
            onClick={onPrimaryAction}
            aria-label={t("shell.share")}
            className={cn(
              FOCUS,
              "inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-sm font-medium",
              "text-primary-foreground hover:bg-primary/90",
            )}
          >
            <Share2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            <span className="hidden sm:inline">{t("shell.share")}</span>
          </button>

          <button
            type="button"
            onClick={onAvatarClick}
            aria-label={t("shell.avatar")}
            className={cn(
              FOCUS,
              "inline-flex size-8 items-center justify-center rounded-full",
              "bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            <User size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
