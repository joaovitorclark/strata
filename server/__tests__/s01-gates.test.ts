import { describe, expect, it } from "vitest";
import { modelToDbtFiles } from "../dbtExport.ts";
import { dbtFilesToModel } from "../dbtImport.ts";
import { dbmlToModel, modelToDbml } from "../dbmlIo.ts";
import type { Model } from "../model.ts";

describe("S01 dbt import/export", () => {
  it("G10: dbtExport mappings from two upstream tables emit two ref() CTEs", () => {
    const model: Model = {
      tables: [
        {
          name: "stg_a",
          schema: "bronze",
          columns: [{ name: "id", type: "bigint", pk: true, nullable: false }],
        },
        {
          name: "stg_b",
          schema: "bronze",
          columns: [{ name: "id", type: "bigint", pk: true, nullable: false }],
        },
        {
          name: "fact",
          schema: "silver",
          columns: [
            { name: "a_id", type: "bigint" },
            { name: "b_id", type: "bigint" },
          ],
        },
      ],
      refs: [],
      lineageFields: [
        {
          sourceTable: "bronze.stg_a",
          sourceColumn: "id",
          targetTable: "silver.fact",
          targetColumn: "a_id",
        },
        {
          sourceTable: "bronze.stg_b",
          sourceColumn: "id",
          targetTable: "silver.fact",
          targetColumn: "b_id",
        },
      ],
    };
    const sql = modelToDbtFiles(model).find((f) => f.path.endsWith("fact.sql"))?.content ?? "";
    expect(sql).toMatch(/\{\{\s*ref\('stg_a'\)\s*\}\}/);
    expect(sql).toMatch(/\{\{\s*ref\('stg_b'\)\s*\}\}/);
  });

  it("G11: dbtImport ref() and no field meta yields zero lineage", () => {
    const model = dbtFilesToModel([
      { file: "dbt_project.yml", content: "name: shop\nprofile: shop\n" },
      {
        file: "models/schema.yml",
        content: "version: 2\nmodels:\n  - name: fact\n    columns:\n      - name: id\n",
      },
      {
        file: "models/fact.sql",
        content: "select * from {{ ref('stg_a') }}\n",
      },
    ]);
    expect(model).not.toBeNull();
    expect(model!.lineageFields ?? []).toEqual([]);
  });

  it("G12: dbtImport field meta yields exactly those mappings", () => {
    const yml = `version: 2
models:
  - name: fact
    meta:
      localdrawdb:
        schema: silver
    columns:
      - name: a_id
        meta:
          localdrawdb:
            map: { table: bronze.stg_a, column: id }
`;
    const model = dbtFilesToModel([
      { file: "dbt_project.yml", content: "name: shop\nprofile: shop\n" },
      { file: "models/schema.yml", content: yml },
    ]);
    expect(model?.lineageFields).toEqual([
      {
        targetTable: "silver.fact",
        targetColumn: "a_id",
        sourceTable: "bronze.stg_a",
        sourceColumn: "id",
      },
    ]);
  });

  it("G13: dbtRoundtrip golden has no table lineage", () => {
    const model: Model = {
      tables: [
        {
          name: "pedido",
          schema: "silver",
          columns: [{ name: "id", type: "bigint", pk: true, nullable: false }],
        },
      ],
      refs: [],
      lineageFields: [
        {
          sourceTable: "bronze.raw",
          sourceColumn: "id",
          targetTable: "silver.pedido",
          targetColumn: "id",
        },
      ],
    };
    const dbml = modelToDbml(model);
    expect(dbml).not.toContain("Lineage {");
    expect(dbml).toContain("LineageFields {");
    const back = dbmlToModel(dbml);
    expect(back.lineageFields).toHaveLength(1);
  });

  it("G14: dbtMetaRoundtrip golden has no table lineage", () => {
    const dbml = `Table silver.dim_cliente {
  cliente_key bigint [pk]
  nome string [note: 'nome completo']
}

Table silver.fato_venda {
  venda_key bigint
  cliente_key bigint
  valor decimal(18,2)

  indexes {
    (venda_key, cliente_key) [pk]
  }
}

Ref: silver.fato_venda.cliente_key > silver.dim_cliente.cliente_key

Lineage {
  silver.fato_venda < silver.dim_cliente
}

LineageFields {
  silver.fato_venda.cliente_key < silver.dim_cliente.cliente_key [note: 'lookup']
}
`;
    const files = modelToDbtFiles(dbmlToModel(dbml)).map((f) => ({
      file: f.path,
      content: f.content,
    }));
    const back = dbtFilesToModel(files);
    expect(back).toBeTruthy();
    const out = modelToDbml(back!);
    expect(out).not.toContain("Lineage {");
    expect(out).toMatch(
      /LineageFields\s*\{[^}]*silver\.fato_venda\.cliente_key < silver\.dim_cliente\.cliente_key/,
    );
  });

  it("G15: lineageRoundtrip golden has no table lineage", () => {
    const dbml = `Table raw.orders {
  id bigint [pk]
}
Table silver.fact_orders {
  order_id bigint [pk]
}

Ref: silver.fact_orders.order_id > raw.orders.id

Lineage {
  silver.fact_orders < raw.orders
}

LineageFields {
  silver.fact_orders.order_id < raw.orders.id [note: 'copia direta']
}
`;
    const model = dbmlToModel(dbml);
    const back = modelToDbml(model);
    expect(back).not.toContain("Lineage {");
    expect(back).toContain("LineageFields {");
    expect(back).toContain("silver.fact_orders.order_id < raw.orders.id");
    expect(dbmlToModel(back).lineageFields).toEqual(model.lineageFields);
  });
});
