import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fromDbtProject, type ProjectFiles } from "@/features/dbt-source";
import { applyDbtAction, type DbtAction } from "@/features/dbt-source/mutations";
import { readProjectFiles } from "./gates.test";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const DBT_DIR = path.join(ROOT, "fixtures/dbt-source/kitchen-sink");
const PROJECT = "vendas";
const SEED = 42;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tableIndex(files: ProjectFiles): Map<string, Set<string>> {
  const model = fromDbtProject(files, PROJECT);
  const out = new Map<string, Set<string>>();
  for (const t of model.tables.filter((x) => !x.external && x.project === PROJECT)) {
    if (t.project && t.project !== PROJECT) continue;
    out.set(t.id, new Set(t.columns.map((c) => c.name)));
  }
  return out;
}

const POOL: DbtAction[] = [
  { op: "addTable", tableId: "gold.g3_alpha" },
  { op: "addColumn", tableId: "gold.g3_alpha", name: "extra", dataType: "string" },
  { op: "setColumnType", tableId: "gold.g3_alpha", column: "extra", dataType: "struct<a:int>" },
  { op: "setNotNull", tableId: "gold.g3_alpha", column: "extra", value: true },
  { op: "setUnique", tableId: "gold.g3_alpha", column: "extra", value: true },
  { op: "setDefault", tableId: "gold.g3_alpha", column: "extra", value: "0" },
  { op: "setDescription", tableId: "gold.g3_alpha", description: "g3 hello" },
  { op: "setDescription", tableId: "gold.g3_alpha", column: "extra", description: "col note" },
  {
    op: "addRef",
    fromTable: "gold.g3_alpha",
    fromCol: "extra",
    toTable: "gold.dim_cliente",
    toCol: "id",
  },
  {
    op: "addLineage",
    targetTable: "gold.g3_alpha",
    targetColumn: "extra",
    from: "gold.dim_cliente.id",
  },
  {
    op: "updateLineage",
    targetTable: "gold.g3_alpha",
    targetColumn: "extra",
    from: "gold.dim_cliente.id",
    expr: "id",
  },
  { op: "setColor", key: "gold.g3_alpha", color: "#abcdef" },
  { op: "setPositions", positions: { "gold.g3_alpha": { x: 11, y: 22 } } },
  { op: "setSize", tableId: "gold.g3_alpha", size: { width: 280, height: 160 } },
  { op: "setPins", pins: ["gold.dim_cliente.email"] },
  { op: "setGroup", tableId: "gold.g3_alpha", group: "g3" },
  {
    op: "setEnum",
    tableId: "gold.g3_alpha",
    column: "extra",
    enumName: "flag",
    values: ["on", "off"],
  },
  {
    op: "setIndexes",
    tableId: "gold.g3_alpha",
    indexes: [{ columns: ["extra"], name: "idx_extra" }],
  },
  { op: "setLayer", tableId: "gold.g3_alpha", layer: "silver" },
  { op: "renameColumn", tableId: "gold.g3_alpha", oldName: "extra", newName: "extra2" },
  { op: "setRolename", tableId: "gold.dim_cliente", column: "email", rolename: "src.email" },
  { op: "setCollapsedGroups", groups: ["dimensoes"] },
  {
    op: "removeRef",
    fromTable: "gold.g3_alpha",
    fromCol: "extra2",
    toTable: "gold.dim_cliente",
    toCol: "id",
  },
  {
    op: "removeLineage",
    targetTable: "gold.g3_alpha",
    targetColumn: "extra2",
    from: "gold.dim_cliente.id",
  },
  { op: "organize" },
];

describe("D2 G3 kitchen-sink random ops", () => {
  it("20 seeded ops still dbt-parse and keep tables that were not removed", () => {
    const rng = mulberry32(SEED);
    const setup: DbtAction[] = [
      { op: "addTable", tableId: "gold.g3_alpha" },
      { op: "addColumn", tableId: "gold.g3_alpha", name: "extra", dataType: "string" },
    ];
    const rest = POOL.filter(
      (a) => a.op !== "addTable" && !(a.op === "addColumn" && a.name === "extra"),
    );
    const picked = [...rest].sort(() => rng() - 0.5).slice(0, 18);
    const ordered: DbtAction[] = [...setup, ...picked];

    let files = readProjectFiles(DBT_DIR);
    const beforeIdx = tableIndex(files);
    const removedTables = new Set<string>();
    const removedCols = new Map<string, Set<string>>();

    for (const action of ordered) {
      if (action.op === "removeTable") removedTables.add(action.tableId);
      if (action.op === "removeColumn") {
        const set = removedCols.get(action.tableId) ?? new Set();
        set.add(action.column);
        removedCols.set(action.tableId, set);
      }
      files = applyDbtAction(files, PROJECT, action).files;
    }

    const tmp = mkdtempSync(path.join(os.tmpdir(), "strata-d2-g3-"));
    try {
      for (const [rel, content] of Object.entries(files)) {
        const dest = path.join(tmp, rel);
        mkdirSync(path.dirname(dest), { recursive: true });
        writeFileSync(dest, content, "utf8");
      }
      execFileSync("bash", [path.join(ROOT, "scripts/dbt/validate.sh"), tmp], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 180_000,
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }

    const after = fromDbtProject(files, PROJECT);
    for (const [id, cols] of beforeIdx) {
      if (removedTables.has(id)) continue;
      const table = after.tables.find((t) => t.id === id && !t.external);
      expect(table, `kept table ${id}`).toBeTruthy();
      const gone = removedCols.get(id) ?? new Set();
      for (const col of cols) {
        if (gone.has(col)) continue;
        expect(
          table!.columns.some((c) => c.name === col),
          `kept ${id}.${col}`,
        ).toBe(true);
      }
    }
  }, 180_000);
});
