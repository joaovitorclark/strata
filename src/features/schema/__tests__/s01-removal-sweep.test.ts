import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx|css)$/.test(name)) out.push(p);
  }
  return out;
}

function productionFiles(): string[] {
  return [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "server"))].filter(
    (p) => !p.includes(`${path.sep}__tests__${path.sep}`) && !/\.test\.(ts|tsx)$/.test(p),
  );
}

function hits(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of productionFiles()) {
    const text = readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const [i, line] of text.split("\n").entries()) {
      if (pattern.test(line)) found.push(`${rel}:${i + 1}:${line.trim()}`);
    }
  }
  return found;
}

describe("S01 removal sweep", () => {
  it("G22: parsed.lineage", () => {
    expect(hits(/parsed\.lineage(?!Fields)/)).toEqual([]);
  });

  it("G23: model.lineage", () => {
    expect(hits(/model\.lineage(?!Fields)/)).toEqual([]);
  });

  it("G24: ParsedLineage", () => {
    expect(hits(/\bParsedLineage\b/)).toEqual([]);
  });

  it("G25: LineageEntry", () => {
    expect(hits(/\bLineageEntry\b/)).toEqual([]);
  });

  it("G26: LineagePorts", () => {
    expect(hits(/\bLineagePorts\b/)).toEqual([]);
  });

  it("G27: lin:", () => {
    expect(hits(/lin:/)).toEqual([]);
  });

  it("G28: onCreateLineage", () => {
    expect(hits(/\bonCreateLineage\b/)).toEqual([]);
  });

  it("G29: onRemoveLineage", () => {
    expect(hits(/\bonRemoveLineage\b/)).toEqual([]);
  });

  it("G30: fieldLineageVisible", () => {
    expect(hits(/\bfieldLineageVisible\b/)).toEqual([]);
  });

  it("G31: @origen", () => {
    expect(hits(/@origen/)).toEqual([]);
  });
});
