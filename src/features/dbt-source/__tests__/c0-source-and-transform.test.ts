import { describe, expect, it } from "vitest";
import {
  fromDbtProject,
  toDbtProject,
  type ProjectFiles,
  type StrataModel,
  type StrataTable,
} from "@/features/dbt-source";
import { asArray, asRecord, loadYaml } from "@/features/dbt-source/yaml";

function sourceYml(files: ProjectFiles): string {
  const path = Object.keys(files).find((p) => p.endsWith("_sources.yml"));
  if (!path) throw new Error("no _sources.yml");
  return files[path];
}

function modelYml(files: ProjectFiles, name: string): string {
  const path = Object.keys(files).find((p) => p.endsWith(`/_${name}.yml`));
  if (!path) throw new Error(`no _${name}.yml`);
  return files[path];
}

function baseModel(tables: StrataTable[]): StrataModel {
  return {
    project: "vendas",
    tables,
    refs: [],
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

describe("C0 source name vs identity schema + managed transform", () => {
  it("fromDbtProject: source name stays bronze_<projeto>; id is schema.name", () => {
    const files: ProjectFiles = {
      "dbt_project.yml": "name: strata\n",
      "models/vendas/bronze/_sources.yml": `version: 2
sources:
  - name: bronze_vendas
    schema: bronze
    tables:
      - name: pedidos
        columns:
          - name: pedido_id
            data_type: bigint
`,
      ".strata/vendas/project.yml": "format_version: 1\nname: vendas\n",
    };
    const table = fromDbtProject(files, "vendas").tables.find((t) => t.name === "pedidos");
    expect(table?.id).toBe("bronze.pedidos");
    expect(table?.schema).toBe("bronze_vendas");
    expect(table?.layer).toBe("bronze");
  });

  it("toDbtProject writes source name from table.schema and YAML schema from the id prefix", () => {
    const files = toDbtProject(
      baseModel([
        {
          id: "bronze.pedidos",
          name: "pedidos",
          schema: "bronze_vendas",
          project: "vendas",
          kind: "source",
          layer: "bronze",
          columns: [{ name: "pedido_id", type: "bigint", pk: true, notNull: true }],
          tags: ["strata:vendas"],
          resourceType: "source",
        },
      ]),
      "vendas",
    );
    const doc = asRecord(loadYaml(sourceYml(files)));
    const source = asRecord(asArray(doc?.sources)[0]);
    expect(source?.name).toBe("bronze_vendas");
    expect(source?.schema).toBe("bronze");
  });

  it("toDbtProject writes config.meta.strata.transform for managed models", () => {
    const bronze: StrataTable = {
      id: "bronze.canais",
      name: "canais",
      schema: "bronze_vendas",
      project: "vendas",
      kind: "source",
      layer: "bronze",
      columns: [{ name: "canal_id", type: "bigint", pk: true, notNull: true }],
      tags: ["strata:vendas"],
      resourceType: "source",
    };
    const canal: StrataTable = {
      id: "silver.canal",
      name: "canal",
      schema: "silver",
      project: "vendas",
      kind: "model",
      layer: "silver",
      columns: [{ name: "canal_id", type: "bigint", pk: true, notNull: true }],
      tags: ["strata:managed", "strata:vendas"],
      resourceType: "model",
    };
    const files = toDbtProject(
      {
        ...baseModel([bronze, canal]),
        lineageFields: [
          {
            targetTable: "silver.canal",
            targetColumn: "canal_id",
            sourceTable: "bronze.canais",
            sourceColumn: "canal_id",
          },
        ],
      },
      "vendas",
    );
    const doc = asRecord(loadYaml(modelYml(files, "canal")));
    const node = asRecord(asArray(doc?.models)[0]);
    const strata = asRecord(asRecord(asRecord(node?.config)?.meta)?.strata);
    expect(strata?.managed).toBe(true);
    expect(strata?.transform).toEqual({
      from: { source: ["bronze_vendas", "canais"], alias: "s0" },
      joins: [],
      where: "",
      group_by: [],
    });
    expect(strata).not.toHaveProperty("table_id");
    expect(strata).not.toHaveProperty("layer");
    expect(strata).not.toHaveProperty("schema");
    expect(strata).not.toHaveProperty("pk");
  });

  it("round-trip keeps source name and identity schema", () => {
    const original = baseModel([
      {
        id: "bronze.pedidos",
        name: "pedidos",
        schema: "bronze_vendas",
        project: "vendas",
        kind: "source",
        layer: "bronze",
        columns: [{ name: "pedido_id", type: "bigint", pk: false, notNull: false }],
        tags: ["strata:vendas"],
        resourceType: "source",
      },
    ]);
    const back = fromDbtProject(toDbtProject(original, "vendas"), "vendas");
    const table = back.tables.find((t) => t.name === "pedidos");
    expect(table?.id).toBe("bronze.pedidos");
    expect(table?.schema).toBe("bronze_vendas");
  });
});
