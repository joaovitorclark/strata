import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  visit,
  type Document,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";
import type { SchemaView } from "@/features/schema/model/views";
import { rowsToCsv } from "./csv";
import { fromDbtProject } from "./fromDbtProject";
import { modelNameOf, qualifiedTableId, type ProjectFiles } from "./model";
import { asArray, asRecord, asString, dumpYaml, loadYaml } from "./yaml";

export type EditResult = {
  files: ProjectFiles;
  changes: Record<string, string | null>;
  problems?: string[];
};

export type TableKind = "model" | "source";

type TableLoc = {
  id: string;
  name: string;
  kind: TableKind;
  layer: string;
  ymlPath: string;
  sqlPath?: string;
  sourceName?: string;
};

type Pos = { x: number; y: number };
type Size = { width?: number; height?: number };

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

function parseDoc(text: string): Document {
  return parseDocument(text);
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

function findTableMap(doc: Document, loc: TableLoc): YAMLMap | undefined {
  if (loc.kind === "model") {
    const models = asYamlSeq(doc.get("models"));
    if (!models) return undefined;
    for (const item of models.items) {
      const map = asYamlMap(item);
      if (map && scalarString(map.get("name")) === loc.name) return map;
    }
    return undefined;
  }
  const sources = asYamlSeq(doc.get("sources"));
  if (!sources) return undefined;
  for (const srcItem of sources.items) {
    const src = asYamlMap(srcItem);
    if (!src) continue;
    if (loc.sourceName && scalarString(src.get("name")) !== loc.sourceName) continue;
    const tables = asYamlSeq(src.get("tables"));
    if (!tables) continue;
    for (const t of tables.items) {
      const map = asYamlMap(t);
      if (map && scalarString(map.get("name")) === loc.name) return map;
    }
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

function layerOfPath(filePath: string, project: string): string | undefined {
  const m = new RegExp(
    `^models/${project.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}/([^/]+)/`,
  ).exec(filePath);
  return m?.[1];
}

function scanYml(files: ProjectFiles, project: string, tableId: string): TableLoc | undefined {
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
    for (const src of asArray(doc.sources)) {
      const source = asRecord(src);
      const sourceName = asString(source?.name) ?? "raw";
      for (const raw of asArray(source?.tables)) {
        const node = asRecord(raw);
        const name = asString(node?.name);
        if (!name) continue;
        const id = qualifiedTableId(sourceName, name);
        if (id === tableId || name === tableId) {
          return {
            id,
            name,
            kind: "source",
            layer,
            ymlPath: path,
            sourceName,
          };
        }
      }
    }
  }
  return undefined;
}

function locate(files: ProjectFiles, project: string, tableId: string): TableLoc | undefined {
  const scanned = scanYml(files, project, tableId);
  if (scanned) return scanned;
  const model = fromDbtProject(files, project);
  const table = model.tables.find((t) => t.id === tableId || t.name === tableId);
  if (!table || table.external) return undefined;
  const layer = table.layer ?? "main";
  if (table.kind === "source") {
    return {
      id: table.id,
      name: table.name,
      kind: "source",
      layer,
      ymlPath: `models/${project}/${layer}/_sources.yml`,
      sourceName: table.schema,
    };
  }
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

function editYaml(files: ProjectFiles, path: string, fn: (doc: Document) => void): ProjectFiles {
  const next = cloneFiles(files);
  const doc = parseDoc(next[path] ?? "version: 2\n");
  fn(doc);
  next[path] = writeDoc(doc);
  return next;
}

function isManaged(files: ProjectFiles, loc: TableLoc): boolean {
  if (loc.kind !== "model" || !loc.sqlPath) return false;
  if ((files[loc.sqlPath] ?? "").includes("@generated")) return true;
  const yml = files[loc.ymlPath];
  if (!yml) return false;
  const doc = asRecord(loadYaml(yml));
  for (const raw of asArray(doc?.models)) {
    const node = asRecord(raw);
    if (asString(node?.name) !== loc.name) continue;
    const config = asRecord(node?.config);
    const meta = asRecord(config?.meta);
    const strata = asRecord(meta?.strata);
    if (strata?.managed === true) return true;
    const tags = asArray(config?.tags).map(String);
    if (tags.includes("strata:managed")) return true;
  }
  return false;
}

function canvasPath(project: string): string {
  return `.strata/${project}/canvas.yml`;
}

function viewsPath(project: string): string {
  return `.strata/${project}/views.yml`;
}

function mutateCanvas(
  files: ProjectFiles,
  project: string,
  fn: (doc: Document) => void,
): ProjectFiles {
  const path = canvasPath(project);
  const next = cloneFiles(files);
  const doc = parseDoc(next[path] ?? "{}\n");
  if (!isMap(doc.contents)) doc.contents = doc.createNode({}) as YAMLMap;
  fn(doc);
  next[path] = writeDoc(doc);
  return next;
}

function hasStringTest(seq: YAMLSeq, name: string): boolean {
  return seq.items.some((item) => isScalar(item) && item.value === name);
}

function addStringTest(seq: YAMLSeq, name: string): void {
  if (!hasStringTest(seq, name)) seq.add(name);
}

function removeStringTest(seq: YAMLSeq, name: string): void {
  seq.items = seq.items.filter((item) => !(isScalar(item) && item.value === name));
}

function constraintsSeq(table: YAMLMap): YAMLSeq | undefined {
  return asYamlSeq(table.get("constraints"));
}

function constraintType(item: unknown): string | undefined {
  const map = asYamlMap(item);
  return map ? scalarString(map.get("type")) : undefined;
}

function removeConstraintsOfType(seq: YAMLSeq, type: string, column?: string): void {
  seq.items = seq.items.filter((item) => {
    if (constraintType(item) !== type) return true;
    if (!column) return false;
    const cols = asYamlSeq(asYamlMap(item)?.get("columns"));
    const names = cols?.items.map((c) => scalarString(c)) ?? [];
    return !names.includes(column);
  });
}

function rewriteJinjaRef(sql: string, oldName: string, newName: string): string {
  return sql.replace(
    new RegExp(
      `ref\\(\\s*(['"])${oldName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\1\\s*\\)`,
      "g",
    ),
    `ref('${newName}')`,
  );
}

function rewriteJinjaSourceTable(
  sql: string,
  source: string,
  oldTable: string,
  newTable: string,
): string {
  const src = source.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
  const tbl = oldTable.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
  return sql.replace(
    new RegExp(`source\\(\\s*(['"])${src}\\1\\s*,\\s*(['"])${tbl}\\2\\s*\\)`, "g"),
    `source('${source}', '${newTable}')`,
  );
}

function rewriteFromField(from: string, oldId: string, newId: string): string {
  if (from === oldId || from.startsWith(`${oldId}.`)) return `${newId}${from.slice(oldId.length)}`;
  return from;
}

function rewriteLineageAndRefs(
  files: ProjectFiles,
  project: string,
  rewriteFrom: (from: string) => string,
  rewriteRefName?: { oldName: string; newName: string },
): ProjectFiles {
  const next = cloneFiles(files);
  const prefix = `models/${project}/`;
  for (const path of Object.keys(next)) {
    if (!path.startsWith(prefix) || !(path.endsWith(".yml") || path.endsWith(".yaml"))) continue;
    const doc = parseDoc(next[path]);
    visit(doc, {
      Map: (_key, node) => {
        if (!isMap(node)) return;
        const fromVal = scalarString(node.get("from", true)) ?? scalarString(node.get("from"));
        if (fromVal) {
          const updated = rewriteFrom(fromVal);
          if (updated !== fromVal) node.set("from", updated);
        }
        const toVal = scalarString(node.get("to", true)) ?? scalarString(node.get("to"));
        if (rewriteRefName && toVal) {
          const updated = rewriteJinjaRef(toVal, rewriteRefName.oldName, rewriteRefName.newName);
          if (updated !== toVal) node.set("to", updated);
        }
      },
    });
    next[path] = writeDoc(doc);
  }
  return next;
}

function rewriteCanvasKeys(
  files: ProjectFiles,
  project: string,
  oldId: string,
  newId: string,
): ProjectFiles {
  return mutateCanvas(files, project, (doc) => {
    const root = asYamlMap(doc.contents);
    if (!root) return;
    for (const key of ["positions", "sizes", "colors"] as const) {
      const map = asYamlMap(root.get(key));
      if (!map) continue;
      for (const pair of [...map.items]) {
        const k = scalarString(pair.key);
        if (!k) continue;
        if (k === oldId || k.startsWith(`${oldId}.`)) {
          const nk = `${newId}${k.slice(oldId.length)}`;
          map.delete(k);
          map.set(nk, pair.value);
        }
      }
    }
    const pins = asYamlSeq(root.get("pins"));
    if (pins) {
      for (const item of pins.items) {
        if (isScalar(item) && typeof item.value === "string") {
          if (item.value === oldId || item.value.startsWith(`${oldId}.`)) {
            item.value = `${newId}${item.value.slice(oldId.length)}`;
          }
        }
      }
    }
  });
}

function parseTableId(tableId: string): { schema?: string; name: string } {
  const i = tableId.lastIndexOf(".");
  if (i <= 0) return { name: tableId };
  return { schema: tableId.slice(0, i), name: tableId.slice(i + 1) };
}

export function addTable(
  files: ProjectFiles,
  project: string,
  args: { tableId: string; kind?: TableKind; position?: Pos },
): EditResult {
  const before = files;
  let next = cloneFiles(files);
  const kind = args.kind ?? "model";
  const parsed = parseTableId(args.tableId);
  const name = parsed.name;
  const schema = parsed.schema;
  const layer = schema ?? "main";
  const id = qualifiedTableId(schema, name);
  if (kind === "source") {
    const sourceName = schema ?? "raw";
    const ymlPath = `models/${project}/${layer}/_sources.yml`;
    next = editYaml(next, ymlPath, (doc) => {
      if (!isMap(doc.contents))
        doc.contents = doc.createNode({ version: 2, sources: [] }) as YAMLMap;
      const root = asYamlMap(doc.contents)!;
      if (root.get("version") == null) root.set("version", 2);
      const sources = ensureSeq(doc, root, "sources");
      let src = sources.items
        .map(asYamlMap)
        .find((s) => s && scalarString(s.get("name")) === sourceName);
      if (!src) {
        src = doc.createNode({ name: sourceName, schema: sourceName, tables: [] }) as YAMLMap;
        sources.add(src);
      }
      const tables = ensureSeq(doc, src, "tables");
      tables.add(
        doc.createNode({
          name,
          config: { tags: [`strata:${project}`] },
          columns: [{ name: "id", data_type: "bigint" }],
          constraints: [{ type: "primary_key", columns: ["id"], warn_unsupported: false }],
        }),
      );
    });
  } else {
    const dir = `models/${project}/${layer}`;
    const ymlPath = `${dir}/_${name}.yml`;
    const sqlPath = `${dir}/${name}.sql`;
    const yml: Record<string, unknown> = {
      version: 2,
      models: [
        {
          name,
          config: {
            tags: [`strata:${project}`],
            ...(schema ? { schema } : {}),
            materialized: "table",
            contract: { enforced: true },
            meta: { strata: { managed: true } },
          },
          constraints: [{ type: "primary_key", columns: ["id"], warn_unsupported: false }],
          columns: [{ name: "id", data_type: "bigint" }],
        },
      ],
    };
    next[ymlPath] = dumpYaml(yml);
    next[sqlPath] =
      "-- @generated by Strata — edite pelo canvas; edições manuais tornam este model manual.\nselect 1 as id\n";
  }
  if (args.position) {
    next = setPositions(next, project, { [id]: args.position }).files;
  } else {
    next = mutateCanvas(next, project, (doc) => {
      const root = asYamlMap(doc.contents)!;
      const positions = ensureMap(doc, root, "positions");
      positions.set(id, doc.createNode({ x: 80, y: 80 }));
    });
  }
  return commit(before, next);
}

export function removeTable(files: ProjectFiles, project: string, tableId: string): EditResult {
  const before = files;
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  let next = cloneFiles(files);
  if (loc.kind === "model") {
    delete next[loc.ymlPath];
    if (loc.sqlPath) delete next[loc.sqlPath];
  } else {
    next = editYaml(next, loc.ymlPath, (doc) => {
      const sources = asYamlSeq(doc.get("sources"));
      if (!sources) return;
      for (const srcItem of sources.items) {
        const src = asYamlMap(srcItem);
        if (!src) continue;
        const tables = asYamlSeq(src.get("tables"));
        if (!tables) continue;
        tables.items = tables.items.filter(
          (t) => !(asYamlMap(t) && scalarString(asYamlMap(t)!.get("name")) === loc.name),
        );
      }
    });
  }
  next = rewriteLineageAndRefs(next, project, (from) =>
    from === loc.id || from.startsWith(`${loc.id}.`) ? "" : from,
  );
  next = mutateCanvas(next, project, (doc) => {
    const root = asYamlMap(doc.contents);
    if (!root) return;
    for (const key of ["positions", "sizes", "colors"] as const) {
      const map = asYamlMap(root.get(key));
      if (!map) continue;
      for (const pair of [...map.items]) {
        const k = scalarString(pair.key);
        if (k === loc.id || k?.startsWith(`${loc.id}.`)) map.delete(k);
      }
    }
    const pins = asYamlSeq(root.get("pins"));
    if (pins) {
      pins.items = pins.items.filter((item) => {
        const v = isScalar(item) ? String(item.value ?? "") : "";
        return v !== loc.id && !v.startsWith(`${loc.id}.`);
      });
    }
  });
  return commit(before, next);
}

export function renameTable(
  files: ProjectFiles,
  project: string,
  tableId: string,
  newId: string,
): EditResult {
  const before = files;
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const parsed = parseTableId(
    newId.includes(".")
      ? newId
      : `${loc.id.includes(".") ? loc.id.slice(0, loc.id.lastIndexOf(".")) : ""}.${newId}`.replace(
          /^\./,
          "",
        ),
  );
  const newName = parsed.name;
  const newSchema = parsed.schema ?? (loc.kind === "source" ? loc.sourceName : loc.layer);
  const resolvedNewId =
    loc.kind === "source"
      ? qualifiedTableId(newSchema, newName)
      : qualifiedTableId(newSchema, newName);
  let next = cloneFiles(files);
  const problems: string[] = [];

  next = editYaml(next, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    table.set("name", newName);
    if (loc.kind === "model" && parsed.schema) {
      const config = ensureMap(doc, table, "config");
      config.set("schema", parsed.schema);
    }
  });

  if (loc.kind === "model" && loc.sqlPath) {
    const newYml = `models/${project}/${loc.layer}/_${newName}.yml`;
    const newSql = `models/${project}/${loc.layer}/${newName}.sql`;
    if (newYml !== loc.ymlPath) {
      next[newYml] = next[loc.ymlPath];
      delete next[loc.ymlPath];
    }
    if (next[loc.sqlPath] != null) {
      let sql = next[loc.sqlPath];
      if (isManaged(files, loc)) sql = rewriteJinjaRef(sql, loc.name, newName);
      next[newSql] = sql;
      if (newSql !== loc.sqlPath) delete next[loc.sqlPath];
    }
  }

  for (const [path, content] of Object.entries(next)) {
    if (!path.startsWith(`models/${project}/`) || !path.endsWith(".sql")) continue;
    const managed =
      content.includes("@generated") ||
      /managed:\s*true/.test(next[path.replace(/\/([^/]+)\.sql$/, "/_$1.yml")] ?? "");
    if (managed) {
      next[path] =
        loc.kind === "source"
          ? rewriteJinjaSourceTable(content, loc.sourceName ?? "raw", loc.name, newName)
          : rewriteJinjaRef(content, loc.name, newName);
    } else if (
      loc.kind === "model" &&
      (content.includes(`ref('${loc.name}')`) || content.includes(`ref("${loc.name}")`))
    ) {
      problems.push(`ref quebrada em ${path}: ${loc.name} → ${newName}`);
    }
  }

  next = rewriteLineageAndRefs(
    next,
    project,
    (from) => rewriteFromField(from, loc.id, resolvedNewId),
    loc.kind === "model" ? { oldName: loc.name, newName } : undefined,
  );
  next = rewriteCanvasKeys(next, project, loc.id, resolvedNewId);
  const viewsFile = viewsPath(project);
  if (next[viewsFile]) {
    next = editYaml(next, viewsFile, (doc) => {
      visit(doc, {
        Scalar: (_k, node) => {
          if (isScalar(node) && typeof node.value === "string" && node.value === loc.id) {
            node.value = resolvedNewId;
          }
        },
      });
    });
  }
  return commit(before, next, problems);
}

export function addColumn(
  files: ProjectFiles,
  project: string,
  tableId: string,
  name: string,
  dataType = "string",
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    const cols = ensureSeq(doc, table, "columns");
    cols.add(doc.createNode({ name, data_type: dataType }));
  });
  return commit(files, next);
}

