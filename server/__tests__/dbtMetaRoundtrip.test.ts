import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { dbmlToModel, modelToDbml } from '../dbmlIo.ts';
import { modelToDbtFiles } from '../dbtExport.ts';
import { dbtFilesToModel, schemaYmlToModel } from '../dbtImport.ts';
import type { YamlColumn, YamlDoc, YamlModel } from './yamlDoc.ts';

const DBML = `Table silver.dim_cliente {
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

TableGroup dimensoes {
  silver.dim_cliente
}

LayerGroup prata [color: #c0c0c0] {
  silver.dim_cliente
  silver.fato_venda
}

Lineage {
  silver.fato_venda < silver.dim_cliente
}

LineageFields {
  silver.fato_venda.cliente_key < silver.dim_cliente.cliente_key [note: 'lookup']
}

Records silver.dim_cliente(cliente_key, nome) {
  1, Ana
}

Colors {
  silver.dim_cliente: #b08d57
  @dimensoes: #112233
  silver.fato_venda.venda_key: #ff0000
}
`;

function findSchemaYml(files: { path: string; content: string }[]): YamlDoc {
  const f = files.find((x) => x.path.endsWith('schema.yml'));
  expect(f, 'schema.yml presente no export').toBeTruthy();
  return yaml.load(f!.content) as YamlDoc;
}

describe('export dbt — data_type e meta.localdrawdb', () => {
  const files = modelToDbtFiles(dbmlToModel(DBML));
  const doc = findSchemaYml(files);
  const dim = doc.models!.find((m: YamlModel) => m.name === 'dim_cliente')!;
  const fato = doc.models!.find((m: YamlModel) => m.name === 'fato_venda')!;

  it('emite data_type em toda coluna (com args quando houver)', () => {
    const nome = dim.columns!.find((c: YamlColumn) => c.name === 'nome')!;
    expect(nome.data_type).toBe('string');
    const valor = fato.columns!.find((c: YamlColumn) => c.name === 'valor')!;
    expect(valor.data_type).toBe('decimal(18,2)');
  });

  it('emite meta.localdrawdb da tabela (schema, layer+cor, group+cor, color, pk, records)', () => {
    const meta = dim.meta?.localdrawdb;
    expect(meta).toMatchObject({
      schema: 'silver',
      layer: 'prata',
      layerColor: '#c0c0c0',
      group: 'dimensoes',
      groupColor: '#112233',
      color: '#b08d57',
      pk: ['cliente_key'],
    });
    expect(meta!.records).toEqual({ columns: ['cliente_key', 'nome'], rows: [['1', 'Ana']] });
  });

  it('emite PK composta e meta de coluna (color e map)', () => {
    expect(fato.meta?.localdrawdb?.pk).toEqual(['venda_key', 'cliente_key']);
    const vk = fato.columns!.find((c: YamlColumn) => c.name === 'venda_key')!;
    expect(vk.meta?.localdrawdb?.color).toBe('#ff0000');
    const ck = fato.columns!.find((c: YamlColumn) => c.name === 'cliente_key')!;
    expect(ck.meta?.localdrawdb?.map).toEqual({
      table: 'silver.dim_cliente',
      column: 'cliente_key',
      note: 'lookup',
    });
  });

  it('omite meta.localdrawdb e strata.pinned quando o modelo não tem nenhum', () => {
    const doc2 = findSchemaYml(modelToDbtFiles(dbmlToModel('Table t {\n  id int\n}\n')));
    expect(doc2.models![0].meta?.localdrawdb).toBeUndefined();
    expect(doc2.models![0].meta?.strata).toBeUndefined();
    expect(doc2.models![0].columns![0].meta).toBeUndefined();
  });

  it('preserva meta.localdrawdb sem emitir strata.pinned vazio', () => {
    const dim = findSchemaYml(files).models!.find((m: YamlModel) => m.name === 'dim_cliente')!;
    expect(dim.meta!.localdrawdb).toMatchObject({ schema: 'silver', pk: ['cliente_key'] });
    expect(dim.meta!.strata).toBeUndefined();
  });

  it('emite as colunas pinadas do modelo parseado em meta.strata.pinned', () => {
    const model = dbmlToModel(`${DBML}
Pins {
  silver.dim_cliente.nome
}
`);
    const dim = findSchemaYml(modelToDbtFiles(model)).models!.find((m: YamlModel) => m.name === 'dim_cliente')!;
    expect(dim.meta!.strata!.pinned).toEqual(['nome']);
    expect(dim.meta!.localdrawdb!.schema).toBe('silver');
  });
});

