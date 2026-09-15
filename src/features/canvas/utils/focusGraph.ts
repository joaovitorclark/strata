import type { ParsedFieldLineage } from "@/features/schema/model/parse";

export type FocusDirection = "up" | "down" | "both";
export type FocusLinkKind = "fk" | "lineage" | "both";
export type FocusHops = number | "all";

export type FocusRef = { source: string; target: string };

export type FocusTablesInput = {
  seeds: string[];
  hops: FocusHops;
  direction: FocusDirection;
  kind: FocusLinkKind;
  refs: FocusRef[];
  lineageFields: ParsedFieldLineage[];
  hidden?: ReadonlySet<string>;
};

export type TraceColumn = { table: string; column: string; depth: number };

export type TraceFieldResult = {
  columns: TraceColumn[];
  edges: string[];
  cycle: boolean;
};

export const FOCUS_REST_OPACITY = 0.15;

export const FOCUS_HOP_STEPS: FocusHops[] = [1, 2, 3, "all"];

export type SchemaFocus =
  | { kind: "tables"; seeds: string[]; hops: FocusHops; direction: FocusDirection }
  | { kind: "field"; table: string; column: string };

export function columnHasLineage(
  table: string,
  column: string,
  lineageFields: ParsedFieldLineage[],
): boolean {
  return lineageFields.some(
    (m) =>
      (m.sourceTable === table && m.sourceColumn === column) ||
      (m.targetTable === table && m.targetColumn === column),
  );
}

export function resolveFocusedTables(
  focus: SchemaFocus | null,
  opts: {
    refs: FocusRef[];
    lineageFields: ParsedFieldLineage[];
    relationsVisible: boolean;
    lineageVisible: boolean;
    hidden?: ReadonlySet<string>;
  },
): Set<string> | null {
  if (!focus) return null;
  if (focus.kind === "field") {
    return new Set(
      traceField({
        table: focus.table,
        column: focus.column,
        lineageFields: opts.lineageFields,
      }).columns.map((c) => c.table),
    );
  }
  const kind = linkKindFromEdgeVisibility(opts.relationsVisible, opts.lineageVisible);
  if (!kind) return new Set(focus.seeds);
  return focusTables({
    seeds: focus.seeds,
    hops: focus.hops,
    direction: focus.direction,
    kind,
    refs: opts.refs,
    lineageFields: opts.lineageFields,
    hidden: opts.hidden,
  });
}

export function bumpFocusHops(hops: FocusHops, delta: 1 | -1): FocusHops {
  const i = FOCUS_HOP_STEPS.indexOf(hops);
  const idx = i < 0 ? 0 : i;
  const next = Math.min(FOCUS_HOP_STEPS.length - 1, Math.max(0, idx + delta));
  return FOCUS_HOP_STEPS[next] ?? 1;
}

export function linkKindFromEdgeVisibility(
  relationsVisible: boolean,
  lineageVisible: boolean,
): FocusLinkKind | null {
  if (relationsVisible && lineageVisible) return "both";
  if (relationsVisible) return "fk";
  if (lineageVisible) return "lineage";
  return null;
}

export function fieldLineageEdgeId(m: {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}): string {
  return `fl:${m.sourceTable}.${m.sourceColumn}->${m.targetTable}.${m.targetColumn}`;
}

function colKey(table: string, column: string): string {
  return `${table}\u0000${column}`;
}

const EMPTY_NEIGHBORS: string[] = [];

function addNeighbor(sets: Map<string, Set<string>>, from: string, to: string): void {
  if (!from || !to || from === to) return;
  let bucket = sets.get(from);
  if (!bucket) {
    bucket = new Set();
    sets.set(from, bucket);
  }
  bucket.add(to);
}

/** Index FK + lineage once, then BFS over unique neighbors (O(V+E), no per-hop scans). */
function adjacency(input: FocusTablesInput): Map<string, string[]> {
  const sets = new Map<string, Set<string>>();
  const wantUp = input.direction === "up" || input.direction === "both";
  const wantDown = input.direction === "down" || input.direction === "both";
  const useFk = input.kind === "fk" || input.kind === "both";
  const useLin = input.kind === "lineage" || input.kind === "both";

  if (useFk) {
    for (const ref of input.refs) {
      if (wantUp) addNeighbor(sets, ref.source, ref.target);
      if (wantDown) addNeighbor(sets, ref.target, ref.source);
    }
  }
  if (useLin) {
    for (const m of input.lineageFields) {
      if (wantUp) addNeighbor(sets, m.targetTable, m.sourceTable);
      if (wantDown) addNeighbor(sets, m.sourceTable, m.targetTable);
    }
  }

  const adj = new Map<string, string[]>();
  for (const [id, bucket] of sets) adj.set(id, [...bucket]);
  return adj;
}

