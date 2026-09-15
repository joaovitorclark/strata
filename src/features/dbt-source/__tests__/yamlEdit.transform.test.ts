import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ProjectFiles } from "@/features/dbt-source";
import { MANAGED_SQL_HEADER } from "@/features/dbt-source/managedHeader";
import { applyDbtAction } from "@/features/dbt-source/mutations";
import { setColumnExpr, setTransform } from "@/features/dbt-source/yamlEdit.transform";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const HAND = path.join(ROOT, "fixtures/dbt-source/handwritten");
const PROJECT = "demo";
const WIDGET_YML = "models/demo/main/_widget.yml";
const WIDGET_SQL = "models/demo/main/widget.sql";
const GADGET_YML = "models/demo/main/_gadget.yml";
const GADGET_SQL = "models/demo/main/gadget.sql";
const MANUAL_SQL = "models/demo/main/manual.sql";

function readProjectFiles(root: string): ProjectFiles {
  const files: ProjectFiles = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files[path.relative(root, full).split(path.sep).join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return files;
}

function load(): ProjectFiles {
  return readProjectFiles(HAND);
}

function preserved(yml: string): void {
  expect(yml).toContain("# keep-me");
  expect(yml).toContain("snowflake_warehouse: analytics_wh");
  expect(yml).toContain("custom_test_widget");
  expect(yml).toContain("&status_col");
  expect(yml).toContain("*status_col");
  expect(yml).toContain("name: widget");
}

function lineDiffs(before: string, after: string): string[] {
  const b = before.split("\n");
  const a = after.split("\n");
  const max = Math.max(a.length, b.length);
  const diffs: string[] = [];
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) diffs.push(a[i] ?? `(removed) ${b[i]}`);
  }
  return diffs;
}

describe("D4 G6 setTransform / setColumnExpr on handwritten/", () => {
  it("setTransform writes transform IR and regenerates managed SQL; handwritten markers stay", () => {
    const before = load();
    const result = setTransform(before, PROJECT, "main.widget", {
      from: { source: ["raw", "events"], alias: "e" },
      joins: [],
      where: "",
      group_by: [],
    });
    expect(Object.keys(result.changes).sort()).toEqual([WIDGET_SQL, WIDGET_YML].sort());
    preserved(result.files[WIDGET_YML]);
    expect(result.files[WIDGET_YML]).toContain("from:");
    expect(result.files[WIDGET_YML]).toMatch(/alias:\s*e/);
    expect(result.files[WIDGET_YML]).toContain("raw");
    expect(result.files[WIDGET_YML]).toContain("events");
    expect(result.files[WIDGET_SQL].startsWith(`${MANAGED_SQL_HEADER}\n`)).toBe(true);
    expect(result.files[WIDGET_SQL]).toContain("{{ source('raw', 'events') }}");
    expect(result.files[MANUAL_SQL]).toBe(before[MANUAL_SQL]);
    expect(result.files[GADGET_YML]).toBe(before[GADGET_YML]);
    expect(result.files[GADGET_SQL]).toBe(before[GADGET_SQL]);
  });

  it("setColumnExpr changes only the expr line (and SQL if transform exists)", () => {
    const before = load();
    const result = setColumnExpr(before, PROJECT, "main.gadget", "id", "cast(id as int)");
    expect(result.files[GADGET_YML]).toContain("expr: cast(id as int)");
    expect(result.files[GADGET_YML]).not.toContain("expr: cast(id as bigint)");
    preserved(before[WIDGET_YML]);
    expect(result.files[WIDGET_YML]).toBe(before[WIDGET_YML]);
    expect(result.files[MANUAL_SQL]).toBe(before[MANUAL_SQL]);
    const diffs = lineDiffs(before[GADGET_YML], result.files[GADGET_YML]);
    expect(diffs.some((l) => l.includes("expr:"))).toBe(true);
    expect(diffs.filter((l) => !l.includes("expr") && l.trim() !== "").length).toBe(0);
  });

  it("mutations setTransform / setColumnExpr route to the same ops", () => {
    const before = load();
    const viaMut = applyDbtAction(before, PROJECT, {
      op: "setTransform",
      tableId: "main.widget",
      transform: { from: { ref: "gadget", alias: "g" }, joins: [], group_by: [] },
    });
    const viaFn = setTransform(before, PROJECT, "main.widget", {
      from: { ref: "gadget", alias: "g" },
      joins: [],
      group_by: [],
    });
    expect(viaMut.files[WIDGET_YML]).toBe(viaFn.files[WIDGET_YML]);
    expect(viaMut.files[WIDGET_SQL]).toBe(viaFn.files[WIDGET_SQL]);

    const exprMut = applyDbtAction(before, PROJECT, {
      op: "setColumnExpr",
      tableId: "main.gadget",
      column: "id",
      expr: "id",
    });
    expect(exprMut.files[GADGET_YML]).toContain("expr: id");
  });

  it("setTransform does not rewrite a manual model .sql", () => {
    const before = load();
    const result = setTransform(before, PROJECT, "main.manual", {
      from: { ref: "widget", alias: "w" },
    });
    expect(result.files[MANUAL_SQL]).toBe(before[MANUAL_SQL]);
  });
});