export function removeColumn(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  let next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    const cols = asYamlSeq(table.get("columns"));
    if (!cols) return;
    cols.items = cols.items.filter(
      (item) => !(asYamlMap(item) && scalarString(asYamlMap(item)!.get("name")) === column),
    );
    const cons = constraintsSeq(table);
    if (cons) {
      removeConstraintsOfType(cons, "foreign_key", column);
      removeConstraintsOfType(cons, "unique", column);
      const pk = cons.items.find((item) => constraintType(item) === "primary_key");
      const pkMap = asYamlMap(pk);
      const pkCols = asYamlSeq(pkMap?.get("columns"));
      if (pkCols) {
        pkCols.items = pkCols.items.filter((c) => scalarString(c) !== column);
        if (!pkCols.items.length) removeConstraintsOfType(cons, "primary_key");
      }
    }
  });
  next = rewriteLineageAndRefs(next, project, (from) =>
    from === `${loc.id}.${column}` ? "" : from,
  );
  return commit(files, next);
}

export function renameColumn(
  files: ProjectFiles,
  project: string,
  tableId: string,
  oldName: string,
  newName: string,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  let next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    const col = columnMap(table, oldName);
    if (col) col.set("name", newName);
    const cons = constraintsSeq(table);
    if (cons) {
      for (const item of cons.items) {
        const map = asYamlMap(item);
        const cols = asYamlSeq(map?.get("columns"));
        if (cols) {
          for (const c of cols.items) {
            if (isScalar(c) && c.value === oldName) c.value = newName;
          }
        }
        const toCols = asYamlSeq(map?.get("to_columns"));
        if (toCols) {
          for (const c of toCols.items) {
            if (isScalar(c) && c.value === oldName) c.value = newName;
          }
        }
      }
    }
  });
  next = rewriteLineageAndRefs(next, project, (from) => {
    if (from === `${loc.id}.${oldName}`) return `${loc.id}.${newName}`;
    return from;
  });
  next = mutateCanvas(next, project, (doc) => {
    const root = asYamlMap(doc.contents);
    if (!root) return;
    const colors = asYamlMap(root.get("colors"));
    if (colors) {
      const key = `${loc.id}.${oldName}`;
      if (colors.has(key)) {
        const val = colors.get(key);
        colors.delete(key);
        colors.set(`${loc.id}.${newName}`, val);
      }
    }
    const pins = asYamlSeq(root.get("pins"));
    if (pins) {
      for (const item of pins.items) {
        if (isScalar(item) && item.value === `${loc.id}.${oldName}`)
          item.value = `${loc.id}.${newName}`;
      }
    }
  });
  const seedBase = `records_${loc.id.replace(/\W+/g, "_")}`;
  const csvPath = `seeds/${project}/${seedBase}.csv`;
  if (next[csvPath]) {
    const lines = next[csvPath].split("\n");
    if (lines[0]) {
      const headers = lines[0].split(",");
      lines[0] = headers.map((h) => (h.trim() === oldName ? newName : h)).join(",");
      next[csvPath] = lines.join("\n");
    }
  }
  return commit(files, next);
}

