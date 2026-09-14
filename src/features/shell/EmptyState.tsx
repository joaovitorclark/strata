import { useCallback, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pasteToDbml } from "@/features/shell/pasteSource";

export type EmptyStateProps = {
  onApply: (dbml: string) => void;
  onImport: () => void;
  onAddTable: () => void;
};

export function EmptyState({ onApply, onImport, onAddTable }: EmptyStateProps) {
  const { t } = useTranslation();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reasonMessage = useCallback(
    (reason: "unsupported" | "invalid" | "empty") => {
      if (reason === "unsupported") return t("shell.empty.unsupported");
      if (reason === "empty") return t("shell.empty.emptyPaste");
      return t("shell.empty.invalid");
    },
    [t],
  );

  const applyText = useCallback(
    (text: string) => {
      const result = pasteToDbml(text);
      if (!result.ok) {
        setError(reasonMessage(result.reason));
        return;
      }
      setError(null);
      setPasteOpen(false);
      setDraft("");
      onApply(result.dbml);
    },
    [onApply, reasonMessage],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (!file) return;
      void file.text().then((text) => applyText(text));
    },
    [applyText],
  );

  return (
    <div
      data-testid="workspace-empty-state"
      className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-6 bg-background px-6"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={onDrop}
    >
      <div className="flex max-w-xl flex-col items-center gap-2 text-center">
        <p className="text-2xl leading-none text-primary" aria-hidden>
          ◆
        </p>
        <h1 className="text-lg font-medium text-foreground">{t("shell.empty.title")}</h1>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="empty-paste"
          onClick={() => {
            setError(null);
            setPasteOpen(true);
          }}
        >
          {t("shell.empty.paste")}
        </Button>
        <Button type="button" variant="outline" data-testid="empty-import-dbt" onClick={onImport}>
          {t("shell.empty.importDbt")}
        </Button>
        <Button type="button" data-testid="empty-add-table" onClick={onAddTable}>
          {t("shell.addTable")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("shell.empty.dropHint")}</p>
      {error && !pasteOpen ? (
        <p
          data-testid="empty-paste-error"
          className="max-w-md text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("shell.empty.pasteTitle")}</DialogTitle>
            <DialogDescription>{t("shell.empty.pasteHint")}</DialogDescription>
          </DialogHeader>
          <textarea
            data-testid="empty-paste-input"
            className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
          />
          {error && pasteOpen ? (
            <p data-testid="empty-paste-error" className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPasteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" data-testid="empty-paste-apply" onClick={() => applyText(draft)}>
              {t("shell.empty.applyPaste")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
