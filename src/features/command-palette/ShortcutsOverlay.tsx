import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { usePaletteCommands } from "@/features/command-palette/CommandPalette";
import type { CommandContext } from "@/features/command-palette/actions";
import {
  CANVAS_GESTURES,
  formatShortcut,
  shortcutsFromCommands,
  type ShortcutRow,
} from "@/features/command-palette/gestures";
import type { Command } from "@/features/command-palette/registry";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable], .cm-editor"));
}

function withRedoY(rows: ShortcutRow[], mac: boolean, redoLabel: string): ShortcutRow[] {
  const keys = formatShortcut(mac, { mod: true, key: "Y" });
  if (rows.some((row) => row.keys === keys)) return rows;
  return [...rows, { keys, label: redoLabel }];
}

export type ShortcutsOverlayProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  context: CommandContext;
  commands?: Command[];
};

export function ShortcutsOverlay({
  open: openProp,
  onOpenChange,
  context,
  commands: commandsProp,
}: ShortcutsOverlayProps) {
  const { t } = useTranslation();
  const built = usePaletteCommands(context);
  const commands = commandsProp ?? built;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const dialogRef = useRef<HTMLDivElement>(null);
  const mac = isMacPlatform();

  const setOpen = useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const shortcuts = useMemo(
    () => withRedoY(shortcutsFromCommands(commands, mac), mac, t("command.redo")),
    [commands, mac, t],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?") return;
      if (event.metaKey || event.ctrlKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setOpen(!open);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!dialogRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40"
      role="presentation"
    >
      <div
        ref={dialogRef}
        data-testid="shortcuts-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t("help.title")}
        className={cn(
          "max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg border border-border",
          "bg-card text-card-foreground shadow-lg",
        )}
        tabIndex={-1}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{t("help.title")}</h2>
          <button
            type="button"
            className={cn(FOCUS, "rounded-md px-2 py-1 text-muted-foreground hover:bg-accent")}
            onClick={() => setOpen(false)}
            aria-label={t("help.close")}
          >
            ×
          </button>
        </header>
        <div className="grid max-h-[calc(80vh-3rem)] grid-cols-2 gap-6 overflow-y-auto p-4">
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("help.shortcuts")}
            </h3>
            <ul className="space-y-1.5">
              {shortcuts.map((row) => (
                <li
                  key={`${row.label}-${row.keys}`}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {row.keys}
                  </kbd>
                  <span className="min-w-0 flex-1 text-right text-foreground">{row.label}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("help.gestures")}
            </h3>
            <ul className="space-y-1.5">
              {CANVAS_GESTURES.map((entry) => (
                <li key={entry.gesture} className="flex flex-col gap-0.5 text-sm">
                  <span className="font-medium">{entry.gesture}</span>
                  <span className="text-muted-foreground">{entry.effect}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
