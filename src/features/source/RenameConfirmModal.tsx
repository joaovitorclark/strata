import { useTranslation } from "react-i18next";
import type { RenameImpact } from "@/features/schema/model/reconcile";
import { Button } from "@/components/ui/button";

type Props = {
  impacts: RenameImpact[];
  onApply: () => void;
  onKeepSeparate: () => void;
  onClose: () => void;
};

function label(i: RenameImpact): string {
  const r = i.rename;
  return r.kind === "table" ? `${r.oldId} → ${r.newId}` : `${r.table}.${r.oldCol} → ${r.newCol}`;
}

export function RenameConfirmModal({ impacts, onApply, onKeepSeparate, onClose }: Props) {
  const { t } = useTranslation();
  const total = impacts.reduce((a, i) => a + i.refCount, 0);
  return (
    <div
      data-testid="rename-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-modal-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="rename-modal-title" className="text-lg font-semibold">
          {t("source.rename.title")}
        </h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 font-mono text-sm">
          {impacts.map((i, idx) => (
            <li key={idx}>
              {label(i)} — {t("source.rename.refs", { count: i.refCount })}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("source.rename.hint", { count: total })}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" onClick={onApply}>
            {t("source.rename.apply")}
          </Button>
          <Button type="button" variant="outline" onClick={onKeepSeparate}>
            {t("source.rename.keepSeparate")}
          </Button>
        </div>
      </div>
    </div>
  );
}
