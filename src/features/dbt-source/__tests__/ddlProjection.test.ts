import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyDbtAction } from "@/features/dbt-source/mutations";
import {
  fromDbtProject,
  type ProjectFiles,
  type StrataModel,
  type StrataTable,
} from "@/features/dbt-source";
import { ddlToOperations, toDdl, type DdlDialect } from "@/features/dbt-source/ddlProjection";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const KITCHEN = path.join(ROOT, "fixtures/dbt-source/kitchen-sink");
const HAND = path.join(ROOT, "fixtures/dbt-source/handwritten");
const DIALECTS: DdlDialect[] = ["spark", "postgres", "oracle"];

function readProjectFiles(root: string): ProjectFiles {
  const files: ProjectFiles = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "target" || name === "logs" || name === "dbt_packages") continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files[path.relative(root, full).split(path.sep).join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return files;
}

function emptyModel(tables: StrataTable[], refs: StrataModel["refs"] = []): StrataModel {
  return {
    project: "demo",
    tables,
    refs,
    records: [],
    layerGroups: [],
    lineageFields: [],
    rolenames: [],
    colors: {},
    pins: [],
    views: [],
    enums: [],
  };
}

const widget: StrataTable = {
  id: "main.widget",
  name: "widget",
  schema: "main",
  project: "demo",
  kind: "model",
  layer: "main",
  columns: [
    { name: "id", type: "bigint", pk: true, notNull: true },
    { name: "email", type: "string", pk: false, notNull: false },
  ],
};

const gadget: StrataTable = {
  id: "main.gadget",
  name: "gadget",
  schema: "main",
  project: "demo",
  kind: "model",
  layer: "main",
  columns: [{ name: "id", type: "bigint", pk: true, notNull: true }],
};

function pythonSqlglot(): string {
  const venv = path.join(ROOT, ".venv-dbt", "bin", "python");
  if (existsSync(venv)) return venv;
  return "python3";
}

function ensureSqlglot(py: string): void {
  try {
    execFileSync(py, ["-c", "import sqlglot"], { encoding: "utf8" });
  } catch {
    execFileSync(py, ["-m", "pip", "install", "-q", "sqlglot"], { encoding: "utf8" });
  }
}

function sqlglotParse(sql: string, dialect: DdlDialect): void {
  const py = pythonSqlglot();
  ensureSqlglot(py);
  const mapped = dialect === "spark" ? "spark" : dialect === "oracle" ? "oracle" : "postgres";
  execFileSync(
    py,
    ["-c", "import sys, sqlglot; sqlglot.parse(sys.stdin.read(), dialect=sys.argv[1])", mapped],
    { input: sql, encoding: "utf8" },
  );
}

function opsOf(result: ReturnType<typeof ddlToOperations>) {
  expect(result.kind).toBe("ops");
  if (result.kind !== "ops") throw new Error("expected ops");
  return result.ops;
}

describe("D3 G1 toDdl kitchen-sink accepted by sqlglot", () => {
  it.each(DIALECTS)("toDdl(vendas, %s) parses in sqlglot", (dialect) => {
    const model = fromDbtProject(readProjectFiles(KITCHEN), "vendas");
    const { text, map } = toDdl(model, { dialect });
    expect(text).toMatch(/CREATE TABLE/i);
    expect(map.tables["gold.dim_cliente"]?.file).toBe("models/vendas/gold/_dim_cliente.yml");
    sqlglotParse(text, dialect);
  });
});

