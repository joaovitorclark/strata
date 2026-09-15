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

export type ColumnDep = { kind: "fk" | "lineage"; label: string };

type Props = {
  open: boolean;
  column: string;
  deps: ColumnDep[];
  onConfirm: () => void;
  onCancel: () => void;
};

export function ColumnDeleteDialog({ open, column, deps, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent data-testid="column-deps-dialog">
        <DialogHeader>
          <DialogTitle>{t("canvas.node.deleteColumnTitle", { column })}</DialogTitle>
          <DialogDescription>{t("canvas.node.deleteColumnDeps")}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-4 font-mono text-xs">
          {deps.map((d) => (
            <li key={`${d.kind}:${d.label}`}>{d.label}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="column-deps-cancel"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            data-testid="column-deps-confirm"
            onClick={onConfirm}
          >
            {t("canvas.node.deleteColumnConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
