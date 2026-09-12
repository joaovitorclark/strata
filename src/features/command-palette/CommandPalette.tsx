import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { CanvasActionsCtx } from "@/features/canvas/actions";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";
import { commandsFromContext, type CommandContext } from "@/features/command-palette/actions";
import {
  filterCommands,
  type Command as PaletteCommand,
} from "@/features/command-palette/registry";

export type CommandPaletteProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  context: CommandContext;
  commands?: PaletteCommand[];
};

export function usePaletteCommands(ctx: CommandContext): PaletteCommand[] {
  const { t } = useTranslation();
  const lineageMode = useSchemaStore((s) => s.lineageMode);
  const canvasActions = useContext(CanvasActionsCtx);
  return useMemo(
    () =>
      commandsFromContext(
        { ...ctx, lineageMode: ctx.lineageMode ?? lineageMode },
        t,
        canvasActions,
      ),
    [canvasActions, ctx, lineageMode, t],
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable], .cm-editor"));
}

export function CommandPalette({
  open: openProp,
  onOpenChange,
  context,
  commands: commandsProp,
}: CommandPaletteProps) {
  const built = usePaletteCommands(context);
  const commands = commandsProp ?? built;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open) {
          e.preventDefault();
          setOpen(false);
          return;
        }
        if (isTypingTarget(e.target)) return;
        useSchemaStore.getState().clearCanvasSelection();
        context.closeModals?.();
        return;
      }

      if (e.key === "Delete" && !e.metaKey && !e.ctrlKey) {
        if (open || isTypingTarget(e.target)) return;
        const handled = Boolean(context.removeSelectedRef?.());
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        context.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        e.stopPropagation();
        context.redo();
      } else if (k === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (!context.renameModalOpen) void context.save();
      } else if (k === "k") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, context, setOpen]);

  if (!open) return null;

  return <PaletteDialog commands={commands} onClose={() => setOpen(false)} />;
}

function PaletteDialog({ commands, onClose }: { commands: PaletteCommand[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => filterCommands(commands, query, 12), [commands, query]);
  const safeIndex = results.length ? Math.min(selectedIndex, results.length - 1) : 0;

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!dialogRef.current?.contains(target)) onClose();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [onClose]);

  const runCommand = (command: PaletteCommand) => {
    void command.run();
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex(results.length ? (safeIndex + 1) % results.length : 0);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex(results.length ? (safeIndex - 1 + results.length) % results.length : 0);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const command = results[safeIndex];
      if (command) runCommand(command);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 pt-[15vh]"
      role="presentation"
    >
      <div
        ref={dialogRef}
        data-testid="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.ariaLabel")}
        className={cn(
          "w-full max-w-xl overflow-hidden rounded-lg border border-border bg-popover",
          "text-popover-foreground shadow-lg",
        )}
      >
        <Command
          shouldFilter={false}
          loop
          label={t("palette.ariaLabel")}
          value={results[safeIndex]?.id ?? ""}
          onValueChange={(id) => {
            const index = results.findIndex((command) => command.id === id);
            if (index >= 0) setSelectedIndex(index);
          }}
          className="bg-popover"
        >
          <CommandInput
            value={query}
            onValueChange={(value) => {
              setQuery(value);
              setSelectedIndex(0);
            }}
            placeholder={t("palette.placeholder")}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            <CommandEmpty>{t("palette.empty")}</CommandEmpty>
            <CommandGroup>
              {results.map((command) => {
                const isColumn = command.kind === "column";
                const labelParts = isColumn ? command.label.split(".") : null;
                const columnName = labelParts ? labelParts[labelParts.length - 1] : "";
                const tableLabel = isColumn
                  ? command.label.slice(0, command.label.length - columnName.length - 1)
                  : "";
                return (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    onSelect={() => {
                      runCommand(command);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {isColumn ? (
                        <>
                          <span className="text-muted-foreground">{tableLabel}</span>
                          <span className="text-muted-foreground">.</span>
                          <span>{columnName}</span>
                        </>
                      ) : (
                        command.label
                      )}
                    </span>
                    {command.shortcut ? (
                      <CommandShortcut>{command.shortcut}</CommandShortcut>
                    ) : null}
                    <span className="text-2xs text-muted-foreground">
                      {t(`palette.kind.${command.kind}`)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>,
    document.body,
  );
}