describe("D3 G2 ddlToOperations — one op per supported change", () => {
  const model = emptyModel([widget, gadget]);
  const before = toDdl(model, { dialect: "spark" }).text;

  it("create table", () => {
    const after = `${before}\nCREATE TABLE IF NOT EXISTS main.nova (\n  id BIGINT NOT NULL,\n  PRIMARY KEY (id)\n)\nUSING DELTA;\n`;
    expect(opsOf(ddlToOperations(before, after, model, "spark"))).toEqual([
      { op: "addTable", tableId: "main.nova" },
    ]);
  });

  it("remove table", () => {
    const onlyWidget = emptyModel([widget]);
    const after = toDdl(onlyWidget, { dialect: "spark" }).text;
    expect(opsOf(ddlToOperations(before, after, model, "spark"))).toEqual([
      { op: "removeTable", tableId: "main.gadget" },
    ]);
  });

  it("add column", () => {
    const next = emptyModel([
      {
        ...widget,
        columns: [...widget.columns, { name: "extra", type: "int", pk: false, notNull: false }],
      },
      gadget,
    ]);
    const after = toDdl(next, { dialect: "spark" }).text;
    expect(opsOf(ddlToOperations(before, after, model, "spark"))).toEqual([
      { op: "addColumn", tableId: "main.widget", name: "extra", dataType: "int" },
    ]);
  });

  it("remove column", () => {
    const next = emptyModel([{ ...widget, columns: [widget.columns[0]] }, gadget]);
    const after = toDdl(next, { dialect: "spark" }).text;
    expect(opsOf(ddlToOperations(before, after, model, "spark"))).toEqual([
      { op: "removeColumn", tableId: "main.widget", column: "email" },
    ]);
  });

  it("rename column", () => {
    const next = emptyModel([
      {
        ...widget,
        columns: [widget.columns[0], { ...widget.columns[1], name: "email_addr" }],
      },
      gadget,
    ]);
    const after = toDdl(next, { dialect: "spark" }).text;
    expect(opsOf(ddlToOperations(before, after, model, "spark"))).toEqual([
      { op: "renameColumn", tableId: "main.widget", oldName: "email", newName: "email_addr" },
    ]);
  });

  it("change type", () => {
    const next = emptyModel([
      {
        ...widget,
        columns: [widget.columns[0], { ...widget.columns[1], type: "int" }],
      },
      gadget,
    ]);
    const after = toDdl(next, { dialect: "spark" }).text;
    expect(opsOf(ddlToOperations(before, after, model, "spark"))).toEqual([
      { op: "setColumnType", tableId: "main.widget", column: "email", dataType: "int" },
    ]);
  });

  it("NOT NULL", () => {
    const next = emptyModel([
      {
        ...widget,
        columns: [widget.columns[0], { ...widget.columns[1], notNull: true }],
      },
      gadget,
    ]);
    const after = toDdl(next, { dialect: "spark" }).text;
    expect(opsOf(ddlToOperations(before, after, model, "spark"))).toEqual([
      { op: "setNotNull", tableId: "main.widget", column: "email", value: true },
    ]);
  });

  it("PRIMARY KEY", () => {
    const next = emptyModel([
      {
        ...widget,
        columns: [
          { ...widget.columns[0], pk: false },
          { ...widget.columns[1], pk: true, notNull: true },
        ],
      },
      gadget,
    ]);
    const after = toDdl(next, { dialect: "spark" }).text;
    const ops = opsOf(ddlToOperations(before, after, model, "spark"));
    expect(ops).toContainEqual({
      op: "setPrimaryKey",
      tableId: "main.widget",
      column: "email",
      value: true,
    });
    expect(ops).toContainEqual({
      op: "setPrimaryKey",
      tableId: "main.widget",
      column: "id",
      value: false,
    });
  });

  it("REFERENCES", () => {
    const withRef = emptyModel(
      [widget, gadget],
      [
        {
          id: "fk_widget_gadget",
          source: "main.widget",
          target: "main.gadget",
          fromCol: "email",
          toCol: "id",
          fromRel: "*",
          toRel: "1",
        },
      ],
    );
    const after = toDdl(withRef, { dialect: "spark" }).text;
    expect(opsOf(ddlToOperations(before, after, model, "spark"))).toEqual([
      {
        op: "addRef",
        fromTable: "main.widget",
        fromCol: "email",
        toTable: "main.gadget",
        toCol: "id",
      },
    ]);
  });
});

