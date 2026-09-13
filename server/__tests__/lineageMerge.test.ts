import { describe, expect, it } from 'vitest';
import { dbmlToModel, modelToDbml } from '../dbmlIo.ts';
import { mergeModel, sqlToModel } from '../sqlImport.ts';

describe('mergeModel linhagem de campo', () => {
  it('une LineageFields do editor com input sem perder entradas', () => {
    const editorDbml = `Table raw.a {
  id bigint [pk]
}
Table raw.b {
  id bigint [pk]
}
Table silver.x {
  id bigint [pk]
  val string
}
Table silver.y {
  id bigint [pk]
}

Lineage {
  silver.x < raw.a
}

LineageFields {
  silver.x.val < raw.a.id
}
`;
    const inputSql = `
CREATE TABLE silver.y (
  id BIGINT,
  val STRING, -- @mapeamento <- raw.b.id
  PRIMARY KEY (id)
) USING DELTA;
CREATE TABLE raw.b (
  id BIGINT,
  PRIMARY KEY (id)
) USING DELTA;
`;

    const base = dbmlToModel(editorDbml);
    const incoming = sqlToModel(inputSql);
    const merged = mergeModel(base, incoming);
    const dbml = modelToDbml(merged);

    expect(dbml).not.toContain('Lineage {');
    expect(dbml).toContain('silver.x.val < raw.a.id');
    expect(dbml).toContain('silver.y.val < raw.b.id');

    const round = dbmlToModel(dbml);
    expect(round.lineageFields).toHaveLength(2);
  });

  it('dedupe L2 por par completo', () => {
    const base = {
      tables: [],
      refs: [],
      lineageFields: [
        {
          targetTable: 'silver.t',
          targetColumn: 'c1',
          sourceTable: 'raw.a',
          sourceColumn: 'id',
          note: 'editor',
        },
      ],
    };
    const incoming = {
      tables: [],
      refs: [],
      lineageFields: [
        {
          targetTable: 'silver.t',
          targetColumn: 'c1',
          sourceTable: 'raw.a',
          sourceColumn: 'id',
          note: 'input',
        },
      ],
    };
    const merged = mergeModel(base, incoming);
    expect(merged.lineageFields?.[0].note).toBe('input');
  });
});
