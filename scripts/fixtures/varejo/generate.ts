import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toDbtProject, type ProjectFiles, type StrataTable } from "../../../src/features/dbt-source/index.ts";
import { asArray, asRecord, dumpYaml, loadYaml } from "../../../src/features/dbt-source/yaml.ts";
import { MANUAL_MODELS, PROJECTS, strataModelFor, type Projeto } from "./spec.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const MANUAL_DIR = path.join(HERE, "manual");

const MACRO_SQL = `{% macro generate_surrogate_key(field_list) -%}
    md5(
        {%- for field in field_list -%}
            coalesce(cast({{ field }} as varchar), '')
            {%- if not loop.last %} || '-' || {% endif -%}
        {%- endfor -%}
    )
{%- endmacro %}
`;

function mergeFiles(parts: ProjectFiles[]): ProjectFiles {
  const files: ProjectFiles = {};
  for (const part of parts) Object.assign(files, part);
  return files;
}

function sortedFiles(files: ProjectFiles): ProjectFiles {
  const out: ProjectFiles = {};
  for (const key of Object.keys(files).sort()) out[key] = files[key];
  return out;
}

function sourceRef(table: StrataTable): { source: [string, string] } | { ref: string } {
  if (table.kind === "source" || table.resourceType === "source") {
    return { source: [table.schema ?? "raw", table.name] };
  }
  return { ref: table.name };
}

function applyManagedAndTransform(files: ProjectFiles): void {
  const modelsById = new Map<string, StrataTable>();
  const modelsByName = new Map<string, StrataTable[]>();
  for (const projeto of PROJECTS) {
    for (const t of strataModelFor(projeto).tables) {
      modelsById.set(t.id, t);
      const list = modelsByName.get(t.name) ?? [];
      list.push(t);
      modelsByName.set(t.name, list);
    }
  }
  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.startsWith("models/") || !filePath.endsWith(".yml") || filePath.includes("_sources.yml")) {
      continue;
    }
    const doc = asRecord(loadYaml(content));
    if (!doc) continue;
    const models = asArray(doc.models);
    const node = asRecord(models[0]);
    if (!node) continue;
    const config = asRecord(node.config) ?? {};
    const meta = asRecord(config.meta) ?? {};
    const strata = asRecord(meta.strata) ?? {};
    const tags = asArray(config.tags).map(String);
    if (!tags.includes("strata:managed")) continue;
    const nodeName = String(node.name ?? "");
    const folder = filePath.split("/")[2] ?? "";
    const table =
      modelsById.get(String(strata.table_id ?? "")) ??
      modelsById.get(`${folder}.${nodeName}`) ??
      (modelsByName.get(nodeName) ?? []).find((t) => t.project === filePath.split("/")[1]);
    const projeto = table?.project as Projeto | undefined;
    const model = projeto ? strataModelFor(projeto) : undefined;
    const ups: string[] = [];
    if (model) {
      for (const l of model.lineageFields) {
        if (l.targetTable === table?.id && !ups.includes(l.sourceTable)) ups.push(l.sourceTable);
      }
    }
    const first = ups[0] ? modelsById.get(ups[0]) : undefined;
    const transform: Record<string, unknown> = {};
    if (first) {
      transform.from = { ...sourceRef(first), alias: "s0" };
      transform.joins = ups.slice(1).flatMap((id, i) => {
        const src = modelsById.get(id);
        if (!src) return [];
        return [{ ...sourceRef(src), alias: `s${i + 1}`, type: "left", on: "true" }];
      });
      transform.where = "";
      transform.group_by = [];
    }
    strata.managed = true;
    if (Object.keys(transform).length) strata.transform = transform;
    meta.strata = strata;
    config.meta = meta;
    node.config = config;
    doc.models = [node];
    files[filePath] = dumpYaml(doc);
  }
}

function overlayManualSql(files: ProjectFiles): void {
  for (const name of MANUAL_MODELS) {
    const sqlPath = path.join(MANUAL_DIR, `${name}.sql`);
    let sql: string;
    try {
      sql = readFileSync(sqlPath, "utf8");
    } catch {
      continue;
    }
    const match = Object.keys(files).find((p) => p.endsWith(`/${name}.sql`));
    if (match) files[match] = sql.endsWith("\n") ? sql : `${sql}\n`;
  }
}

