import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ALL_PAGE_ID } from "@/features/canvas/utils/scaleLimits";
import type { CanvasPage } from "@/infrastructure/api";

type Props = {
  open: boolean;
  tableCount: number;
  pages: CanvasPage[];
  onConfirm: (pageIds: string[]) => void;
  onDismiss: () => void;
};

/** Wizard pós-import: escolher assuntos (TableGroups) antes de montar o canvas. */
export function PageImportWizard({ open, tableCount, pages, onConfirm, onDismiss }: Props) {
  const { t } = useTranslation();
  const selectable = useMemo(() => pages.filter((p) => p.id !== ALL_PAGE_ID), [pages]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelected(new Set());
      setShowAll(false);
    }
  }

  const toggleAll = (checked: boolean) => {
    setShowAll(checked);
    if (checked) setSelected(new Set());
  };

  const togglePage = (pageId: string, checked: boolean) => {
    setShowAll(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(pageId);
      else next.delete(pageId);
      return next;
    });
  };

  const canConfirm = showAll || selected.size > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent className="max-w-lg bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle id="page-wizard-title">
            {t("panels.pageImport.title", { count: tableCount })}
          </DialogTitle>
          <DialogDescription>{t("panels.pageImport.body")}</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("panels.pageImport.legend")}</legend>
          <div className="flex items-center gap-2">
            <Checkbox
              id="page-wizard-all"
              checked={showAll}
              onCheckedChange={(value) => toggleAll(value === true)}
            />
            <Label htmlFor="page-wizard-all" className="font-normal">
              {t("panels.pageImport.allTables")}
            </Label>
          </div>
          {selectable.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <Checkbox
                id={`page-wizard-${p.id}`}
                checked={!showAll && selected.has(p.id)}
                disabled={showAll}
                onCheckedChange={(value) => togglePage(p.id, value === true)}
              />
              <Label htmlFor={`page-wizard-${p.id}`} className="font-normal">
                {p.name}
              </Label>
            </div>
          ))}
        </fieldset>
        <DialogFooter>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(showAll ? [ALL_PAGE_ID] : [...selected])}
          >
            {t("panels.pageImport.openCanvas")}
          </Button>
          <Button type="button" variant="outline" onClick={onDismiss}>
            {t("panels.pageImport.later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type PageImportWizardProps = Props;
