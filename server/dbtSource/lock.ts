import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';

export const LOCK_REL = '.strata/generated.lock.yml';

export type LockEntry = { sha256: string; generator_version: string };
export type GeneratedLock = Record<string, LockEntry>;

export function lockSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function parseGeneratedLock(text: string): GeneratedLock {
  const raw = parse(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: GeneratedLock = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const rec = value as Record<string, unknown>;
    if (typeof rec.sha256 !== 'string') continue;
    out[key] = {
      sha256: rec.sha256,
      generator_version: typeof rec.generator_version === 'string' ? rec.generator_version : '',
    };
  }
  return out;
}

export function serializeGeneratedLock(lock: GeneratedLock): string {
  const keys = Object.keys(lock).sort();
  const ordered: GeneratedLock = {};
  for (const key of keys) ordered[key] = lock[key];
  const text = stringify(ordered, { lineWidth: 100 });
  return text.endsWith('\n') ? text : `${text}\n`;
}

export async function readGeneratedLock(domainDir: string): Promise<GeneratedLock> {
  try {
    const text = await fs.readFile(path.join(domainDir, LOCK_REL), 'utf8');
    return parseGeneratedLock(text);
  } catch {
    return {};
  }
}

export async function writeGeneratedLock(domainDir: string, lock: GeneratedLock): Promise<void> {
  const dest = path.join(domainDir, LOCK_REL);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, serializeGeneratedLock(lock), 'utf8');
}
