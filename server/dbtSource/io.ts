// Lê e grava um domínio no layout dbt da 0001 para ProjectFiles.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SKIP_DIR = new Set([
  'projects',
  '.git',
  'target',
  'logs',
  'dbt_packages',
  '.venv-dbt',
  'node_modules',
  'input',
  'output',
]);

const SKIP_FILE = new Set(['projects.json']);

export async function readDbtProjectFiles(domainDir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIR.has(e.name)) continue;
        await walk(path.join(dir, e.name));
        continue;
      }
      if (SKIP_FILE.has(e.name) || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(domainDir, full).split(path.sep).join('/');
      files[rel] = await fs.readFile(full, 'utf8');
    }
  };
  await walk(domainDir);
  return files;
}

export type DbtFs = {
  mkdir: typeof fs.mkdir;
  writeFile: typeof fs.writeFile;
  rename: typeof fs.rename;
  unlink: typeof fs.unlink;
};

/**
 * The client may only write the dbt project and Strata's own metadata. Anything else in the domain
 * repository — `.git/` (hooks run code), CI config, unrelated files — is refused.
 */
const WRITABLE = [/^models\//, /^seeds\//, /^snapshots\//, /^\.strata\//, /^dbt_project\.yml$/, /^\.gitattributes$/];

function assertSafeRel(rel: string): void {
  const normalized = rel.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.includes('..') || path.isAbsolute(rel)) {
    throw new Error(`unsafe dbt path: ${rel}`);
  }
  if (!WRITABLE.some((re) => re.test(normalized))) {
    throw new Error(`dbt path outside the writable project area: ${rel}`);
  }
}

/** Grava `changes` atomicamente: todos os temporários primeiro; se um write falha, originais intactos. */
export async function writeDbtChanges(
  domainDir: string,
  changes: Record<string, string | null>,
  io: DbtFs = fs,
): Promise<string[]> {
  const entries = Object.entries(changes);
  // Validate every path before touching the disk, so a bad path in a batch writes nothing at all.
  for (const [rel] of entries) assertSafeRel(rel);
  const temps: Array<{ tmp: string; dest: string }> = [];
  try {
    for (const [rel, content] of entries) {
      assertSafeRel(rel);
      if (content === null) continue;
      const dest = path.join(domainDir, rel);
      await io.mkdir(path.dirname(dest), { recursive: true });
      const tmp = `${dest}.strata-tmp`;
      await io.writeFile(tmp, content, 'utf8');
      temps.push({ tmp, dest });
    }
  } catch (err) {
    await Promise.all(temps.map((t) => io.unlink(t.tmp).catch(() => undefined)));
    throw err;
  }
  const written: string[] = [];
  for (const t of temps) {
    await io.rename(t.tmp, t.dest);
    written.push(path.relative(domainDir, t.dest).split(path.sep).join('/'));
  }
  for (const [rel, content] of entries) {
    if (content !== null) continue;
    const dest = path.join(domainDir, rel);
    await io.unlink(dest).catch(() => undefined);
    written.push(rel);
  }
  return written;
}