export function setColumnType(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
  dataType: string,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const col = findTableMap(doc, loc) && columnMap(findTableMap(doc, loc)!, column);
    if (col) col.set("data_type", dataType);
  });
  return commit(files, next);
}

function setColumnFlag(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
  flag: "not_null" | "unique",
  value: boolean,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    const col = table ? columnMap(table, column) : undefined;
    if (!table || !col) return;
    if (loc.kind === "source") {
      const tests = ensureSeq(doc, col, "data_tests");
      if (value) addStringTest(tests, flag);
      else removeStringTest(tests, flag);
    } else if (flag === "not_null") {
      const cons = ensureSeq(doc, col, "constraints");
      if (value) {
        if (!cons.items.some((i) => constraintType(i) === "not_null")) {
          cons.add(doc.createNode({ type: "not_null", warn_unsupported: false }));
        }
      } else {
        removeConstraintsOfType(cons, "not_null");
      }
    } else {
      const cons = ensureSeq(doc, table, "constraints");
      if (value) {
        const exists = cons.items.some((item) => {
          if (constraintType(item) !== "unique") return false;
          const cols = asYamlSeq(asYamlMap(item)?.get("columns"));
          return cols?.items.some((c) => scalarString(c) === column);
        });
        if (!exists) {
          cons.add(doc.createNode({ type: "unique", columns: [column], warn_unsupported: false }));
        }
      } else {
        removeConstraintsOfType(cons, "unique", column);
      }
    }
  });
  return commit(files, next);
}

