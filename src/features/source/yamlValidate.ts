import { isMap, isSeq, parseDocument, type YAMLMap, type YAMLSeq } from "yaml";

export type YamlValidateOk = { ok: true };
export type YamlValidateErr = { ok: false; line: number; message: string };
export type YamlValidateResult = YamlValidateOk | YamlValidateErr;

function asMap(node: unknown): YAMLMap | undefined {
  return isMap(node) ? node : undefined;
}

function asSeq(node: unknown): YAMLSeq | undefined {
  return isSeq(node) ? node : undefined;
}

function scalarName(node: unknown): string | undefined {
  if (typeof node === "string" || typeof node === "number") return String(node);
  const rec = node as { toString?: () => string; value?: unknown } | null;
  if (rec && typeof rec.value === "string") return rec.value;
  return undefined;
}

function rangeLine(text: string, range: [number, number, number] | number[] | undefined): number {
  if (!range || range[0] == null) return 0;
  return text.slice(0, range[0]).split("\n").length - 1;
}

function fail(line: number, message: string): YamlValidateErr {
  return { ok: false, line: Math.max(0, line), message };
}

function checkColumns(text: string, columns: YAMLSeq, prefix: string): YamlValidateErr | null {
  for (const item of columns.items) {
    const col = asMap(item);
    if (!col) return fail(0, `${prefix}: each column must be a mapping`);
    const name = col.get("name", true);
    if (!scalarName(col.get("name"))) {
      const line = rangeLine(
        text,
        (name as { range?: [number, number, number] } | undefined)?.range,
      );
      const fallback = rangeLine(text, col.range ?? undefined);
      return fail(line || fallback, `${prefix}: columns[].name is required`);
    }
  }
  return null;
}

export function validateDbtYaml(text: string): YamlValidateResult {
  const doc = parseDocument(text, { prettyErrors: true });
  if (doc.errors.length) {
    const err = doc.errors[0];
    const line = (err.linePos?.[0]?.line ?? 1) - 1;
    return fail(line, err.message);
  }
  const root = asMap(doc.contents);
  if (!root) return fail(0, "YAML root must be a mapping");
  if (root.get("version") == null) return fail(0, "version is required");

  const models = asSeq(root.get("models"));
  const sources = asSeq(root.get("sources"));
  if (!models && !sources) return fail(0, "models or sources is required");

  if (models) {
    for (const item of models.items) {
      const model = asMap(item);
      if (!model) return fail(0, "models[] must be mappings");
      const cols = asSeq(model.get("columns"));
      if (cols) {
        const err = checkColumns(text, cols, "models");
        if (err) return err;
      }
    }
  }
  if (sources) {
    for (const srcItem of sources.items) {
      const source = asMap(srcItem);
      if (!source) continue;
      const tables = asSeq(source.get("tables"));
      if (!tables) continue;
      for (const tableItem of tables.items) {
        const table = asMap(tableItem);
        if (!table) continue;
        const cols = asSeq(table.get("columns"));
        if (!cols) continue;
        const err = checkColumns(text, cols, "sources");
        if (err) return err;
      }
    }
  }
  return { ok: true };
}
