// F2 — Export dbt fiel. Valida sources.yml, schema.yml com tests derivados,
// stubs .sql com ref()/source() e o helper columnTests.
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { columnTests, modelToDbtFiles } from '../dbtExport.ts';
import type { Model } from '../model.ts';
import type { YamlColumn, YamlDoc, YamlModel, YamlSourceTable, YamlTestObject } from './yamlDoc.ts';

/** Modelo representativo: 1 source (camada bronze), 2 models (prata, ouro). */
function buildModel(): Model {
  return {
    tables: [
      {
        // Source derivado da camada Bronze (sem resourceType explícito)
        name: 'raw_pedido',
        schema: 'bronze',
        layer: 'Bronze',
        note: 'Pedidos crus do sistema transacional',
        columns: [
          { name: 'id', type: 'bigint', pk: true, nullable: false },
          { name: 'cliente_id', type: 'bigint', nullable: false },
        ],
      },
      {
        // Model com materialization explícita, tags e tests por coluna
        name: 'pedido',
        schema: 'prata',
        layer: 'Prata',
        materialization: 'incremental',
        tags: ['vendas', 'core'],
        note: 'Pedidos limpos',
        columns: [
          { name: 'id', type: 'bigint', pk: true, nullable: false, note: 'chave' },
          { name: 'cliente_id', type: 'bigint', nullable: false },
          { name: 'status', type: 'string', tests: [{ kind: 'accepted_values', values: ['ativo', 'cancelado'] }] },
          { name: 'email', type: 'string', unique: true, nullable: false },
        ],
      },
      {
        // Model sem materialization — deve derivar 'table' da camada Ouro
        name: 'dim_cliente',
        schema: 'ouro',
        layer: 'Ouro',
        columns: [
          { name: 'id', type: 'bigint', pk: true, nullable: false },
          { name: 'nome', type: 'string' },
        ],
      },
    ],
    refs: [
      { from: { table: 'pedido', column: 'cliente_id' }, to: { table: 'dim_cliente', column: 'id' }, kind: '>' },
    ],
    lineageFields: [
      {
        sourceTable: 'bronze.raw_pedido',
        sourceColumn: 'id',
        targetTable: 'prata.pedido',
        targetColumn: 'id',
      },
      {
        sourceTable: 'prata.pedido',
        sourceColumn: 'id',
        targetTable: 'ouro.dim_cliente',
        targetColumn: 'id',
      },
    ],
  };
}

const filesOf = (m: Model) => {
  const files = modelToDbtFiles(m);
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  return { files, get: (p: string) => byPath.get(p), has: (p: string) => byPath.has(p) };
};

describe('dbt_project.yml', () => {
  it('emite projeto dbt válido com profile e config-version', () => {
    const { get } = filesOf(buildModel());
    const doc = yaml.load(get('dbt_project.yml')!) as Record<string, unknown>;
    expect(doc['config-version']).toBe(2);
    expect(doc.profile).toBeTruthy();
    expect(doc['model-paths']).toContain('models');
  });
});

describe('sources vs models', () => {
  it('tabela source (camada bronze) vai para sources.yml, não vira model', () => {
    const { get, has } = filesOf(buildModel());
    // Não há stub .sql nem entrada de model para a source
    expect(has('models/bronze/raw_pedido.sql')).toBe(false);
    const sources = yaml.load(get('models/bronze/sources.yml')!) as YamlDoc;
    expect(sources.version).toBe(2);
    const src = sources.sources![0];
    expect(src.schema).toBe('bronze');
    const tbl = src.tables!.find((t: YamlSourceTable) => t.name === 'raw_pedido');
    expect(tbl).toBeDefined();
    expect(tbl!.description).toBe('Pedidos crus do sistema transacional');
    expect(tbl!.columns!.map((c: YamlColumn) => c.name)).toEqual(['id', 'cliente_id']);
  });

  it('source não aparece como model em nenhum schema.yml', () => {
    const { files } = filesOf(buildModel());
    for (const f of files.filter((x) => x.path.endsWith('schema.yml'))) {
      const doc = yaml.load(f.content) as YamlDoc;
      const names = (doc.models ?? []).map((m: YamlModel) => m.name);
      expect(names).not.toContain('raw_pedido');
    }
  });
});