export function setNotNull(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
  value: boolean,
): EditResult {
  return setColumnFlag(files, project, tableId, column, "not_null", value);
}

export function setUnique(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
  value: boolean,
): EditResult {
  return setColumnFlag(files, project, tableId, column, "unique", value);
}

export function setPrimaryKey(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
  value: boolean,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    const cons = ensureSeq(doc, table, "constraints");
    if (value) {
      const existing = cons.items.find((item) => constraintType(item) === "primary_key");
      if (existing && asYamlMap(existing)) {
        asYamlMap(existing)!.set("columns", doc.createNode([column]));
      } else {
        cons.add(
          doc.createNode({ type: "primary_key", columns: [column], warn_unsupported: false }),
        );
      }
    } else {
      removeConstraintsOfType(cons, "primary_key");
    }
  });
  return commit(files, next);
}

export function setDefault(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
  value: string | undefined,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    const col = table ? columnMap(table, column) : undefined;
    if (!col) return;
    const strata = ensureStrata(doc, col);
    if (value === undefined || value === "") strata.delete("default");
    else strata.set("default", value);
  });
  return commit(files, next);
}

export function setDescription(
  files: ProjectFiles,
  project: string,
  tableId: string,
  description: string,
  column?: string,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    const target = column ? columnMap(table, column) : table;
    if (!target) return;
    if (!description) target.delete("description");
    else target.set("description", description);
  });
  return commit(files, next);
}

