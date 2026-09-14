import { useTranslation } from "react-i18next";

import type { TableMeta } from "@/features/canvas/actions";
import { cn } from "@/lib/utils";

import { FOCUS, formatFkTarget, tableFromRef } from "./types";

type RelationsSectionProps = {
  meta: TableMeta;
  onFocusTable?: (tableId: string) => void;
};

export function RelationsSection({ meta, onFocusTable }: RelationsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="text-[11px] font-medium text-muted-foreground">
          {t("shell.inspector.outgoing")}
        </h4>
        <ul className="mt-1 flex flex-col gap-1">
          {meta.fks.map((fk) => {
            const target = tableFromRef(fk.ref);
            return (
              <li key={fk.column}>
                <button
                  type="button"
                  data-testid={`inspector-ref-out-${target}`}
                  className={cn(
                    FOCUS,
                    "w-full text-left font-mono text-xs text-foreground hover:underline",
                  )}
                  onClick={() => onFocusTable?.(target)}
                >
                  {fk.column} → {formatFkTarget(fk.ref)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h4 className="text-[11px] font-medium text-muted-foreground">
          {t("shell.inspector.incoming")}
        </h4>
        <ul className="mt-1 flex flex-col gap-1">
          {meta.refsIn.map((tableId) => (
            <li key={tableId}>
              <button
                type="button"
                data-testid={`inspector-ref-in-${tableId}`}
                className={cn(
                  FOCUS,
                  "w-full text-left font-mono text-xs text-foreground hover:underline",
                )}
                onClick={() => onFocusTable?.(tableId)}
              >
                {tableId}
              </button>
            </li>
          ))}
        </ul>
        {meta.refsIn.length > 0 ? (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {t("shell.inspector.referencedBy")}: {meta.refsIn.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
