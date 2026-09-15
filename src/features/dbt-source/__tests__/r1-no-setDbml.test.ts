import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { useSchemaStore } from "@/features/schema/store";
import { allTablesPage } from "@/features/canvas/utils/pageFilter";
import type { DbtAction } from "@/features/dbt-source/mutations";
import { readProjectFiles } from "./gates.test";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const HAND = path.join(ROOT, "fixtures/dbt-source/handwritten");

const ACTIONS: DbtAction[] = [
  { op: "addTable", tableId: "main.r1tab" },
  { op: "addColumn", tableId: "main.widget", name: "r1col", dataType: "int" },
  { op: "setColumnType", tableId: "main.widget", column: "zed", dataType: "bigint" },
  { op: "setNotNull", tableId: "main.widget", column: "zed", value: true },
  { op: "setUnique", tableId: "main.widget", column: "zed", value: true },
  { op: "setPrimaryKey", tableId: "main.widget", column: "zed", value: true },
  { op: "setDefault", tableId: "main.widget", column: "zed", value: "1" },
  { op: "setDescription", tableId: "main.widget", description: "n" },
  { op: "renameColumn", tableId: "main.widget", oldName: "r1col", newName: "r1col2" },
  { op: "addRef", fromTable: "raw.events", fromCol: "id", toTable: "main.widget", toCol: "id" },
  { op: "removeRef", fromTable: "raw.events", fromCol: "id", toTable: "main.widget", toCol: "id" },
  { op: "addLineage", targetTable: "main.widget", targetColumn: "zed", from: "raw.events.id" },
  {
    op: "updateLineage",
    targetTable: "main.widget",
    targetColumn: "zed",
    from: "raw.events.id",
    expr: "x",
  },
  { op: "removeLineage", targetTable: "main.widget", targetColumn: "zed", from: "raw.events.id" },
  { op: "setLayer", tableId: "main.gadget", layer: "silver" },
  { op: "addLayerGroup" },
  { op: "setGroup", tableId: "main.widget", group: "core" },
  { op: "setColor", key: "main.widget", color: "#111" },
  { op: "setPins", pins: ["main.widget.zed"] },
  { op: "setPositions", positions: { "main.widget": { x: 1, y: 2 } } },
  { op: "setSize", tableId: "main.widget", size: { width: 200 } },
  { op: "setCollapsedGroups", groups: [] },
  { op: "setViews", views: [{ id: "v", name: "v", tables: ["main.widget"] }] },
  { op: "organize" },
  { op: "setEnum", tableId: "main.widget", column: "status", enumName: "flag", values: ["a"] },
  { op: "setIndexes", tableId: "main.widget", indexes: [{ columns: ["zed"] }] },
  { op: "setRecords", tableId: "main.widget", columns: ["id"], rows: [["1"]] },
  { op: "setRolename", tableId: "main.widget", column: "zed", rolename: "role" },
  { op: "renameTable", tableId: "main.r1tab", newId: "main.r1renamed" },
  { op: "removeColumn", tableId: "main.widget", column: "r1col2" },
  { op: "removeTable", tableId: "main.r1renamed" },
];

describe("D2 R1 dbt never calls setDbml", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });

  it("inventory ops + pin/positions/views skip setDbml", () => {
    const files = readProjectFiles(HAND);
    useSchemaStore.getState().hydrateDocument({
      dbml: "Table placeholder { id int }",
      positions: {},
      sizes: {},
      colors: {},
      collapsedGroups: [],
      canvasPages: [allTablesPage()],
      activePageIds: ["__all__"],
      readOnly: false,
      files,
      documentFormat: "dbt",
      dbtProject: "demo",
    });
    const spy = vi.spyOn(useSchemaStore.getState(), "setDbml");
    for (const action of ACTIONS) {
      useSchemaStore.getState().applyDbtOp(action);
    }
    useSchemaStore.getState().pinColumn("main.widget", "zed");
    useSchemaStore.getState().unpinColumn("main.widget", "zed");
    useSchemaStore.getState().setPositions({ "main.widget": { x: 9, y: 9 } });
    useSchemaStore.getState().applyDbtOp({ op: "organize" });
    expect(spy, "setDbml must not run for a hydrated dbt project").not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
