import { useMemo } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  saved: string;
  working: string;
  open: boolean;
  onClose: () => void;
};

type DiffLine = { kind: "same" | "add" | "del"; text: string };

function diffLines(saved: string, working: string): DiffLine[] {
  const a = saved.split("\n");
  const b = working.split("\n");
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) lcs[i][j] = lcs[i + 1][j + 1] + 1;
      else lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "del", text: a[i] });
      i++;
    } else {
      out.push({ kind: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) {
    out.push({ kind: "del", text: a[i] });
    i++;
  }
  while (j < n) {
    out.push({ kind: "add", text: b[j] });
    j++;
  }
  return out;
}

export function DbmlDiff({ saved, working, open, onClose }: Props) {
  const { t } = useTranslation();
  const lines = useMemo(() => (open ? diffLines(saved, working) : []), [saved, working, open]);
  const counts = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const l of lines) {
      if (l.kind === "add") add++;
      else if (l.kind === "del") del++;
    }
    return { add, del };
  }, [lines]);
  if (!open) return null;
  return (
    <div
      className="flex min-h-0 flex-1 flex-col border-t border-border bg-card"
      role="dialog"
      aria-label={t("source.diffTitle")}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <strong className="text-sm">{t("source.diffTitle")}</strong>
        <span className="font-mono text-xs">
          <span className="text-success">+{counts.add}</span>{" "}
          <span className="text-destructive">-{counts.del}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X className="size-[14px]" strokeWidth={1.5} />
        </Button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto font-mono text-xs">
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2 px-2",
              l.kind === "add" && "bg-success/15 text-success",
              l.kind === "del" && "bg-destructive/15 text-destructive",
              l.kind === "same" && "text-muted-foreground",
            )}
          >
            <span className="w-3 shrink-0">
              {l.kind === "add" ? "+" : l.kind === "del" ? "-" : " "}
            </span>
            <span>{l.text || "\u00a0"}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
