import type { CSSProperties } from "react";

import type { TableMeta } from "@/features/canvas/actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TableInfoPopoverProps = {
  meta: TableMeta;
  style?: CSSProperties;
};

export function TableInfoPopover({ meta, style }: TableInfoPopoverProps) {
  return (
    <div
      className="info-popover z-[1000] max-h-80 w-[260px] overflow-auto rounded-md border border-border bg-popover p-2.5 text-left text-xs text-popover-foreground shadow-md"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {meta.sources.length > 0 && (
        <section>
          <h5 className="mb-0.5 mt-0 text-2xs font-medium text-foreground">Sources (linhagem)</h5>
          <div>derivado de: {meta.sources.join(", ")}</div>
        </section>
      )}
      {meta.sample && (
        <section className="mt-1.5">
          <h5 className="mb-0.5 text-2xs font-medium text-foreground">Exemplo de dados</h5>
          <table className="info-sample w-full border-collapse">
            {meta.sample.columns.length > 0 && (
              <thead>
                <tr>
                  {meta.sample.columns.map((c) => (
                    <th key={c} className="border border-border px-1 text-left font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {meta.sample.rows.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className="border border-border px-1 py-0.5 text-muted-foreground">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {(meta.pks.length > 0 || meta.fks.length > 0 || meta.refsIn.length > 0) && (
        <section className="mt-1.5">
          <h5 className="mb-0.5 text-2xs font-medium text-foreground">PKs / FKs</h5>
          {meta.pks.length > 0 && <div>PK: {meta.pks.join(", ")}</div>}
          {meta.fks.map((f) => (
            <div key={f.column}>
              FK: {f.column} → {f.ref}
            </div>
          ))}
          {meta.refsIn.length > 0 && <div>referenciada por: {meta.refsIn.join(", ")}</div>}
        </section>
      )}
      {(meta.resourceType || meta.materialization || (meta.tags && meta.tags.length > 0)) && (
        <section className="mt-1.5">
          <h5 className="mb-0.5 text-2xs font-medium text-foreground">dbt</h5>
          <div className="dbt-badges flex flex-wrap gap-1">
            {meta.resourceType && (
              <Badge
                variant="secondary"
                className={cn("dbt-badge text-2xs", `dbt-rt-${meta.resourceType}`)}
              >
                {meta.resourceType}
              </Badge>
            )}
            {meta.materialization && (
              <Badge variant="outline" className="dbt-badge dbt-mat text-2xs">
                {meta.materialization}
              </Badge>
            )}
            {meta.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="dbt-badge dbt-tag text-2xs">
                #{tag}
              </Badge>
            ))}
          </div>
        </section>
      )}
      {(meta.note || meta.columnNotes.length > 0) && (
        <section className="mt-1.5">
          <h5 className="mb-0.5 text-2xs font-medium text-foreground">Comentários</h5>
          {meta.note && <div>{meta.note}</div>}
          {meta.columnNotes.map((c) => (
            <div key={c.column}>
              <b>{c.column}:</b> {c.note}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
