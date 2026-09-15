import type { LineageOrigin } from "./types";

export type ResolvedColumn = {
  name: string;
  origins: LineageOrigin[];
  unknown: boolean;
  dependsOnMacro: boolean;
};

export type CatalogEntry = {
  tableId: string;
  columns: string[];
};

type SqlRelation = {
  sqlName: string;
  tableId?: string;
  columns: Map<string, LineageOrigin[]>;
  known: boolean;
};

function ident(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  const rec = value as Record<string, unknown>;
  if (typeof rec.value === "string" || typeof rec.value === "number") return String(rec.value);
  if (rec.expr) return ident(rec.expr);
  if (rec.column) return ident(rec.column);
  return "";
}

function isMacroToken(name: string): boolean {
  return name.startsWith("__jinja_macro_");
}

function asRec(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function uniqueOrigins(origins: LineageOrigin[]): LineageOrigin[] {
  const seen = new Set<string>();
  const out: LineageOrigin[] = [];
  for (const o of origins) {
    const key = `${o.relation}.${o.column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

function relationFromResolved(sqlName: string, cols: ResolvedColumn[]): SqlRelation {
  const columns = new Map<string, LineageOrigin[]>();
  let known = cols.length > 0 && cols.every((c) => !c.unknown || c.origins.length > 0);
  for (const col of cols) {
    if (col.name) columns.set(col.name, col.origins);
    if (col.unknown && col.origins.length === 0) known = false;
  }
  return { sqlName, columns, known };
}

function collectOrigins(
  node: unknown,
  from: SqlRelation[],
  macros: Set<string>,
): { origins: LineageOrigin[]; dependsOnMacro: boolean } {
  let dependsOnMacro = false;
  const origins: LineageOrigin[] = [];
  const visit = (value: unknown): void => {
    if (value == null) return;
    if (typeof value === "string") {
      if (isMacroToken(value) || macros.has(value)) dependsOnMacro = true;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const rec = asRec(value);
    if (!rec) return;
    if (typeof rec.value === "string" && (isMacroToken(rec.value) || macros.has(rec.value))) {
      dependsOnMacro = true;
    }
    if (rec.type === "column_ref") {
      const table = ident(rec.table) || undefined;
      const column = ident(rec.column);
      if (!column || column === "*") return;
      if (isMacroToken(column)) {
        dependsOnMacro = true;
        return;
      }
      origins.push(...resolveColumnRef(table, column, from));
      return;
    }
    for (const child of Object.values(rec)) {
      if (child === rec.tableList || child === rec.columnList) continue;
      visit(child);
    }
  };
  visit(node);
  return { origins: uniqueOrigins(origins), dependsOnMacro };
}

function resolveColumnRef(
  table: string | undefined,
  column: string,
  from: SqlRelation[],
): LineageOrigin[] {
  const match = (rel: SqlRelation): LineageOrigin[] => {
    const existing = rel.columns.get(column);
    if (existing) return existing;
    if (rel.tableId && !rel.columns.size) return [{ relation: rel.tableId, column }];
    if (rel.tableId && rel.known) return [];
    if (rel.tableId) return [{ relation: rel.tableId, column }];
    return [];
  };
  if (table) {
    const rel = from.find((r) => r.sqlName === table);
    return rel ? match(rel) : [];
  }
  if (from.length === 1) return match(from[0]);
  const hits = from.filter(
    (r) => r.columns.has(column) || (r.tableId && r.known && r.columns.has(column)),
  );
  if (hits.length === 1) return match(hits[0]);
  if (hits.length > 1) return uniqueOrigins(hits.flatMap(match));
  const byName = from.filter((r) => r.columns.has(column));
  if (byName.length === 1) return match(byName[0]);
  return [];
}

function expandStar(rel: SqlRelation): ResolvedColumn[] {
  if (!rel.known || rel.columns.size === 0) {
    return [];
  }
  return [...rel.columns.entries()].map(([name, origins]) => ({
    name,
    origins,
    unknown: origins.length === 0,
    dependsOnMacro: false,
  }));
}

function fromItems(node: Record<string, unknown>): unknown[] {
  if (!node.from) return [];
  return Array.isArray(node.from) ? node.from : [node.from];
}

function resolveFrom(
  node: Record<string, unknown>,
  catalog: Map<string, CatalogEntry>,
  macros: Set<string>,
  cteScope: Map<string, SqlRelation>,
): SqlRelation[] {
  const out: SqlRelation[] = [];
  for (const raw of fromItems(node)) {
    const item = asRec(raw);
    if (!item) continue;
    const innerAst = asRec(item.expr)?.ast ?? asRec(asRec(item.expr)?.stmt)?.ast;
    if (innerAst) {
      const inner = resolveQuery(innerAst, catalog, macros, cteScope);
      const alias = ident(item.as) || ident(item.table) || "subq";
      out.push(relationFromResolved(alias, inner));
      continue;
    }
    const table = ident(item.table);
    const alias = ident(item.as) || table;
    if (!table) continue;
    const cat = catalog.get(table);
    if (cat) {
      const columns = new Map<string, LineageOrigin[]>();
      for (const col of cat.columns) {
        columns.set(col, [{ relation: cat.tableId, column: col }]);
      }
      out.push({
        sqlName: alias,
        tableId: cat.tableId,
        columns,
        known: cat.columns.length > 0,
      });
      continue;
    }
    const cte = cteScope.get(table);
    if (cte) {
      out.push({ ...cte, sqlName: alias, columns: new Map(cte.columns) });
      continue;
    }
    out.push({ sqlName: alias, columns: new Map(), known: false });
  }
  return out;
}

function resolvePlainSelect(
  node: Record<string, unknown>,
  catalog: Map<string, CatalogEntry>,
  macros: Set<string>,
  cteScope: Map<string, SqlRelation>,
): ResolvedColumn[] {
  const from = resolveFrom(node, catalog, macros, cteScope);
  const cols = node.columns;
  if (cols === "*") {
    const expanded = from.flatMap(expandStar);
    if (!expanded.length) return [];
    return expanded;
  }
  const list = Array.isArray(cols) ? cols : [];
  const out: ResolvedColumn[] = [];
  for (const raw of list) {
    const item = asRec(raw);
    if (!item) continue;
    const expr = item.expr ?? item;
    const exprRec = asRec(expr);
    const exprCol = ident(exprRec?.column);
    const exprTable = ident(exprRec?.table);
    if (exprRec?.type === "column_ref" && exprCol === "*") {
      const rels = exprTable ? from.filter((r) => r.sqlName === exprTable) : from;
      const expanded = rels.flatMap(expandStar);
      if (!expanded.length) continue;
      out.push(...expanded);
      continue;
    }
    const collected = collectOrigins(expr, from, macros);
    const name = ident(item.as) || exprCol || ident(asRec(expr)?.value);
    out.push({
      name,
      origins: collected.origins,
      unknown: collected.dependsOnMacro || collected.origins.length === 0,
      dependsOnMacro: collected.dependsOnMacro,
    });
  }
  return out;
}

function stripSetOp(node: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...node };
  delete rest._next;
  delete rest.set_op;
  return rest;
}

function flattenSetOp(node: Record<string, unknown>): Record<string, unknown>[] {
  const next = node._next;
  if (next && typeof next === "object") {
    return [stripSetOp(node), ...flattenSetOp(next as Record<string, unknown>)];
  }
  return [node];
}

function mergeByPosition(branches: ResolvedColumn[][]): ResolvedColumn[] {
  if (!branches.length) return [];
  const width = Math.max(...branches.map((b) => b.length));
  const out: ResolvedColumn[] = [];
  for (let i = 0; i < width; i += 1) {
    const pieces = branches.map((b) => b[i]).filter(Boolean);
    const name = pieces[0]?.name ?? `col_${i}`;
    const origins = uniqueOrigins(pieces.flatMap((p) => p.origins));
    const dependsOnMacro = pieces.some((p) => p.dependsOnMacro);
    const unknown = dependsOnMacro || pieces.some((p) => p.unknown) || origins.length === 0;
    out.push({ name, origins, unknown, dependsOnMacro });
  }
  return out;
}

function withList(node: Record<string, unknown>): unknown[] {
  if (!node.with) return [];
  return Array.isArray(node.with) ? node.with : [node.with];
}

export function resolveQuery(
  ast: unknown,
  catalog: Map<string, CatalogEntry>,
  macros: Set<string>,
  parentCtes: Map<string, SqlRelation> = new Map(),
): ResolvedColumn[] {
  const node = Array.isArray(ast)
    ? asRec(ast.find((item) => asRec(item)?.type === "select") ?? ast[0])
    : asRec(ast);
  if (!node) return [];
  const cteScope = new Map(parentCtes);
  for (const raw of withList(node)) {
    const cte = asRec(raw);
    if (!cte) continue;
    const name = ident(cte.name);
    const stmt = asRec(cte.stmt);
    const inner = stmt?.ast ?? cte.stmt;
    if (!name || !inner) continue;
    const cols = resolveQuery(inner, catalog, macros, cteScope);
    cteScope.set(name, relationFromResolved(name, cols));
  }
  if (node.set_op && node._next) {
    return mergeByPosition(
      flattenSetOp(node).map((branch) => resolvePlainSelect(branch, catalog, macros, cteScope)),
    );
  }
  return resolvePlainSelect(node, catalog, macros, cteScope);
}
