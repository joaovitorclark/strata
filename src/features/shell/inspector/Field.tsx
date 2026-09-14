import type { ReactNode } from "react";

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section data-field={id} className="space-y-1">
      <h3 className="text-[11px] font-medium text-muted-foreground">{label}</h3>
      {children}
    </section>
  );
}
