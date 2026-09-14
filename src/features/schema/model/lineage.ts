import type { LineageLink } from '@/infrastructure/api/types';
import type { ParsedFieldLineage } from './dbmlClean';

export type TableLineageEntry = { target: string; sources: string[] };

/**
 * Derives table→table lineage from field mappings.
 * A table has lineage iff at least one of its fields is mapped.
 * Self-mappings (same source and target table) are excluded.
 */
export function tableLineageFrom(fields: ParsedFieldLineage[]): TableLineageEntry[] {
  const byTarget = new Map<string, Set<string>>();
  for (const f of fields) {
    if (!f.sourceTable || !f.targetTable) continue;
    if (f.sourceTable === f.targetTable) continue;
    let sources = byTarget.get(f.targetTable);
    if (!sources) {
      sources = new Set();
      byTarget.set(f.targetTable, sources);
    }
    sources.add(f.sourceTable);
  }
  return [...byTarget.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([target, sources]) => ({ target, sources: [...sources].sort() }));
}

/** Adiciona uma ligação de linhagem (sem duplicata nem self-loop). */
export function addLineage(list: LineageLink[], source: string, target: string): LineageLink[] {
  if (!source || !target || source === target) return list;
  if (list.some((l) => l.source === source && l.target === target)) return list;
  return [...list, { source, target }];
}

/** Remove uma ligação de linhagem (qualquer direção informada). */
export function removeLineage(list: LineageLink[], source: string, target: string): LineageLink[] {
  return list.filter((l) => !(l.source === source && l.target === target));
}

/** Converte um lineage.json ({ "tabela": ["origem", ...] }) em pares {source,target}. */
export function lineageFromJson(obj: Record<string, string[]>): LineageLink[] {
  const out: LineageLink[] = [];
  for (const [target, sources] of Object.entries(obj)) {
    for (const s of sources) out.push({ source: s, target });
  }
  return out;
}