export function addRef(
  files: ProjectFiles,
  project: string,
  args: { fromTable: string; fromCol: string; toTable: string; toCol: string },
): EditResult {
  const loc = locate(files, project, args.fromTable);
  const to = locate(files, project, args.toTable);
  if (!loc) return { files, changes: {} };
  const toJinja = to
    ? to.kind === "source"
      ? `source('${to.sourceName}', '${to.name}')`
      : `ref('${to.name}')`
    : `ref('${parseTableId(args.toTable).name}')`;
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    if (loc.kind === "source") {
      const col = columnMap(table, args.fromCol);
      if (!col) return;
      const tests = ensureSeq(doc, col, "data_tests");
      tests.add(
        doc.createNode({
          relationships: { arguments: { to: toJinja, field: args.toCol } },
        }),
      );
    } else {
      const cons = ensureSeq(doc, table, "constraints");
      cons.add(
        doc.createNode({
          type: "foreign_key",
          columns: [args.fromCol],
          to: toJinja,
          to_columns: [args.toCol],
          warn_unsupported: false,
        }),
      );
    }
  });
  return commit(files, next);
}

export function removeRef(
  files: ProjectFiles,
  project: string,
  args: { fromTable: string; fromCol: string; toTable: string; toCol: string },
): EditResult {
  const loc = locate(files, project, args.fromTable);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    if (loc.kind === "source") {
      const col = columnMap(table, args.fromCol);
      const tests = asYamlSeq(col?.get("data_tests"));
      if (!tests) return;
      tests.items = tests.items.filter((item) => {
        const rel = asYamlMap(asYamlMap(item)?.get("relationships"));
        if (!rel) return true;
        const argsMap = asYamlMap(rel.get("arguments")) ?? rel;
        return scalarString(argsMap.get("field")) !== args.toCol;
      });
    } else {
      const cons = constraintsSeq(table);
      if (!cons) return;
      cons.items = cons.items.filter((item) => {
        if (constraintType(item) !== "foreign_key") return true;
        const map = asYamlMap(item);
        const cols = asYamlSeq(map?.get("columns"));
        const from = scalarString(cols?.items[0]);
        return from !== args.fromCol;
      });
    }
  });
  return commit(files, next);
}

