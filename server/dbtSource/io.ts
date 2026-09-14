// Lê um domínio no layout dbt da 0001 para ProjectFiles (somente leitura).
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
