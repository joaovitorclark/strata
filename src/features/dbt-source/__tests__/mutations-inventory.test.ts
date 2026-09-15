import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const INVENTORY = path.join(ROOT, "docs/superpowers/dbt-mutations.md");
const EDIT = path.join(ROOT, "src/features/schema/model/edit.ts");
const SRC = path.join(ROOT, "src");

const UI_ROOTS = [
  "features/shell",
  "features/canvas",
  "features/panels",
  "features/command-palette",
  "features/source",
  "features/projects",
  "features/schema/store",
];

const NOT_DOCUMENT = new Set([
  "getColumnSettings",
  "getColumnSettingsFromBlocks",
  "isCompleteTableId",
  "refExists",
  "migrateCanvasPins",
  "updateFieldLineageMeta",
  "renameColumn",
  "setTableNote",
  "setRecordsNote",
  "ColSettings",
]);

function walkTs(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkTs(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@/")) {
    return path.join(SRC, spec.slice(2));
  }
  if (spec.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), spec);
  }
  return null;
}

function withExt(base: string): string | null {
  const stripped = base.replace(/\.(ts|tsx|js|jsx)$/, "");
  const candidates = [
    base,
    `${stripped}.ts`,
    `${stripped}.tsx`,
    path.join(stripped, "index.ts"),
    path.join(stripped, "index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

function namedImports(source: string, spec: string): string[] {
  const names: string[] = [];
  const re = /import\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    if (m[3] !== spec) continue;
    if (m[1]) continue;
    for (const part of m[2].split(",")) {
      const token = part.trim();
      if (!token || token.startsWith("type ")) continue;
      const alias = token.split(/\s+as\s+/);
      const imported = (alias[0] ?? "").trim();
      if (imported) names.push(imported);
    }
  }
  return names;
}

function allImportSpecs(source: string): string[] {
  const specs: string[] = [];
  const re = /import\s+(?:type\s+)?(?:[^'"\n]+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) specs.push(m[1]);
  return specs;
}

function exportedFunctions(editSrc: string): string[] {
  const names: string[] = [];
  const re = /^export function (\w+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(editSrc))) names.push(m[1]);
  return names;
}

describe("D2 G1 mutation inventory", () => {
  it("dbt-mutations.md exists and lists every UI-reached edit.ts export", () => {
    expect(existsSync(INVENTORY), "docs/superpowers/dbt-mutations.md").toBe(true);
    const inventory = readFileSync(INVENTORY, "utf8");
    const editSrc = readFileSync(EDIT, "utf8");
    const exported = exportedFunctions(editSrc);

    const files: string[] = [];
    for (const rel of UI_ROOTS) walkTs(path.join(SRC, rel), files);

    const queue = [...files];
    const seen = new Set<string>();
    const reached = new Set<string>();
    const editNorm = path.normalize(EDIT);

    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      if (!existsSync(file) || !/\.(ts|tsx)$/.test(file)) continue;
      if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
      const source = readFileSync(file, "utf8");
      for (const spec of allImportSpecs(source)) {
        const resolved = resolveImport(file, spec);
        if (!resolved) continue;
        const full = withExt(resolved);
        if (!full) continue;
        if (path.normalize(full) === editNorm) {
          for (const name of namedImports(source, spec)) reached.add(name);
          continue;
        }
        if (full.startsWith(SRC) && !full.includes(`${path.sep}__tests__${path.sep}`)) {
          queue.push(full);
        }
      }
    }

    const missing: string[] = [];
    for (const name of exported) {
      if (NOT_DOCUMENT.has(name)) continue;
      if (!reached.has(name)) continue;
      if (!inventory.includes(name) && !inventory.includes(`\`${name}\``)) missing.push(name);
    }
    expect(
      missing,
      `UI-reached edit.ts exports missing from inventory: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