export function addLineage(
  files: ProjectFiles,
  project: string,
  args: { targetTable: string; targetColumn: string; from: string; expr?: string },
): EditResult {
  const loc = locate(files, project, args.targetTable);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    const col = table ? columnMap(table, args.targetColumn) : undefined;
    if (!col) return;
    const strata = ensureStrata(doc, col);
    const lin = ensureSeq(doc, strata, "lineage");
    const entry: Record<string, unknown> = { from: args.from };
    if (args.expr) entry.expr = args.expr;
    lin.add(doc.createNode(entry));
  });
  return commit(files, next);
}

export function removeLineage(
  files: ProjectFiles,
  project: string,
  args: { targetTable: string; targetColumn: string; from: string },
): EditResult {
  const loc = locate(files, project, args.targetTable);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    const col = table ? columnMap(table, args.targetColumn) : undefined;
    if (!col) return;
    const strata = asYamlMap(asYamlMap(asYamlMap(col.get("config"))?.get("meta"))?.get("strata"));
    const lin = asYamlSeq(strata?.get("lineage"));
    if (!lin) return;
    lin.items = lin.items.filter(
      (item) => scalarString(asYamlMap(item)?.get("from")) !== args.from,
    );
  });
  return commit(files, next);
}

export function updateLineage(
  files: ProjectFiles,
  project: string,
  args: {
    targetTable: string;
    targetColumn: string;
    from: string;
    nextFrom?: string;
    expr?: string;
  },
): EditResult {
  const loc = locate(files, project, args.targetTable);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    const col = table ? columnMap(table, args.targetColumn) : undefined;
    if (!col) return;
    const strata = asYamlMap(asYamlMap(asYamlMap(col.get("config"))?.get("meta"))?.get("strata"));
    const lin = asYamlSeq(strata?.get("lineage"));
    if (!lin) return;
    for (const item of lin.items) {
      const map = asYamlMap(item);
      if (!map || scalarString(map.get("from")) !== args.from) continue;
      if (args.nextFrom) map.set("from", args.nextFrom);
      if (args.expr !== undefined) {
        if (args.expr) map.set("expr", args.expr);
        else map.delete("expr");
      }
    }
  });
  return commit(files, next);
}

