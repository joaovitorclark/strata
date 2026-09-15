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
import * as yamlEdit from "./yamlEdit";
import type { EditResult } from "./yamlEdit";

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

function writeDoc(doc: Document): string {
  const text = String(doc);
  return text.endsWith("\n") ? text : `${text}\n`;
}

function markInferred(
  doc: Document,
  args: { targetColumn: string; from: string; inferred: "parsed" | "name" },
): void {
  const visitCols = (cols: YAMLSeq | undefined) => {
    if (!cols) return;
    for (const item of cols.items) {
      const col = asYamlMap(item);
      if (!col || scalarString(col.get("name")) !== args.targetColumn) continue;
      const lin = asYamlSeq(
        asYamlMap(asYamlMap(asYamlMap(col.get("config"))?.get("meta"))?.get("strata"))?.get(
          "lineage",
        ),
      );
      if (!lin) continue;
      for (const entry of lin.items) {
        const map = asYamlMap(entry);
        if (!map || scalarString(map.get("from")) !== args.from) continue;
        map.set("inferred", args.inferred);
      }
    }
  };
  const models = asYamlSeq(doc.get("models"));
  if (models) {
    for (const item of models.items) visitCols(asYamlSeq(asYamlMap(item)?.get("columns")));
  }
  const sources = asYamlSeq(doc.get("sources"));
  if (!sources) return;
  for (const src of sources.items) {
    const tables = asYamlSeq(asYamlMap(src)?.get("tables"));
    if (!tables) continue;
    for (const table of tables.items) visitCols(asYamlSeq(asYamlMap(table)?.get("columns")));
  }
}

export function confirmInferredLineage(
  files: ProjectFiles,
  project: string,
  args: {
    targetTable: string;
    targetColumn: string;
    from: string;
    inferred: "parsed" | "name";
  },
): EditResult {
  const added = yamlEdit.addLineage(files, project, {
    targetTable: args.targetTable,
    targetColumn: args.targetColumn,
    from: args.from,
  });
  const ymlPath = Object.keys(added.changes).find(
    (p) => (p.endsWith(".yml") || p.endsWith(".yaml")) && added.changes[p] != null,
  );
  if (!ymlPath || added.changes[ymlPath] == null) return added;
  const doc = parseDocument(added.changes[ymlPath]!);
  markInferred(doc, args);
  const nextText = writeDoc(doc);
  const nextFiles = { ...added.files, [ymlPath]: nextText };
  return { files: nextFiles, changes: { ...added.changes, [ymlPath]: nextText } };
}

export function dismissInferredLineage(
  files: ProjectFiles,
  project: string,
  args: { targetTable: string; targetColumn: string; from: string },
): EditResult {
  const relPath = `.strata/${project}/lineage-dismissed.yml`;
  const entry = `${args.targetTable}.${args.targetColumn} ← ${args.from}`;
  const doc = parseDocument(files[relPath] ?? "dismissed: []\n");
  let seq = asYamlSeq(doc.get("dismissed"));
  if (!seq) {
    doc.set("dismissed", doc.createNode([]));
    seq = asYamlSeq(doc.get("dismissed"));
  }
  if (!seq) return { files, changes: {} };
  const exists = seq.items.some((item) => scalarString(item) === entry);
  if (!exists) seq.add(entry);
  const nextText = writeDoc(doc);
  const nextFiles = { ...files, [relPath]: nextText };
  return { files: nextFiles, changes: { [relPath]: nextText } };
}
