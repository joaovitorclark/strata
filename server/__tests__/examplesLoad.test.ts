import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dbmlToModel } from '../dbmlIo.ts';
import { sqlToModel } from '../sqlImport.ts';
import { parseDbml } from '../../src/features/schema/model/parse.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readUtf8(rel: string): string {
  const text = readFileSync(path.join(ROOT, rel), 'utf8');
  expect(text.length, `${rel} vazio`).toBeGreaterThan(0);
  expect(text, `${rel} não é UTF-8`).not.toContain('\uFFFD');
  return text;
}

describe('examples/ loadable files', () => {
  it('examples/demo_lakehouse_oracle/project.dbml parseia sem erro', () => {
    const dbml = readUtf8('examples/demo_lakehouse_oracle/project.dbml');
    const parsed = parseDbml(dbml);
    expect(parsed.error).toBeUndefined();
    expect(parsed.tables.length).toBeGreaterThan(0);
    const model = dbmlToModel(dbml);
    expect(model.tables.length).toBeGreaterThan(0);
  });

  it('examples/demo_lakehouse_oracle/canvas.json é JSON válido', () => {
    const raw = readUtf8('examples/demo_lakehouse_oracle/canvas.json');
    const canvas = JSON.parse(raw) as { positions?: Record<string, unknown> };
    expect(canvas.positions).toBeTypeOf('object');
  });

  it('examples/input/demo_lakehouse_oracle.sql importa via sqlToModel', () => {
    const sql = readUtf8('examples/input/demo_lakehouse_oracle.sql');
    const model = sqlToModel(sql);
    expect(model.tables.length).toBeGreaterThan(0);
  });

  it('examples/dbt/ tem dbt_project.yml, models e schema.yml', () => {
    const dbtRoot = path.join(ROOT, 'examples', 'dbt');
    expect(existsSync(path.join(dbtRoot, 'dbt_project.yml'))).toBe(true);
    expect(existsSync(path.join(dbtRoot, 'models'))).toBe(true);
    expect(existsSync(path.join(dbtRoot, 'models', 'marts', 'schema.yml'))).toBe(true);
    expect(existsSync(path.join(dbtRoot, 'models', 'staging', 'sources.yml'))).toBe(true);

    for (const rel of [
      'examples/dbt/models/marts/orders.sql',
      'examples/dbt/models/marts/customers.sql',
    ]) {
      readUtf8(rel);
    }
  });
});
