import { fromDbtProject, type ProjectFiles } from "@/features/dbt-source";

export type TableSourceFiles = {
  ymlPath: string;
  sqlPath?: string;
  tableId: string;
};

export function filesForTable(
  files: ProjectFiles,
  project: string,
  tableId: string,
): TableSourceFiles | undefined {
  const model = fromDbtProject(files, project);
  const table = model.tables.find((t) => t.id === tableId || t.name === tableId);
  if (!table || table.external) return undefined;
  const layer = table.layer ?? "main";
  if (table.kind === "source") {
    const ymlPath = `models/${project}/${layer}/_sources.yml`;
    if (files[ymlPath] == null) return undefined;
    return { ymlPath, tableId: table.id };
  }
  const ymlPath = `models/${project}/${layer}/_${table.name}.yml`;
  const sqlPath = `models/${project}/${layer}/${table.name}.sql`;
  if (files[ymlPath] == null) return undefined;
  return { ymlPath, sqlPath: files[sqlPath] != null ? sqlPath : undefined, tableId: table.id };
}

export function listDbtFiles(files: ProjectFiles): string[] {
  return Object.keys(files)
    .filter((p) => /\.(ya?ml|sql)$/.test(p) && (p.startsWith("models/") || p.startsWith("seeds/")))
    .sort();
}

export function modelNameFromPath(filePath: string): string | undefined {
  if (filePath.endsWith("_sources.yml") || filePath.endsWith("_sources.yaml")) return "sources";
  const yml = /\/_([^/]+)\.ya?ml$/.exec(filePath);
  if (yml) return yml[1];
  const sql = /\/([^/]+)\.sql$/.exec(filePath);
  return sql?.[1];
}
