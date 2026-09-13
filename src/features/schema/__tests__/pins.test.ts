import { describe, expect, it } from 'vitest';
import { splitDbmlBlocks } from '@/features/schema/model/blocks';
import { cleanDbml, parsePinsBlock } from '@/features/schema/model/dbmlClean';
import { parseDbml } from '@/features/schema/model/parse';
import { pinColumn, unpinColumn } from '@/features/schema/model/edit';
import { organize } from '@/features/schema/model/organize';

describe('bloco Pins', () => {
  it('tokeniza como pins', () => {
    const blocks = splitDbmlBlocks('Pins {\n  vendas.pedido.total_brl\n}\n');
    expect(blocks.some((x) => x.type === 'pins')).toBe(true);
  });
  it('parsePinsBlock lê identificadores um por linha', () => {
    expect(
      parsePinsBlock('Pins {\n  vendas.pedido.total_brl\n  vendas.cliente.email\n}'),
    ).toEqual(['vendas.pedido.total_brl', 'vendas.cliente.email']);
  });
  it('cleanDbml remove o bloco (DDL ignora)', () => {
    const src = 'Table t {\n  id int\n}\nPins {\n  t.id\n}';
    expect(cleanDbml(src)).not.toMatch(/Pins/i);
  });
  it('parseDbml expõe pins como lista', () => {
    const src = 'Table t {\n  id int\n}\nPins {\n  t.id\n}';
    expect(parseDbml(src).pins).toEqual(['t.id']);
  });
});

describe('pinColumn / unpinColumn', () => {
  it('cria o bloco e adiciona a coluna', () => {
    const out = pinColumn('Table t {\n  id int\n}\n', 't', 'id');
    expect(out).toMatch(/Pins\s*\{/);
    expect(out).toContain('t.id');
  });
  it('não duplica a mesma coluna', () => {
    const a = pinColumn('', 'vendas.pedido', 'total_brl');
    const b = pinColumn(a, 'vendas.pedido', 'total_brl');
    expect((b.match(/vendas\.pedido\.total_brl/g) ?? []).length).toBe(1);
  });
  it('remove a linha e o bloco se ficar vazio', () => {
    const a = pinColumn('', 't', 'id');
    const out = unpinColumn(a, 't', 'id');
    expect(out).not.toMatch(/Pins/i);
  });
  it('unpin de coluna ausente não altera o src', () => {
    expect(unpinColumn('Table t {\n  id int\n}\n', 't', 'id')).toBe('Table t {\n  id int\n}\n');
  });
});

describe('organize preserva Pins', () => {
  it('Pins sobrevive ao organize', () => {
    const src = `Pins {\n  t.id\n}\n\nTable t {\n  id int\n}\n`;
    const out = organize(src);
    expect(out).toMatch(/Pins\s*\{/);
    expect(out).toContain('t.id');
    expect(splitDbmlBlocks(out).some((b) => b.type === 'pins')).toBe(true);
  });
});
