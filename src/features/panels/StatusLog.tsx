import { useEffect, useRef, useState } from "react";
import { Check, Circle, CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { statusLabel, type SaveState, type StatusIcon } from "@/features/canvas/utils/statusLabel";
import { cn } from "@/lib/utils";

export type StatusLogEntry = { ts: number; msg: string };

export type { SaveState, StatusIcon };

type Props = {
  status: string;
  saveState: SaveState;
  logs: StatusLogEntry[];
};

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SAVE_TONE: Record<SaveState, string> = {
  idle: "text-muted-foreground",
  dirty: "text-warning",
  saving: "text-muted-foreground",
  saved: "text-success",
  error: "text-destructive",
};

const fmtTime = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

function StatusIconView({ icon }: { icon: StatusIcon }) {
  if (icon === "warning") return <CircleAlert size={14} strokeWidth={1.5} />;
  if (icon === "dot") return <Circle size={10} strokeWidth={0} className="fill-current" />;
  if (icon === "check") return <Check size={14} strokeWidth={1.5} />;
  return null;
}

// v15-04: área de status vira botão → dropdown com os últimos 100 logs (mais recente no topo).
// Sem persistência (memória de sessão). Fecha ao clicar fora (padrão das paletas).
export function StatusLog({ status, saveState, logs }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const { text, cls, icon } = statusLabel(saveState, status);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.(".status-log__pop")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]);

  return (
    <TooltipProvider delayDuration={300}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                ref={btnRef}
                type="button"
                className={cn(
                  FOCUS,
                  cls,
                  SAVE_TONE[saveState],
                  "inline-flex h-6 max-w-80 items-center justify-end gap-1 rounded-md px-1.5 text-xs",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  open && "bg-sidebar-accent",
                )}
              >
                <StatusIconView icon={icon} />
                {text}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{t("panels.statusLog.tooltip")}</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="end"
          sideOffset={4}
          className="status-log__pop max-h-80 w-80 overflow-y-auto p-0"
        >
          {logs.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
              {t("panels.statusLog.empty")}
            </div>
          ) : (
            <ul className="py-1">
              {logs.map((entry, i) => (
                <li
                  key={`${entry.ts}-${i}`}
                  className="flex gap-2 px-2.5 py-1 text-xs hover:bg-accent"
                >
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {fmtTime(entry.ts)}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{entry.msg}</span>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

export type StatusLogProps = Props;
