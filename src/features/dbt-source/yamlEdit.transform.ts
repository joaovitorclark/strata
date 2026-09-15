import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Document,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";
import type { ProjectFiles } from "./model";
import { fromDbtProject } from "./fromDbtProject";
import { modelNameOf, qualifiedTableId } from "./model";
import { contextFromFiles, toDbtSql, type TransformIR } from "./transform";
import { asArray, asRecord, asString, loadYaml } from "./yaml";
import type { EditResult } from "./yamlEdit";
import * as yamlEdit from "./yamlEdit";

export type { EditResult, TableKind } from "./yamlEdit";
export { addTable, addColumn, addLineage } from "./yamlEdit";

type TableLoc = {
  id: string;
  name: string;
  kind: "model" | "source";
  layer: string;
  ymlPath: string;
  sqlPath?: string;
};

function cloneFiles(files: ProjectFiles): ProjectFiles {
  return { ...files };
}

function commit(before: ProjectFiles, after: ProjectFiles, problems?: string[]): EditResult {
  const changes: Record<string, string | null> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (before[key] !== after[key]) changes[key] = after[key] ?? null;
  }
  return problems?.length ? { files: after, changes, problems } : { files: after, changes };
}

function writeDoc(doc: Document): string {
  const text = String(doc);
  return text.endsWith("\n") ? text : `${text}\n`;
}

function asYamlMap(node: unknown): YAMLMap | undefined {
  return isMap(node) ? node : undefined;
}

function asYamlSeq(node: unknown): YAMLSeq | undefined {
  return isSeq(node) ? node : undefined;
}

function ensureMap(doc: Document, parent: YAMLMap, key: string): YAMLMap {
  const existing = asYamlMap(parent.get(key));
  if (existing) return existing;
  const created = doc.createNode({}) as YAMLMap;
  parent.set(key, created);
  return created;
}

function ensureSeq(doc: Document, parent: YAMLMap, key: string): YAMLSeq {
  const existing = asYamlSeq(parent.get(key));
  if (existing) return existing;
  const created = doc.createNode([]) as YAMLSeq;
  parent.set(key, created);
  return created;
}

function ensureStrata(doc: Document, node: YAMLMap): YAMLMap {
  return ensureMap(doc, ensureMap(doc, ensureMap(doc, node, "config"), "meta"), "strata");
}

function scalarString(node: unknown): string | undefined {
  if (isScalar(node) && node.value != null) return String(node.value);
  if (typeof node === "string") return node;
  return undefined;
}

function layerOfPath(filePath: string, project: string): string | undefined {
  const m = new RegExp(
    `^models/${project.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}/([^/]+)/`,
  ).exec(filePath);
  return m?.[1];
}

function findTableMap(doc: Document, loc: TableLoc): YAMLMap | undefined {
  const models = asYamlSeq(doc.get("models"));
  if (!models) return undefined;
  for (const item of models.items) {
    const map = asYamlMap(item);
    if (map && scalarString(map.get("name")) === loc.name) return map;
  }
  return undefined;
}

function columnMap(table: YAMLMap, name: string): YAMLMap | undefined {
  const cols = asYamlSeq(table.get("columns"));
  if (!cols) return undefined;
  for (const item of cols.items) {
    const col = asYamlMap(item);
    if (col && scalarString(col.get("name")) === name) return col;
  }
  return undefined;
}

function locate(files: ProjectFiles, project: string, tableId: string): TableLoc | undefined {
  const prefix = `models/${project}/`;
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(prefix) || !(path.endsWith(".yml") || path.endsWith(".yaml"))) continue;
    const layer = layerOfPath(path, project) ?? "main";
    const doc = asRecord(loadYaml(content));
    if (!doc) continue;
    for (const raw of asArray(doc.models)) {
      const node = asRecord(raw);
      const name = asString(node?.name);
      if (!name) continue;
      const schema = asString(asRecord(node?.config)?.schema) ?? layer;
      const id = qualifiedTableId(schema, name);
      if (id === tableId || name === tableId) {
        return {
          id,
          name,
          kind: "model",
          layer,
          ymlPath: path,
          sqlPath: `models/${project}/${layer}/${name}.sql`,
        };
      }
    }
  }
  const model = fromDbtProject(files, project);
  const table = model.tables.find((t) => t.id === tableId || t.name === tableId);
  if (!table || table.kind === "source" || table.external) return undefined;
  const layer = table.layer ?? "main";
  const name = modelNameOf(table);
  return {
    id: table.id,
    name,
    kind: "model",
    layer,
    ymlPath: `models/${project}/${layer}/_${name}.yml`,
    sqlPath: `models/${project}/${layer}/${name}.sql`,
  };
}

function isManagedYaml(files: ProjectFiles, loc: TableLoc): boolean {
  const yml = files[loc.ymlPath];
  if (!yml) return false;
  const doc = asRecord(loadYaml(yml));
  for (const raw of asArray(doc?.models)) {
    const node = asRecord(raw);
    if (asString(node?.name) !== loc.name) continue;
    const strata = asRecord(asRecord(asRecord(node?.config)?.meta)?.strata);
    return strata?.managed === true;
  }
  return false;
}

function editYaml(files: ProjectFiles, path: string, fn: (doc: Document) => void): ProjectFiles {
  const next = cloneFiles(files);
  const doc = parseDocument(next[path] ?? "version: 2\n");
  fn(doc);
  next[path] = writeDoc(doc);
  return next;
}

function regenSql(files: ProjectFiles, project: string, loc: TableLoc): ProjectFiles {
  if (!loc.sqlPath || !isManagedYaml(files, loc)) return files;
  const ctx = contextFromFiles(files, project);
  const next = cloneFiles(files);
  next[loc.sqlPath] = toDbtSql(ctx, loc.name);
  return next;
}

export function setTransform(
  files: ProjectFiles,
  project: string,
  tableId: string,
  transform: TransformIR,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  let next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    const strata = ensureStrata(doc, table);
    strata.set("transform", doc.createNode(JSON.parse(JSON.stringify(transform))));
  });
  next = regenSql(next, project, loc);
  return commit(files, next);
}

export function setColumnExpr(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
  expr: string,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  let next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    const col = table ? columnMap(table, column) : undefined;
    if (!col) return;
    const strata = ensureStrata(doc, col);
    const lin = ensureSeq(doc, strata, "lineage");
    const first = asYamlMap(lin.items[0]);
    if (first) {
      if (expr) first.set("expr", expr);
      else first.delete("expr");
      return;
    }
    const ir = contextFromFiles(files, project).models.find((m) => m.name === loc.name)?.transform;
    const alias = ir?.from.alias ?? "s0";
    const entry: Record<string, unknown> = { from: `${alias}.${column}` };
    if (expr) entry.expr = expr;
    lin.add(doc.createNode(entry));
  });
  const ctx = contextFromFiles(next, project);
  const node = ctx.models.find((m) => m.name === loc.name);
  if (node?.transform && isManagedYaml(next, loc)) next = regenSql(next, project, loc);
  return commit(files, next);
}

export function addManagedFromSelection(
  files: ProjectFiles,
  project: string,
  args: {
    tableId: string;
    sourceTableIds: string[];
    transform: TransformIR;
    position?: { x: number; y: number };
  },
): EditResult {
  const created = yamlEdit.addTable(files, project, {
    tableId: args.tableId,
    position: args.position,
  });
  return setTransform(created.files, project, args.tableId, args.transform);
}