function renameSeed(
  files: ProjectFiles,
  fromBase: string,
  toBase: string,
  projeto: Projeto,
): void {
  const csvFrom = `seeds/${projeto}/${fromBase}.csv`;
  const ymlFrom = `seeds/${projeto}/_${fromBase}.yml`;
  const csvTo = `seeds/${projeto}/${toBase}.csv`;
  const ymlTo = `seeds/${projeto}/_${toBase}.yml`;
  if (!files[csvFrom]) return;
  files[csvTo] = files[csvFrom];
  delete files[csvFrom];
  if (files[ymlFrom]) {
    const doc = asRecord(loadYaml(files[ymlFrom])) ?? {};
    const seeds = asArray(doc.seeds);
    const seed = asRecord(seeds[0]) ?? {};
    seed.name = toBase;
    doc.seeds = [seed];
    files[ymlTo] = dumpYaml(doc);
    delete files[ymlFrom];
  }
}

function patchDbtProject(files: ProjectFiles): void {
  const doc = asRecord(loadYaml(files["dbt_project.yml"] ?? "{}")) ?? {};
  doc.dispatch = [{ macro_namespace: "dbt_utils", search_order: ["strata"] }];
  files["dbt_project.yml"] = dumpYaml(doc);
  files["macros/generate_surrogate_key.sql"] = MACRO_SQL;
}

export function buildVarejoFiles(): ProjectFiles {
  const files = mergeFiles(PROJECTS.map((projeto) => toDbtProject(strataModelFor(projeto), projeto)));
  applyManagedAndTransform(files);
  overlayManualSql(files);
  renameSeed(files, "records_bronze_canais", "canais", "vendas");
  renameSeed(files, "records_bronze_unidades_medida", "unidades_medida", "estoque");
  patchDbtProject(files);
  return sortedFiles(files);
}

export function writeVarejoFiles(root: string, files: ProjectFiles): void {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  for (const rel of Object.keys(files).sort()) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, files[rel], "utf8");
  }
}

const PROJECTS_JSON = `{
  "activeId": "varejo-vendas-0001",
  "projects": [
    {
      "id": "varejo-vendas-0001",
      "name": "vendas",
      "slug": "vendas",
      "createdAt": "2026-09-14T20:00:00.000Z",
      "updatedAt": "2026-09-14T20:00:00.000Z"
    },
    {
      "id": "varejo-estoque-0002",
      "name": "estoque",
      "slug": "estoque",
      "createdAt": "2026-09-14T20:00:00.000Z",
      "updatedAt": "2026-09-14T20:00:00.000Z"
    },
    {
      "id": "varejo-clientes-0003",
      "name": "clientes",
      "slug": "clientes",
      "createdAt": "2026-09-14T20:00:00.000Z",
      "updatedAt": "2026-09-14T20:00:00.000Z"
    }
  ]
}
`;

function upsertVarejoDomain(): void {
  const registryPath = path.join(ROOT, "cypress/fixtures/data/domains.json");
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
    domains: Array<{ id: string; slug: string; name: string; createdAt: string; updatedAt: string }>;
  };
  if (!registry.domains.some((d) => d.slug === "varejo")) {
    registry.domains.push({
      id: "varejo0000000001",
      slug: "varejo",
      name: "varejo",
      createdAt: "2026-09-14T20:00:00.000Z",
      updatedAt: "2026-09-14T20:00:00.000Z",
    });
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  }
}

export function writeVarejoDestinations(files: ProjectFiles = buildVarejoFiles()): void {
  writeVarejoFiles(path.join(ROOT, "fixtures/dbt-source/varejo"), files);
  writeVarejoFiles(path.join(ROOT, "cypress/fixtures/data/varejo"), files);
  const domainDir = path.join(ROOT, "cypress/fixtures/data/domains/varejo");
  writeVarejoFiles(domainDir, files);
  writeFileSync(path.join(domainDir, "projects.json"), PROJECTS_JSON, "utf8");
  upsertVarejoDomain();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const files = buildVarejoFiles();
  writeVarejoDestinations(files);
  console.log(`wrote ${Object.keys(files).length} varejo files`);
}
