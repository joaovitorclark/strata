import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ProjectFiles } from "@/features/dbt-source";
import * as yamlEdit from "@/features/dbt-source/yamlEdit";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const HAND = path.join(ROOT, "fixtures/dbt-source/handwritten");
const PROJECT = "demo";
const WIDGET_YML = "models/demo/main/_widget.yml";
const MANUAL_SQL = "models/demo/main/manual.sql";
const GADGET_SQL = "models/demo/main/gadget.sql";

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

function changedPaths(before: ProjectFiles, result: yamlEdit.EditResult): string[] {
  return Object.keys(result.changes).sort();
}

describe("D2 G2 yamlEdit on handwritten/", () => {
  it("addTable only creates the new model files + canvas position", () => {
    const before = load();
    const result = yamlEdit.addTable(before, PROJECT, { tableId: "main.nova" });
    expect(result.changes["models/demo/main/_nova.yml"]).toContain("name: nova");
    expect(result.changes["models/demo/main/nova.sql"]).toBeTruthy();
    expect(before[WIDGET_YML]).toBe(result.files[WIDGET_YML]);
    preserved(result.files[WIDGET_YML]);
  });

  it("removeTable drops yml+sql and leaves handwritten markers", () => {
    const before = load();
    const result = yamlEdit.removeTable(before, PROJECT, "main.gadget");
    expect(result.changes["models/demo/main/_gadget.yml"]).toBeNull();
    expect(result.changes["models/demo/main/gadget.sql"]).toBeNull();
    preserved(result.files[WIDGET_YML]);
  });

  it("renameTable updates managed ref() and lineage; manual SQL intact + problem", () => {
    const before = load();
    const result = yamlEdit.renameTable(before, PROJECT, "main.widget", "main.renamed");
    expect(result.files["models/demo/main/_renamed.yml"]).toContain("name: renamed");
    expect(result.files[GADGET_SQL]).toContain("ref('renamed')");
    expect(result.files[MANUAL_SQL]).toBe(before[MANUAL_SQL]);
    expect(result.problems?.some((p) => p.includes("manual.sql"))).toBe(true);
    expect(result.files["models/demo/main/_gadget.yml"]).toContain("main.renamed.id");
    expect(result.files["models/demo/main/_renamed.yml"]).toContain("# keep-me");
    expect(result.files["models/demo/main/_renamed.yml"]).toContain("custom_test_widget");
    expect(result.files["models/demo/main/_renamed.yml"]).toContain("&status_col");
  });

  it("addColumn only adds name+data_type", () => {
    const before = load();
    const result = yamlEdit.addColumn(before, PROJECT, "main.widget", "extra", "int");
    expect(changedPaths(before, result)).toEqual([WIDGET_YML]);
    expect(result.files[WIDGET_YML]).toMatch(/name: extra[\s\S]*data_type: int/);
    preserved(result.files[WIDGET_YML]);
  });

  it("removeColumn removes only that column", () => {
    const before = load();
    const result = yamlEdit.removeColumn(before, PROJECT, "main.widget", "zed");
    expect(result.files[WIDGET_YML]).not.toContain("name: zed");
    expect(result.files[WIDGET_YML]).toContain("custom_test_widget");
    expect(result.files[WIDGET_YML]).toContain("# keep-me");
  });

  it("renameColumn changes only the name: line of that column", () => {
    const before = load();
    const result = yamlEdit.renameColumn(before, PROJECT, "main.widget", "zed", "zeta");
    const beforeLines = before[WIDGET_YML].split("\n");
    const afterLines = result.files[WIDGET_YML].split("\n");
    const diffs = afterLines.filter((l, i) => l !== beforeLines[i]);
    expect(diffs.some((l) => l.includes("name: zeta"))).toBe(true);
    expect(result.files[WIDGET_YML]).not.toContain("name: zed");
    preserved(result.files[WIDGET_YML]);
  });

  it("setColumnType writes data_type only", () => {
    const result = yamlEdit.setColumnType(load(), PROJECT, "main.widget", "zed", "struct<a:int>");
    expect(result.files[WIDGET_YML]).toMatch(/data_type:\s*["']?struct<a:int>/);
    preserved(result.files[WIDGET_YML]);
  });

  it("setNotNull / setUnique / setPrimaryKey / setDefault / setDescription", () => {
    const base = load();
    const nn = yamlEdit.setNotNull(base, PROJECT, "raw.events", "widget_id", false);
    expect(nn.files["models/demo/main/_sources.yml"]).not.toMatch(/widget_id:[\s\S]*?- not_null/);
    const uq = yamlEdit.setUnique(base, PROJECT, "raw.events", "widget_id", true);
    expect(uq.files["models/demo/main/_sources.yml"]).toContain("unique");
    const pk = yamlEdit.setPrimaryKey(base, PROJECT, "main.widget", "zed", true);
    expect(pk.files[WIDGET_YML]).toMatch(/type: primary_key[\s\S]*zed/);
    const def = yamlEdit.setDefault(base, PROJECT, "main.widget", "zed", "0");
    expect(def.files[WIDGET_YML]).toContain("default: ");
    const desc = yamlEdit.setDescription(base, PROJECT, "main.widget", "nota da tabela");
    expect(desc.files[WIDGET_YML]).toContain("nota da tabela");
    preserved(desc.files[WIDGET_YML]);
  });

  it("addRef / removeRef on the source column", () => {
    const base = load();
    const added = yamlEdit.addRef(base, PROJECT, {
      fromTable: "raw.events",
      fromCol: "id",
      toTable: "main.widget",
      toCol: "id",
    });
    expect(added.files["models/demo/main/_sources.yml"]).toContain("relationships");
    const removed = yamlEdit.removeRef(base, PROJECT, {
      fromTable: "raw.events",
      fromCol: "widget_id",
      toTable: "main.widget",
      toCol: "id",
    });
    expect(removed.files["models/demo/main/_sources.yml"]).not.toContain("to: ref('widget')");
  });

  it("addLineage / updateLineage / removeLineage on the target column", () => {
    const base = load();
    const added = yamlEdit.addLineage(base, PROJECT, {
      targetTable: "main.widget",
      targetColumn: "zed",
      from: "raw.events.id",
    });
    expect(added.files[WIDGET_YML]).toContain("raw.events.id");
    const updated = yamlEdit.updateLineage(added.files, PROJECT, {
      targetTable: "main.widget",
      targetColumn: "zed",
      from: "raw.events.id",
      expr: "1",
    });
    expect(updated.files[WIDGET_YML]).toContain("expr:");
    const removed = yamlEdit.removeLineage(updated.files, PROJECT, {
      targetTable: "main.widget",
      targetColumn: "zed",
      from: "raw.events.id",
    });
    expect(removed.files[WIDGET_YML]).not.toContain("raw.events.id");
    preserved(removed.files[WIDGET_YML]);
  });

  it("setLayer moves yml+sql with no duplicate leftovers", () => {
    const result = yamlEdit.setLayer(load(), PROJECT, "main.gadget", "silver");
    expect(result.files["models/demo/silver/_gadget.yml"]).toBeTruthy();
    expect(result.files["models/demo/silver/gadget.sql"]).toBeTruthy();
    expect(result.files["models/demo/main/_gadget.yml"]).toBeUndefined();
    expect(result.files["models/demo/main/gadget.sql"]).toBeUndefined();
  });

  it("setGroup / setEnum / setIndexes / setRecords", () => {
    const base = load();
    const g = yamlEdit.setGroup(base, PROJECT, "main.widget", "core");
    expect(g.files[WIDGET_YML]).toContain("core");
    const en = yamlEdit.setEnum(base, PROJECT, "main.widget", "status", "flag", ["on", "off"]);
    expect(en.files[WIDGET_YML]).toContain("enum: flag");
    const idx = yamlEdit.setIndexes(base, PROJECT, "main.widget", [
      { columns: ["zed"], name: "idx_zed" },
    ]);
    expect(idx.files[WIDGET_YML]).toContain("idx_zed");
    const rec = yamlEdit.setRecords(base, PROJECT, "main.widget", ["id"], [["9"]]);
    expect(rec.files["seeds/demo/records_main_widget.csv"]).toContain("9");
    preserved(g.files[WIDGET_YML]);
  });

  it("visual ops only touch canvas.yml / views.yml", () => {
    const base = load();
    const pos = yamlEdit.setPositions(base, PROJECT, { "main.widget": { x: 1, y: 2 } });
    expect(Object.keys(pos.changes).every((p) => p.startsWith(".strata/"))).toBe(true);
    expect(pos.files[WIDGET_YML]).toBe(base[WIDGET_YML]);
    const size = yamlEdit.setSize(base, PROJECT, "main.widget", { width: 240 });
    expect(size.files[".strata/demo/canvas.yml"]).toContain("240");
    const color = yamlEdit.setColor(base, PROJECT, "main.widget", "#111111");
    expect(color.files[".strata/demo/canvas.yml"]).toContain("#111111");
    const pins = yamlEdit.setPins(base, PROJECT, ["main.widget.zed"]);
    expect(pins.files[".strata/demo/canvas.yml"]).toContain("main.widget.zed");
    const views = yamlEdit.setViews(base, PROJECT, [
      { id: "x", name: "x", tables: ["main.widget"] },
    ]);
    expect(Object.keys(views.changes)).toEqual([".strata/demo/views.yml"]);
  });
});