describe('schema.yml — models, descrições e tests por coluna', () => {
  it('model carrega descrição, materialization e tags em config', () => {
    const { get } = filesOf(buildModel());
    const doc = yaml.load(get('models/prata/schema.yml')!) as YamlDoc;
    const pedido = doc.models!.find((m: YamlModel) => m.name === 'pedido')!;
    expect(pedido.description).toBe('Pedidos limpos');
    expect(pedido.config!.materialized).toBe('incremental');
    expect(pedido.config!.tags).toEqual(['vendas', 'core']);
  });

  it('materialization ausente é derivada da camada (Ouro → table)', () => {
    const { get } = filesOf(buildModel());
    const doc = yaml.load(get('models/ouro/schema.yml')!) as YamlDoc;
    const dim = doc.models!.find((m: YamlModel) => m.name === 'dim_cliente')!;
    expect(dim.config!.materialized).toBe('table');
  });

  it('PK gera unique + not_null; coluna [unique] gera unique', () => {
    const { get } = filesOf(buildModel());
    const doc = yaml.load(get('models/prata/schema.yml')!) as YamlDoc;
    const pedido = doc.models!.find((m: YamlModel) => m.name === 'pedido')!;
    const id = pedido.columns!.find((c: YamlColumn) => c.name === 'id')!;
    expect(id.data_tests).toEqual(expect.arrayContaining(['unique', 'not_null']));
    const email = pedido.columns!.find((c: YamlColumn) => c.name === 'email')!;
    expect(email.data_tests).toContain('unique');
  });

  it('accepted_values vira teste estruturado', () => {
    const { get } = filesOf(buildModel());
    const doc = yaml.load(get('models/prata/schema.yml')!) as YamlDoc;
    const pedido = doc.models!.find((m: YamlModel) => m.name === 'pedido')!;
    const status = pedido.columns!.find((c: YamlColumn) => c.name === 'status')!;
    const av = status.data_tests!.find(
      (t): t is YamlTestObject => typeof t === 'object' && t !== null && 'accepted_values' in t,
    )!;
    expect(av.accepted_values!.values).toEqual(['ativo', 'cancelado']);
  });

  it('FK vira relationships test apontando para ref() do destino', () => {
    const { get } = filesOf(buildModel());
    const doc = yaml.load(get('models/prata/schema.yml')!) as YamlDoc;
    const pedido = doc.models!.find((m: YamlModel) => m.name === 'pedido')!;
    const fk = pedido.columns!.find((c: YamlColumn) => c.name === 'cliente_id')!;
    const rel = fk.data_tests!.find(
      (t): t is YamlTestObject => typeof t === 'object' && t !== null && 'relationships' in t,
    )!;
    expect(rel.relationships!.to).toBe("ref('dim_cliente')");
    expect(rel.relationships!.field).toBe('id');
  });
});

describe('.sql stubs com ref()/source()', () => {
  it('model referencia source upstream via source() e tem config', () => {
    const { get } = filesOf(buildModel());
    const sql = get('models/prata/pedido.sql')!;
    expect(sql).toContain("materialized='incremental'");
    expect(sql).toContain("source('bronze', 'raw_pedido')");
  });

  it('model referencia model upstream via ref()', () => {
    const { get } = filesOf(buildModel());
    const sql = get('models/ouro/dim_cliente.sql')!;
    expect(sql).toContain("ref('pedido')");
  });
});

describe('columnTests helper', () => {
  const model = buildModel();
  const pedido = model.tables.find((t) => t.name === 'pedido')!;

  it('PK → unique + not_null', () => {
    const id = pedido.columns.find((c) => c.name === 'id')!;
    const kinds = columnTests(pedido, id, model.refs).map((t) => t.kind);
    expect(kinds).toContain('unique');
    expect(kinds).toContain('not_null');
  });

  it('FK gera relationships com to/field do destino', () => {
    const fk = pedido.columns.find((c) => c.name === 'cliente_id')!;
    const rel = columnTests(pedido, fk, model.refs).find((t) => t.kind === 'relationships');
    expect(rel).toEqual({ kind: 'relationships', to: 'dim_cliente', field: 'id' });
  });

  it('coluna comum sem constraint não gera testes', () => {
    const nome = model.tables.find((t) => t.name === 'dim_cliente')!.columns.find((c) => c.name === 'nome')!;
    expect(columnTests(model.tables[2], nome, model.refs)).toEqual([]);
  });
});
