import { fromDbtProject } from "@/features/dbt-source/fromDbtProject";
import { toDisplayDbml } from "@/features/dbt-source/toDisplayDbml";
import { toParseResult } from "@/features/dbt-source/toParseResult";
import { diffFiles } from "@/features/dbt-source/dbtDiff";
import { pinnedByTableFromList } from "@/features/schema/model/dbmlClean";
import { useSchemaStore } from "@/features/schema/store";

export function applyDbtFileChanges(changes: Record<string, string | null>, op = "editYaml"): void {
  const paths = Object.keys(changes);
  if (!paths.length) return;
  useSchemaStore.setState((state) => {
    if (state.documentFormat !== "dbt" || !state.dbtProject) return;
    const before: Record<string, string | null> = {};
    const nextFiles = { ...state.files };
    for (const p of paths) {
      before[p] = state.files[p] ?? null;
      const content = changes[p];
      if (content === null) delete nextFiles[p];
      else nextFiles[p] = content;
    }
    state.dbtPast.push({ before, after: changes });
    if (state.dbtPast.length > 100) state.dbtPast.shift();
    state.dbtFuture = [];
    state.changeLog = [
      { id: state.dbtPersistGen + 1, op, hunks: diffFiles(before, changes) },
      ...state.changeLog,
    ].slice(0, 8);
    state.files = nextFiles;
    state.lastDbtChanges = { ...state.lastDbtChanges, ...changes };
    state.dbtPersistGen += 1;
    state.dbtProblems = [];
    const model = fromDbtProject(state.files, state.dbtProject);
    state.dbml = toDisplayDbml(model);
    state.positions = { ...(model.canvas?.positions ?? {}) };
    state.sizes = { ...(model.canvas?.sizes ?? {}) };
    state.colors = { ...model.colors };
    state.collapsedGroups = [...(model.canvas?.collapsedGroups ?? [])];
    state.dbtParsed = toParseResult(model);
    state.pinnedByTable = pinnedByTableFromList(model.pins);
  });
}