export function setLayer(
  files: ProjectFiles,
  project: string,
  tableId: string,
  newLayer: string | null,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc || loc.kind !== "model") return { files, changes: {} };
  const layer = newLayer ?? "main";
  if (layer === loc.layer) return { files, changes: {} };
  const before = files;
  const next = cloneFiles(files);
  const newYml = `models/${project}/${layer}/_${loc.name}.yml`;
  const newSql = `models/${project}/${layer}/${loc.name}.sql`;
  next[newYml] = next[loc.ymlPath];
  delete next[loc.ymlPath];
  if (loc.sqlPath && next[loc.sqlPath] != null) {
    next[newSql] = next[loc.sqlPath];
    delete next[loc.sqlPath];
  }
  return commit(before, next);
}

export function setGroup(
  files: ProjectFiles,
  project: string,
  tableId: string,
  group: string | null,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    const config = ensureMap(doc, table, "config");
    const tags = ensureSeq(doc, config, "tags");
    const tag = group ? `strata:group:${group}` : null;
    tags.items = tags.items.filter((item) => {
      const v = scalarString(item) ?? "";
      return !v.startsWith("strata:group:");
    });
    if (tag) tags.add(tag);
  });
  return commit(files, next);
}

export function setEnum(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
  enumName: string,
  values: string[],
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    const col = table ? columnMap(table, column) : undefined;
    if (!col) return;
    const strata = ensureStrata(doc, col);
    strata.set("enum", enumName);
    const tests = ensureSeq(doc, col, "data_tests");
    const hasAccepted = tests.items.some((item) => asYamlMap(item)?.has("accepted_values"));
    if (!hasAccepted) {
      tests.add(doc.createNode({ accepted_values: { arguments: { values } } }));
    }
  });
  return commit(files, next);
}