describe('import dbt — meta.localdrawdb aplicada', () => {
  const YML = `version: 2
models:
  - name: dim_cliente
    meta:
      localdrawdb:
        schema: silver
        layer: prata
        layerColor: "#c0c0c0"
        group: dimensoes
        groupColor: "#112233"
        color: "#b08d57"
        pk: [cliente_key]
        records:
          columns: [cliente_key, nome]
          rows: [["1", "Ana"]]
    columns:
      - name: cliente_key
        data_type: bigint
      - name: nome
        data_type: string
        meta:
          localdrawdb:
            color: "#00ff00"
            map: { table: raw.clientes, column: nm, note: trim }
`;

  it('aplica schema/layer/group/pk/records e agrega cores e L2', () => {
    const m = schemaYmlToModel(YML);
    const t = m.tables[0];
    expect(t.schema).toBe('silver');
    expect(t.layer).toBe('prata');
    expect(t.group).toBe('dimensoes');
    expect(t.columns.find((c) => c.name === 'cliente_key')?.pk).toBe(true);
    expect(t.records).toEqual({ columns: ['cliente_key', 'nome'], rows: [['1', 'Ana']] });
    expect(m.colors).toMatchObject({
      'silver.dim_cliente': '#b08d57',
      '@dimensoes': '#112233',
      'silver.dim_cliente.nome': '#00ff00',
    });
    expect(m.layerColors).toEqual({ prata: '#c0c0c0' });
    expect(m.lineageFields).toEqual([
      {
        targetTable: 'silver.dim_cliente',
        targetColumn: 'nome',
        sourceTable: 'raw.clientes',
        sourceColumn: 'nm',
        note: 'trim',
      },
    ]);
  });

  it('schema.yml sem meta.localdrawdb importa como antes (regressão)', () => {
    const m = schemaYmlToModel('version: 2\nmodels:\n  - name: t\n    columns:\n      - name: id\n        data_type: int\n');
    expect(m.tables[0].name).toBe('t');
    expect(m.colors).toBeUndefined();
    expect(m.layerColors).toBeUndefined();
  });

  it('lê meta.strata.pinned para Model.pins', () => {
    const YML = `version: 2
models:
  - name: dim_cliente
    meta:
      strata:
        pinned: [nome]
    columns:
      - name: cliente_key
        data_type: bigint
      - name: nome
        data_type: string
`;
    const m = schemaYmlToModel(YML);
    expect(m.pins).toEqual(['dim_cliente.nome']);
    expect(m.tables[0].dbtMeta?.strata).toBeUndefined();
  });
});

describe('round-trip completo DBML → dbt → Model → DBML', () => {
  it('preserva tipos, cores, camadas com cor, grupos, PK composta, records e L2', () => {
    const files = modelToDbtFiles(dbmlToModel(DBML));
    const back = dbtFilesToModel(files.map((f) => ({ file: f.path, content: f.content })));
    expect(back).toBeTruthy();
    const dbml = modelToDbml(back!);
    expect(dbml).toContain('silver.dim_cliente: #b08d57');
    expect(dbml).toContain('@dimensoes: #112233');
    expect(dbml).toContain('silver.fato_venda.venda_key: #ff0000');
    expect(dbml).toContain('LayerGroup prata [color: #c0c0c0] {');
    expect(dbml).toMatch(/TableGroup dimensoes \{/);
    expect(dbml).toContain('valor decimal(18,2)');
    expect(dbml).toMatch(/\(venda_key, cliente_key\) \[pk\]/);
    expect(dbml).toMatch(/Records silver\.dim_cliente/);
    expect(dbml).toMatch(/LineageFields\s*\{[^}]*silver\.fato_venda\.cliente_key < silver\.dim_cliente\.cliente_key/);
    // L1 via ref()/source() dos models .sql, com nomes qualificados pelo schema
    expect(dbml).toMatch(/Lineage\s*\{[^}]*silver\.fato_venda < silver\.dim_cliente/);
  });

  it('preserva Pins no round-trip model → dbt → model', () => {
    const model = dbmlToModel(`${DBML}
Pins {
  silver.dim_cliente.nome
}
`);
    const files = modelToDbtFiles(model);
    const back = dbtFilesToModel(files.map((f) => ({ file: f.path, content: f.content })));
    expect(back?.pins).toEqual(['silver.dim_cliente.nome']);
    expect(back!.tables.find((t) => t.name === 'dim_cliente')?.dbtMeta?.strata).toBeUndefined();
  });
});
