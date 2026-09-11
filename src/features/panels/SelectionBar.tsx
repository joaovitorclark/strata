import { Button } from "@/components/ui/button";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type SelectionBarProps = {
  onRemoveTables?: (ids: string[]) => void;
};

function shortName(id: string): string {
  const dot = id.lastIndexOf(".");
  return dot >= 0 ? id.slice(dot + 1) : id;
}

export function SelectionBar({ onRemoveTables }: SelectionBarProps) {
  const selectedTableIds = useSchemaStore((s) => s.selectedTableIds);
  const selectedColumn = useSchemaStore((s) => s.selectedColumn);
  const setSelectedTableIds = useSchemaStore((s) => s.setSelectedTableIds);
  const clearCanvasSelection = useSchemaStore((s) => s.clearCanvasSelection);

  if (!selectedTableIds.length || selectedColumn) return null;

  const removeOne = (id: string) => {
    const next = selectedTableIds.filter((x) => x !== id);
    if (next.length) setSelectedTableIds(next);
    else clearCanvasSelection();
  };

  return (
    <div
      className={cn(
        "selection-bar pointer-events-auto absolute left-2 top-2 z-10 flex max-w-[min(520px,calc(100%-16px))] flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-card-foreground shadow-md",
      )}
    >
      <span className="selection-bar__label whitespace-nowrap font-semibold">
        {selectedTableIds.length === 1
          ? "1 tabela selecionada"
          : `${selectedTableIds.length} tabelas selecionadas`}
      </span>
      <div className="selection-bar__chips flex flex-wrap gap-1">
        {selectedTableIds.map((id) => (
          <span
            key={id}
            className="selection-bar__chip inline-flex max-w-[140px] items-center gap-0.5 rounded-full border border-border bg-muted px-2 py-0.5"
            title={id}
          >
            <span className="selection-bar__chip-name truncate">{shortName(id)}</span>
            <button
              type="button"
              className={cn("selection-bar__chip-remove px-1 text-sm leading-none", FOCUS)}
              aria-label={`Remover ${id} da seleção`}
              onClick={() => removeOne(id)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {onRemoveTables && selectedTableIds.length >= 1 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("selection-bar__delete h-6 px-1 text-xs text-destructive", FOCUS)}
          onClick={() => {
            const n = selectedTableIds.length;
            if (confirm(`Apagar ${n} tabela(s) selecionada(s) e refs relacionadas?`)) {
              onRemoveTables(selectedTableIds);
            }
          }}
        >
          Apagar selecionadas
        </Button>
      )}
      {selectedTableIds.length > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "selection-bar__clear h-6 px-1 text-xs text-muted-foreground underline",
            FOCUS,
          )}
          onClick={clearCanvasSelection}
        >
          Limpar
        </Button>
      )}
    </div>
  );
}
