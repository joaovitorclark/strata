import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Document,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";
import type { EditResult } from "./yamlEdit";
import type { ProjectFiles } from "./model";
import {
  findManagedModel,
  GENERATOR_NAME,
  GENERATOR_VERSION,
  GITATTRIBUTES_PATH,
  ensureSqlHeader,
  removeLockEntry,
  retargetLockEntry,
  setGitAttributesPath,
  setLockEntry,
  STRATA_MANAGED_TAG,
} from "./managed";

export type { EditResult };

export type RegenerateOpts = { confirmed: boolean; sql?: string };

function cloneFiles(files: ProjectFiles): ProjectFiles {
  return { ...files };
}

export function commitFiles(
  before: ProjectFiles,
  after: ProjectFiles,
  problems?: string[],
): EditResult {
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

function scalarString(node: unknown): string | undefined {
  if (isScalar(node) && node.value != null) return String(node.value);
  if (typeof node === "string") return node;
  return undefined;
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

function findTableMap(doc: Document, name: string): YAMLMap | undefined {
  const models = asYamlSeq(doc.get("models"));
  if (!models) return undefined;
  for (const item of models.items) {
    const map = asYamlMap(item);
    if (map && scalarString(map.get("name")) === name) return map;
  }
  return undefined;
}

function editModelYaml(
  files: ProjectFiles,
  ymlPath: string,
  name: string,
  fn: (doc: Document, table: YAMLMap) => void,
): ProjectFiles {
  const next = cloneFiles(files);
  const doc = parseDocument(next[ymlPath] ?? "version: 2\n");
  const table = findTableMap(doc, name);
  if (table) fn(doc, table);
  next[ymlPath] = writeDoc(doc);
  return next;
}

function hasTag(tags: YAMLSeq, value: string): boolean {
  return tags.items.some((item) => scalarString(item) === value);
}

function stampYaml(
  files: ProjectFiles,
  ymlPath: string,
  name: string,
  managed: boolean,
): ProjectFiles {
  return editModelYaml(files, ymlPath, name, (doc, table) => {
    const config = ensureMap(doc, table, "config");
    const tags = ensureSeq(doc, config, "tags");
    if (managed) {
      if (!hasTag(tags, STRATA_MANAGED_TAG)) tags.add(STRATA_MANAGED_TAG);
    } else {
      tags.items = tags.items.filter((item) => scalarString(item) !== STRATA_MANAGED_TAG);
    }
    const strata = ensureMap(doc, ensureMap(doc, config, "meta"), "strata");
    if (managed) {
      strata.set("managed", true);
      strata.set("generator", GENERATOR_NAME);
      strata.set("generator_version", GENERATOR_VERSION);
    } else {
      strata.delete("managed");
      strata.delete("generator");
      strata.delete("generator_version");
    }
  });
}

function stampGit(files: ProjectFiles, sqlPath: string, present: boolean): ProjectFiles {
  const next = cloneFiles(files);
  next[GITATTRIBUTES_PATH] = setGitAttributesPath(next[GITATTRIBUTES_PATH] ?? "", sqlPath, present);
  return next;
}

export function stampManaged(files: ProjectFiles, project: string, tableId: string): ProjectFiles {
  const loc = findManagedModel(files, project, tableId);
  if (!loc) return files;
  let next = stampYaml(files, loc.ymlPath, loc.name, true);
  const sql = ensureSqlHeader(next[loc.sqlPath] ?? "");
  next[loc.sqlPath] = sql;
  next = stampGit(next, loc.sqlPath, true);
  return setLockEntry(next, loc.sqlPath, sql);
}

export function unstampPath(files: ProjectFiles, sqlPath: string): ProjectFiles {
  return removeLockEntry(stampGit(files, sqlPath, false), sqlPath);
}

export function retargetManagedPath(files: ProjectFiles, from: string, to: string): ProjectFiles {
  if (from === to) return files;
  let next = stampGit(files, from, false);
  next = stampGit(next, to, true);
  const sql = next[to];
  if (sql != null) next = setLockEntry(retargetLockEntry(next, from, to), to, sql);
  else next = retargetLockEntry(next, from, to);
  return next;
}

export function markModelManaged(
  before: ProjectFiles,
  current: ProjectFiles,
  project: string,
  tableId: string,
): EditResult {
  return commitFiles(before, stampManaged(current, project, tableId));
}

export function makeManual(files: ProjectFiles, project: string, tableId: string): EditResult {
  const loc = findManagedModel(files, project, tableId);
  if (!loc) return { files, changes: {} };
  let next = stampYaml(files, loc.ymlPath, loc.name, false);
  next = unstampPath(next, loc.sqlPath);
  return commitFiles(files, next);
}

export function regenerate(
  files: ProjectFiles,
  project: string,
  tableId: string,
  opts: RegenerateOpts,
): EditResult {
  if (!opts.confirmed) return { files, changes: {} };
  const loc = findManagedModel(files, project, tableId);
  if (!loc) return { files, changes: {} };
  let next = cloneFiles(files);
  const sql = ensureSqlHeader(opts.sql ?? next[loc.sqlPath] ?? "");
  next[loc.sqlPath] = sql;
  next = stampManaged(next, project, tableId);
  return commitFiles(files, next);
}