export function focusTables(input: FocusTablesInput): Set<string> {
  // "both" is the union of the upstream and downstream closures. Walking one graph with edges in
  // both directions would climb to a parent and descend to its other children, which with hops ≥ 2
  // swallows siblings and, at "all", the whole connected component.
  if (input.direction === "both") {
    const up = walkFocus({ ...input, direction: "up" });
    for (const id of walkFocus({ ...input, direction: "down" })) up.add(id);
    return up;
  }
  return walkFocus(input);
}

function walkFocus(input: FocusTablesInput): Set<string> {
  const result = new Set<string>();
  const seen = new Set<string>();
  const queue: string[] = [];
  const dist = new Map<string, number>();
  const adj = adjacency(input);
  const hidden = input.hidden;
  const hopLimit = input.hops;

  for (const seed of input.seeds) {
    if (!seed || seen.has(seed)) continue;
    seen.add(seed);
    result.add(seed);
    dist.set(seed, 0);
    queue.push(seed);
  }

  let q = 0;
  while (q < queue.length) {
    const id = queue[q++];
    if (!id) continue;
    const d = dist.get(id) ?? 0;
    if (hopLimit !== "all" && d >= hopLimit) continue;
    const neighbors = adj.get(id) ?? EMPTY_NEIGHBORS;
    for (let i = 0; i < neighbors.length; i++) {
      const next = neighbors[i];
      if (!next || seen.has(next)) continue;
      if (hidden?.has(next)) continue;
      seen.add(next);
      result.add(next);
      dist.set(next, d + 1);
      queue.push(next);
    }
  }
  return result;
}

type TraceAdj = { table: string; column: string; key: string; edgeId: string };

function pushAdj(map: Map<string, TraceAdj[]>, from: string, edge: TraceAdj): void {
  const list = map.get(from);
  if (list) list.push(edge);
  else map.set(from, [edge]);
}

export function traceField(input: {
  table: string;
  column: string;
  lineageFields: ParsedFieldLineage[];
}): TraceFieldResult {
  const down = new Map<string, TraceAdj[]>();
  const up = new Map<string, TraceAdj[]>();

  for (const m of input.lineageFields) {
    const src = colKey(m.sourceTable, m.sourceColumn);
    const tgt = colKey(m.targetTable, m.targetColumn);
    const edgeId = fieldLineageEdgeId(m);
    pushAdj(down, src, {
      table: m.targetTable,
      column: m.targetColumn,
      key: tgt,
      edgeId,
    });
    pushAdj(up, tgt, {
      table: m.sourceTable,
      column: m.sourceColumn,
      key: src,
      edgeId,
    });
  }

  const seedKey = colKey(input.table, input.column);
  const columns = new Map<string, TraceColumn>();
  columns.set(seedKey, { table: input.table, column: input.column, depth: 0 });
  const edges = new Set<string>();
  let cycle = false;

  const walk = (adj: Map<string, TraceAdj[]>, sign: 1 | -1) => {
    const path = new Set<string>([seedKey]);
    const visited = new Set<string>([seedKey]);

    const dfs = (key: string, depth: number) => {
      for (const edge of adj.get(key) ?? []) {
        edges.add(edge.edgeId);
        if (path.has(edge.key)) {
          cycle = true;
          continue;
        }
        if (visited.has(edge.key)) continue;
        visited.add(edge.key);
        if (!columns.has(edge.key)) {
          columns.set(edge.key, {
            table: edge.table,
            column: edge.column,
            depth: depth + sign,
          });
        }
        path.add(edge.key);
        dfs(edge.key, depth + sign);
        path.delete(edge.key);
      }
    };

    dfs(seedKey, 0);
  };

  walk(down, 1);
  walk(up, -1);

  return {
    columns: [...columns.values()],
    edges: [...edges],
    cycle,
  };
}