describe("D3 G3 unsupported PARTITIONED BY", () => {
  it("returns DdlError with line and zero ops", () => {
    const model = emptyModel([widget]);
    const before = toDdl(model, { dialect: "spark" }).text;
    const after = before.replace("USING DELTA;", "USING DELTA\nPARTITIONED BY (email);");
    const result = ddlToOperations(before, after, model, "spark");
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("expected error");
    expect(result.line).toBeGreaterThan(0);
    expect(result.message.toLowerCase()).toMatch(/dbt|partition/);
    expect(result.ops ?? []).toEqual([]);
  });
});

describe("D3 G4 ambiguous rename", () => {
  it("returns needsConfirmation and zero ops until resolved", () => {
    const twoInt: StrataTable = {
      ...widget,
      columns: [
        { name: "a", type: "int", pk: false, notNull: false },
        { name: "b", type: "int", pk: false, notNull: false },
      ],
    };
    const model = emptyModel([twoInt]);
    const before = toDdl(model, { dialect: "spark" }).text;
    const swapped = emptyModel([
      {
        ...twoInt,
        columns: [
          { name: "x", type: "int", pk: false, notNull: false },
          { name: "y", type: "int", pk: false, notNull: false },
        ],
      },
    ]);
    const after = toDdl(swapped, { dialect: "spark" }).text;
    const result = ddlToOperations(before, after, model, "spark");
    expect(result.kind).toBe("needsConfirmation");
    if (result.kind !== "needsConfirmation") throw new Error("expected confirm");
    expect(result.ops ?? []).toEqual([]);
    expect(result.candidates.length).toBeGreaterThan(0);

    const resolved = ddlToOperations(before, after, model, "spark", {
      confirmRenames: [
        { tableId: "main.widget", oldName: "a", newName: "x" },
        { tableId: "main.widget", oldName: "b", newName: "y" },
      ],
    });
    expect(opsOf(resolved)).toEqual([
      { op: "renameColumn", tableId: "main.widget", oldName: "a", newName: "x" },
      { op: "renameColumn", tableId: "main.widget", oldName: "b", newName: "y" },
    ]);
  });
});

describe("D3 G5 handwritten DDL save only expected YAML lines", () => {
  it("addColumn via ddlToOperations + applyDbtAction preserves comments/tests/config", () => {
    const files = readProjectFiles(HAND);
    const model = fromDbtProject(files, "demo");
    const before = toDdl(model, { dialect: "spark" }).text;
    const widgetTable = model.tables.find((t) => t.id === "main.widget");
    expect(widgetTable).toBeTruthy();
    const nextModel: StrataModel = {
      ...model,
      tables: model.tables.map((t) =>
        t.id === "main.widget"
          ? {
              ...t,
              columns: [...t.columns, { name: "extra", type: "int", pk: false, notNull: false }],
            }
          : t,
      ),
    };
    const after = toDdl(nextModel, { dialect: "spark" }).text;
    const ops = opsOf(ddlToOperations(before, after, model, "spark"));
    expect(ops).toEqual([
      { op: "addColumn", tableId: "main.widget", name: "extra", dataType: "int" },
    ]);
    const result = applyDbtAction(files, "demo", ops[0]);
    const ymlPath = "models/demo/main/_widget.yml";
    const beforeLines = files[ymlPath].split("\n");
    const afterLines = result.files[ymlPath].split("\n");
    expect(result.files[ymlPath]).toContain("# keep-me");
    expect(result.files[ymlPath]).toContain("snowflake_warehouse: analytics_wh");
    expect(result.files[ymlPath]).toContain("custom_test_widget");
    expect(result.files[ymlPath]).toContain("&status_col");
    expect(result.files[ymlPath]).toContain("*status_col");
    expect(result.files[ymlPath]).toMatch(/name: extra/);
    const changed = afterLines.filter((line, i) => line !== beforeLines[i]);
    expect(changed.some((l) => l.includes("extra") || l.includes("int"))).toBe(true);
    const otherYml = Object.keys(files).filter((p) => p.endsWith(".yml") && p !== ymlPath);
    for (const p of otherYml) {
      expect(result.files[p]).toBe(files[p]);
    }
    expect(result.files["models/demo/main/manual.sql"]).toBe(files["models/demo/main/manual.sql"]);
  });
});
