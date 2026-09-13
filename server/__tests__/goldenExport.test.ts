import { createHash } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORTERS, exporterCommandId } from '@/features/command-palette/actions';
import type { ExportFormat } from '../exportDispatch.ts';
import { ROOT } from '../paths.ts';

const GOLDEN_ROOT = path.join(ROOT, 'fixtures', 'golden');
const SAMPLE_PATH = path.join(GOLDEN_ROOT, 'sample.dbml');

let tmpDir: string;

beforeEach(async () => {
  // Capture day of fixtures/golden (Task 2). modelToLlmContext stamps `new Date()`;
  // pin only Date so the rest of contexto.md stays a real byte comparison.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strata-golden-export-'));
  process.env.LOCALDRAWDB_DATA_DIR = tmpDir;
  delete process.env.LOCALDRAWDB_DOMAIN;
  delete process.env.LOCALDRAWDB_PROJECT;
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.LOCALDRAWDB_DATA_DIR;
  delete process.env.LOCALDRAWDB_DOMAIN;
  delete process.env.LOCALDRAWDB_PROJECT;
  vi.useRealTimers();
  vi.resetModules();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function firstDiff(golden: Buffer, actual: Buffer): string {
  const n = Math.min(golden.length, actual.length);
  for (let i = 0; i < n; i++) {
    if (golden[i] !== actual[i]) {
      const gCtx = golden.subarray(Math.max(0, i - 8), Math.min(golden.length, i + 8));
      const aCtx = actual.subarray(Math.max(0, i - 8), Math.min(actual.length, i + 8));
      return [
        `first differing byte at offset ${i}`,
        `golden[i]=0x${golden[i].toString(16).padStart(2, '0')} actual[i]=0x${actual[i]
          .toString(16)
          .padStart(2, '0')}`,
        `golden_len=${golden.length} actual_len=${actual.length}`,
        `golden_ctx=${gCtx.toString('hex')}`,
        `actual_ctx=${aCtx.toString('hex')}`,
      ].join(' ');
    }
  }
  if (golden.length !== actual.length) {
    return `common prefix identical; golden_len=${golden.length} actual_len=${actual.length}`;
  }
  return 'identical';
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function rec(current: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await rec(path.join(current, entry.name), nextRel);
      else out.push(nextRel);
    }
  }
  await rec(dir, '');
  return out.sort();
}

function relUnderFormat(written: string, outputDir: string): string {
  const abs = path.isAbsolute(written) ? written : path.resolve(ROOT, written);
  const rel = path.relative(outputDir, abs);
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts[0] === '..') {
    throw new Error(`exported file is outside the isolated output dir: ${written}`);
  }
  return parts.slice(1).join('/');
}

function dialectOf(
  exporter: (typeof EXPORTERS)[number],
): 'spark' | 'oracle' | undefined {
  return 'dialect' in exporter ? exporter.dialect : undefined;
}

describe('golden export parity', () => {
  for (const exporter of EXPORTERS) {
    it(`${exporterCommandId(exporter)} matches fixtures/golden/${exporter.id}/ byte-for-byte`, async () => {
      const { ensureRegistry, getActiveSlug, projectOutputDir } = await import('../files.ts');
      const { dbmlToModel } = await import('../dbmlIo.ts');
      const { runExport } = await import('../exportDispatch.ts');

      await ensureRegistry();
      const outputDir = projectOutputDir(await getActiveSlug());
      const dbml = await fs.readFile(SAMPLE_PATH, 'utf8');
      const dialect = dialectOf(exporter);
      const written = await runExport(dbmlToModel(dbml), {
        format: exporter.id as ExportFormat,
        dialect,
      });

      const goldenDir = path.join(GOLDEN_ROOT, exporter.id);
      let goldenRels = await walkFiles(goldenDir);
      // localdrawdb spark/oracle share this dir; each case writes one dialect file.
      if (exporter.id === 'localdrawdb' && dialect) {
        goldenRels = goldenRels.filter((rel) => rel === `model_${dialect}.sql`);
      }
      const actualByRel = new Map<string, Buffer>();
      for (const file of written) {
        const rel = relUnderFormat(file, outputDir);
        actualByRel.set(rel, await fs.readFile(path.isAbsolute(file) ? file : path.resolve(ROOT, file)));
      }

      expect(goldenRels.length, `no golden files under fixtures/golden/${exporter.id}/`).toBeGreaterThan(
        0,
      );
      expect(actualByRel.size, `${exporter.id} export wrote no files`).toBeGreaterThan(0);

      const allRels = [...new Set([...goldenRels, ...actualByRel.keys()])].sort();
      for (const rel of allRels) {
        const goldenPath = path.join(goldenDir, rel);
        const actual = actualByRel.get(rel) ?? null;
        const golden = existsSync(goldenPath) ? await fs.readFile(goldenPath) : null;
        const gHash = golden ? sha256(golden) : '(missing)';
        const aHash = actual ? sha256(actual) : '(missing)';
        const gLen = golden ? String(golden.length) : '-';
        const aLen = actual ? String(actual.length) : '-';
        const diff =
          golden && actual ? firstDiff(golden, actual) : 'one side missing';
        const message = [
          `${exporter.id}/${rel} is not byte-identical to golden`,
          `golden: ${gHash} (${gLen} bytes) ${goldenPath}`,
          `actual: ${aHash} (${aLen} bytes)`,
          diff,
        ].join('\n');
        expect(golden, message).toBeTruthy();
        expect(actual, message).toBeTruthy();
        expect(golden!.equals(actual!), message).toBe(true);
      }
    });
  }
});
