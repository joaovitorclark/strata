import type { SchemaView } from "@/features/schema/model/views";
import { findManagedModel } from "./managed";
import type { ProjectFiles } from "./model";
import type { EditResult, TableKind } from "./yamlEdit";
import * as yamlEdit from "./yamlEdit";
import * as managedEdit from "./yamlEdit.managed";

export type DbtAction =
  | { op: "addTable"; tableId: string; kind?: TableKind; position?: { x: number; y: number } }
  | { op: "removeTable"; tableId: string }
  | { op: "renameTable"; tableId: string; newId: string }
  | { op: "addColumn"; tableId: string; name: string; dataType?: string }
  | { op: "removeColumn"; tableId: string; column: string }
  | { op: "renameColumn"; tableId: string; oldName: string; newName: string }
  | { op: "setColumnType"; tableId: string; column: string; dataType: string }
  | { op: "setNotNull"; tableId: string; column: string; value: boolean }
  | { op: "setUnique"; tableId: string; column: string; value: boolean }
  | { op: "setPrimaryKey"; tableId: string; column: string; value: boolean }
  | { op: "setDefault"; tableId: string; column: string; value: string }
  | { op: "setDescription"; tableId: string; description: string; column?: string }
  | { op: "addRef"; fromTable: string; fromCol: string; toTable: string; toCol: string }
  | { op: "removeRef"; fromTable: string; fromCol: string; toTable: string; toCol: string }
  | { op: "addLineage"; targetTable: string; targetColumn: string; from: string; expr?: string }
  | { op: "removeLineage"; targetTable: string; targetColumn: string; from: string }
  | {
      op: "updateLineage";
      targetTable: string;
      targetColumn: string;
      from: string;
      nextFrom?: string;
      expr?: string;
    }
  | { op: "setLayer"; tableId: string; layer: string | null }
  | { op: "addLayerGroup" }
  | { op: "setGroup"; tableId: string; group: string | null }
  | { op: "setColor"; key: string; color: string | null }
  | { op: "setPins"; pins: string[] }
  | { op: "setPositions"; positions: Record<string, { x: number; y: number }> }
  | { op: "setSize"; tableId: string; size: { width?: number; height?: number } }
  | { op: "setCollapsedGroups"; groups: string[] }
  | { op: "setViews"; views: SchemaView[] }
  | { op: "organize" }
  | { op: "setEnum"; tableId: string; column: string; enumName: string; values: string[] }
  | {
      op: "setIndexes";
      tableId: string;
      indexes: Array<{ columns: string[]; name?: string; unique?: boolean }>;
    }
  | { op: "setRecords"; tableId: string; columns: string[]; rows: string[][] }
  | { op: "setRolename"; tableId: string; column: string; rolename: string | null }
  // D5 managed ops
  | { op: "makeManual"; tableId: string }
  | { op: "regenerate"; tableId: string; confirmed: boolean; sql?: string };

export function applyDbtAction(
  files: ProjectFiles,
  project: string,
  action: DbtAction,
): EditResult {
  switch (action.op) {
    case "addTable": {
      const inner = yamlEdit.addTable(files, project, action);
      if ((action.kind ?? "model") === "source") return inner;
      return managedEdit.markModelManaged(files, inner.files, project, action.tableId);
    }
    case "removeTable": {
      const loc = findManagedModel(files, project, action.tableId);
      const inner = yamlEdit.removeTable(files, project, action.tableId);
      if (!loc) return inner;
      return managedEdit.commitFiles(
        files,
        managedEdit.unstampPath(inner.files, loc.sqlPath),
        inner.problems,
      );
    }
    case "renameTable": {
      const oldLoc = findManagedModel(files, project, action.tableId);
      const inner = yamlEdit.renameTable(files, project, action.tableId, action.newId);
      if (!oldLoc) return inner;
      const nextLoc =
        findManagedModel(inner.files, project, action.newId) ??
        findManagedModel(inner.files, project, oldLoc.name);
      if (!nextLoc) return inner;
      return managedEdit.commitFiles(
        files,
        managedEdit.retargetManagedPath(inner.files, oldLoc.sqlPath, nextLoc.sqlPath),
        inner.problems,
      );
    }
    case "addColumn":
      return yamlEdit.addColumn(files, project, action.tableId, action.name, action.dataType);
    case "removeColumn":
      return yamlEdit.removeColumn(files, project, action.tableId, action.column);
    case "renameColumn":
      return yamlEdit.renameColumn(files, project, action.tableId, action.oldName, action.newName);
    case "setColumnType":
      return yamlEdit.setColumnType(files, project, action.tableId, action.column, action.dataType);
    case "setNotNull":
      return yamlEdit.setNotNull(files, project, action.tableId, action.column, action.value);
    case "setUnique":
      return yamlEdit.setUnique(files, project, action.tableId, action.column, action.value);
    case "setPrimaryKey":
      return yamlEdit.setPrimaryKey(files, project, action.tableId, action.column, action.value);
    case "setDefault":
      return yamlEdit.setDefault(files, project, action.tableId, action.column, action.value);
    case "setDescription":
      return yamlEdit.setDescription(
        files,
        project,
        action.tableId,
        action.description,
        action.column,
      );
    case "addRef":
      return yamlEdit.addRef(files, project, action);
    case "removeRef":
      return yamlEdit.removeRef(files, project, action);
    case "addLineage":
      return yamlEdit.addLineage(files, project, action);
    case "removeLineage":
      return yamlEdit.removeLineage(files, project, action);
    case "updateLineage":
      return yamlEdit.updateLineage(files, project, action);
    case "setLayer": {
      const oldLoc = findManagedModel(files, project, action.tableId);
      const inner = yamlEdit.setLayer(files, project, action.tableId, action.layer);
      if (!oldLoc) return inner;
      const nextLoc = findManagedModel(inner.files, project, oldLoc.tableId);
      if (!nextLoc) return inner;
      return managedEdit.commitFiles(
        files,
        managedEdit.retargetManagedPath(inner.files, oldLoc.sqlPath, nextLoc.sqlPath),
      );
    }
    case "addLayerGroup":
    case "organize":
      return { files, changes: {} };
    case "setGroup":
      return yamlEdit.setGroup(files, project, action.tableId, action.group);
    case "setColor":
      return yamlEdit.setColor(files, project, action.key, action.color);
    case "setPins":
      return yamlEdit.setPins(files, project, action.pins);
    case "setPositions":
      return yamlEdit.setPositions(files, project, action.positions);
    case "setSize":
      return yamlEdit.setSize(files, project, action.tableId, action.size);
    case "setCollapsedGroups":
      return yamlEdit.setCollapsedGroups(files, project, action.groups);
    case "setViews":
      return yamlEdit.setViews(files, project, action.views);
    case "setEnum":
      return yamlEdit.setEnum(
        files,
        project,
        action.tableId,
        action.column,
        action.enumName,
        action.values,
      );
    case "setIndexes":
      return yamlEdit.setIndexes(files, project, action.tableId, action.indexes);
    case "setRecords":
      return yamlEdit.setRecords(files, project, action.tableId, action.columns, action.rows);
    case "setRolename":
      return yamlEdit.setRolename(files, project, action.tableId, action.column, action.rolename);
    case "makeManual":
      return managedEdit.makeManual(files, project, action.tableId);
    case "regenerate":
      return managedEdit.regenerate(files, project, action.tableId, {
        confirmed: action.confirmed,
        sql: action.sql,
      });
  }
}