export function setIndexes(
  files: ProjectFiles,
  project: string,
  tableId: string,
  indexes: Array<{ columns: string[]; name?: string; unique?: boolean }>,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    if (!table) return;
    const strata = ensureStrata(doc, table);
    strata.set("indexes", doc.createNode(indexes));
  });
  return commit(files, next);
}

export function setRecords(
  files: ProjectFiles,
  project: string,
  tableId: string,
  columns: string[],
  rows: string[][],
): EditResult {
  const loc = locate(files, project, tableId);
  const id = loc?.id ?? tableId;
  const before = files;
  const next = cloneFiles(files);
  const seed = `records_${id.replace(/\W+/g, "_")}`;
  next[`seeds/${project}/${seed}.csv`] = rowsToCsv(columns, rows);
  next[`seeds/${project}/_${seed}.yml`] = dumpYaml({ version: 2, seeds: [{ name: seed }] });
  return commit(before, next);
}

export function setPositions(
  files: ProjectFiles,
  project: string,
  positions: Record<string, Pos>,
): EditResult {
  const next = mutateCanvas(files, project, (doc) => {
    const root = asYamlMap(doc.contents)!;
    const map = ensureMap(doc, root, "positions");
    for (const [id, pos] of Object.entries(positions)) {
      map.set(id, doc.createNode({ x: pos.x, y: pos.y }));
    }
  });
  return commit(files, next);
}

export function setSize(
  files: ProjectFiles,
  project: string,
  tableId: string,
  size: Size,
): EditResult {
  const next = mutateCanvas(files, project, (doc) => {
    const root = asYamlMap(doc.contents)!;
    const map = ensureMap(doc, root, "sizes");
    map.set(tableId, doc.createNode(size));
  });
  return commit(files, next);
}

export function setColor(
  files: ProjectFiles,
  project: string,
  key: string,
  color: string | null,
): EditResult {
  const next = mutateCanvas(files, project, (doc) => {
    const root = asYamlMap(doc.contents)!;
    const map = ensureMap(doc, root, "colors");
    if (color) map.set(key, color);
    else map.delete(key);
  });
  return commit(files, next);
}

export function setPins(files: ProjectFiles, project: string, pins: string[]): EditResult {
  const next = mutateCanvas(files, project, (doc) => {
    const root = asYamlMap(doc.contents)!;
    root.set("pins", doc.createNode(pins));
  });
  return commit(files, next);
}

export function setViews(files: ProjectFiles, project: string, views: SchemaView[]): EditResult {
  const path = viewsPath(project);
  const next = cloneFiles(files);
  const doc = parseDoc(next[path] ?? "views: []\n");
  if (!isMap(doc.contents)) doc.contents = doc.createNode({ views: [] }) as YAMLMap;
  asYamlMap(doc.contents)!.set("views", doc.createNode(views));
  next[path] = writeDoc(doc);
  return commit(files, next);
}

export function setCollapsedGroups(
  files: ProjectFiles,
  project: string,
  groups: string[],
): EditResult {
  const next = mutateCanvas(files, project, (doc) => {
    const root = asYamlMap(doc.contents)!;
    root.set("collapsedGroups", doc.createNode(groups));
  });
  return commit(files, next);
}

export function setRolename(
  files: ProjectFiles,
  project: string,
  tableId: string,
  column: string,
  rolename: string | null,
): EditResult {
  const loc = locate(files, project, tableId);
  if (!loc) return { files, changes: {} };
  const next = editYaml(files, loc.ymlPath, (doc) => {
    const table = findTableMap(doc, loc);
    const col = table ? columnMap(table, column) : undefined;
    if (!col) return;
    const strata = ensureStrata(doc, col);
    if (rolename) strata.set("rolename", rolename);
    else strata.delete("rolename");
  });
  return commit(files, next);
}
