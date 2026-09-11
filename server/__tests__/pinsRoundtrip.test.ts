import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { dbmlToModel, modelToDbml } from '../dbmlIo.ts';
import { modelToDbtFiles } from '../dbtExport.ts';
import { dbtFilesToModel, schemaYmlToModel } from '../dbtImport.ts';

const DBML = `Table silver.dim_cliente {
  cliente_key bigint [pk]
  nome string
}

Table silver.fato_venda {
  venda_key bigint [pk]
  cliente_key bigint
}

Pins {
  silver.dim_cliente.nome
  silver.fato_venda.venda_key
}
`;

function findYml(
  files: { path: string; content: string }[],
  suffix: string,
): Record<string, unknown> {
  const f = files.find((x) => x.path.endsWith(suffix));
  expect(f, `${suffix} presente no export`).toBeTruthy();
  return yaml.load(f!.content) as Record<string, unknown>;
}

describe('dbmlToModel — pins', () => {
  it('expõe o bloco Pins como lista de tabela.coluna', () => {
    expect(dbmlToModel(DBML).pins).toEqual([
      'silver.dim_cliente.nome',
      'silver.fato_venda.venda_key',
    ]);
  });
  it('omite pins quando ausentes', () => {
    expect(dbmlToModel('Table t {\n  id int\n}\n').pins).toBeUndefined();
  });
});

describe('modelToDbml — pins', () => {
  it('emite bloco Pins {}', () => {
    const dbml = modelToDbml(dbmlToModel(DBML));
    expect(dbml).toMatch(/Pins\s*\{/);
    expect(dbml).toContain('silver.dim_cliente.nome');
    expect(dbml).toContain('silver.fato_venda.venda_key');
  });
  it('não emite Pins quando o modelo não tem pins', () => {
    expect(modelToDbml(dbmlToModel('Table t {\n  id int\n}\n'))).not.toMatch(/Pins\s*\{/);
  });
  it('round-trip DBML → model → DBML preserva os pins', () => {
    const twice = modelToDbml(dbmlToModel(modelToDbml(dbmlToModel(DBML))));
    expect(twice).toContain('silver.dim_cliente.nome');
    expect(twice).toContain('silver.fato_venda.venda_key');
  });
});

describe('dbtExport — pins do modelo parseado', () => {
  it('emite meta.strata.pinned a partir do bloco Pins, não de dbtMeta', () => {
    const files = modelToDbtFiles(dbmlToModel(DBML));
    const schema = findYml(files, 'schema.yml');
    const models = schema.models as Array<{ name: string; meta?: { strata?: { pinned?: string[] } } }>;
    const dim = models.find((m) => m.name === 'dim_cliente');
    const fato = models.find((m) => m.name === 'fato_venda');
    expect(dim?.meta?.strata?.pinned).toEqual(['nome']);
    expect(fato?.meta?.strata?.pinned).toEqual(['venda_key']);
  });
  it('não emite strata.pinned vazio', () => {
    const schema = findYml(modelToDbtFiles(dbmlToModel('Table t {\n  id int\n}\n')), 'schema.yml');
    const models = schema.models as Array<{ meta?: { strata?: unknown } }>;
    expect(models[0].meta?.strata).toBeUndefined();
  });
  it('ignora Table.dbtMeta.strata.pinned', () => {
    const model = dbmlToModel('Table t {\n  id int\n}\n');
    model.tables[0].dbtMeta = { strata: { pinned: ['id'] } };
    const schema = findYml(modelToDbtFiles(model), 'schema.yml');
    const models = schema.models as Array<{ meta?: { strata?: unknown } }>;
    expect(models[0].meta?.strata).toBeUndefined();
  });
});

describe('dbtImport — pins voltam ao modelo', () => {
  it('lê meta.strata.pinned para Model.pins, não para Table.dbtMeta', () => {
    const yml = `version: 2
models:
  - name: dim_cliente
    meta:
      localdrawdb:
        schema: silver
      strata:
        pinned: [nome]
    columns:
      - name: cliente_key
        data_type: bigint
      - name: nome
        data_type: string
`;
    const m = schemaYmlToModel(yml);
    expect(m.pins).toEqual(['silver.dim_cliente.nome']);
    expect(m.tables[0].dbtMeta?.strata).toBeUndefined();
  });
});

describe('round-trip DBML → dbt → model → DBML', () => {
  it('preserva Pins {}', () => {
    const files = modelToDbtFiles(dbmlToModel(DBML));
    const back = dbtFilesToModel(files.map((f) => ({ file: f.path, content: f.content })));
    expect(back?.pins).toEqual([
      'silver.dim_cliente.nome',
      'silver.fato_venda.venda_key',
    ]);
    const dbml = modelToDbml(back!);
    expect(dbml).toContain('silver.dim_cliente.nome');
    expect(dbml).toContain('silver.fato_venda.venda_key');
  });
});
