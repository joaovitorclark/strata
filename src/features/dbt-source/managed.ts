import { asArray, asRecord, asString, dumpYaml, loadYaml } from "./yaml";
import { qualifiedTableId, type ProjectFiles } from "./model";
import { MANAGED_SQL_HEADER } from "./managedHeader";
import packageJson from "../../../package.json";

export type { ProjectFiles };

export const STRATA_MANAGED_TAG = "strata:managed";
export const DIVERGENT_MARKERS = "marcadores divergentes";
export const LOCK_PATH = ".strata/generated.lock.yml";
export const GITATTRIBUTES_PATH = ".gitattributes";
export const STRATA_BEGIN = "# strata:begin";
export const STRATA_END = "# strata:end";
export const GENERATOR_NAME = "strata";
export const GENERATOR_VERSION: string = packageJson.version;

export type LockEntry = { sha256: string; generator_version: string };
export type GeneratedLock = Record<string, LockEntry>;
export type ManagedStatus = "managed" | "manual" | "drift";

export type ManagedReport = {
  tableId: string;
  modelName: string;
  sqlPath: string;
  ymlPath: string;
  status: ManagedStatus;
  problems: string[];
};

export type ManagedModelLoc = {
  tableId: string;
  name: string;
  ymlPath: string;
  sqlPath: string;
};

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Sync SHA-256 (hex). Browser-safe; matches node:crypto. */
export function sha256Hex(message: string): string {
  const data = new TextEncoder().encode(message);
  const bitLen = data.length * 8;
  const padded = new Uint8Array(((data.length + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(padded.length - 4, bitLen >>> 0);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, "0")).join("");
}

function layerOfPath(filePath: string, project: string): string | undefined {
  const m = new RegExp(
    `^models/${project.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}/([^/]+)/`,
  ).exec(filePath);
  return m?.[1];
}

function markersOf(node: Record<string, unknown> | undefined): { tag: boolean; meta: boolean } {
  const config = asRecord(node?.config);
  const tags = asArray(config?.tags).map(String);
  const strata = asRecord(asRecord(config?.meta)?.strata);
  return { tag: tags.includes(STRATA_MANAGED_TAG), meta: strata?.managed === true };
}

export function parseLock(text: string | undefined): GeneratedLock {
  const rec = asRecord(loadYaml(text && text.trim() ? text : "{}"));
  if (!rec) return {};
  const out: GeneratedLock = {};
  for (const [key, value] of Object.entries(rec)) {
    const entry = asRecord(value);
    const hash = asString(entry?.sha256);
    if (!hash) continue;
    out[key] = { sha256: hash, generator_version: asString(entry?.generator_version) ?? "" };
  }
  return out;
}

export function serializeLock(lock: GeneratedLock): string {
  const keys = Object.keys(lock).sort();
  const ordered: GeneratedLock = {};
  for (const key of keys) ordered[key] = lock[key];
  return dumpYaml(ordered);
}

export function setLockEntry(files: ProjectFiles, sqlPath: string, sql: string): ProjectFiles {
  const lock = parseLock(files[LOCK_PATH]);
  lock[sqlPath] = { sha256: sha256Hex(sql), generator_version: GENERATOR_VERSION };
  return { ...files, [LOCK_PATH]: serializeLock(lock) };
}

export function removeLockEntry(files: ProjectFiles, sqlPath: string): ProjectFiles {
  const lock = parseLock(files[LOCK_PATH]);
  if (!(sqlPath in lock)) return files;
  delete lock[sqlPath];
  return { ...files, [LOCK_PATH]: serializeLock(lock) };
}

export function retargetLockEntry(files: ProjectFiles, from: string, to: string): ProjectFiles {
  const lock = parseLock(files[LOCK_PATH]);
  if (!(from in lock)) return files;
  lock[to] = lock[from];
  delete lock[from];
  return { ...files, [LOCK_PATH]: serializeLock(lock) };
}

export function setGitAttributesPath(text: string, sqlPath: string, present: boolean): string {
  const line = `${sqlPath} linguist-generated=true`;
  let src = text;
  let beginIdx = src.indexOf(STRATA_BEGIN);
  let endIdx = src.indexOf(STRATA_END);
  if (beginIdx < 0 || endIdx < beginIdx) {
    const prefix = src.length === 0 ? "" : src.endsWith("\n") ? src : `${src}\n`;
    src = `${prefix}${STRATA_BEGIN}\n${STRATA_END}\n`;
    beginIdx = src.indexOf(STRATA_BEGIN);
    endIdx = src.indexOf(STRATA_END);
  }
  const before = src.slice(0, beginIdx);
  const after = src.slice(endIdx + STRATA_END.length);
  const innerRaw = src.slice(beginIdx + STRATA_BEGIN.length, endIdx);
  const innerLines = innerRaw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== line);
  if (present) innerLines.push(line);
  innerLines.sort();
  const inner = innerLines.length ? `\n${innerLines.join("\n")}\n` : `\n`;
  return `${before}${STRATA_BEGIN}${inner}${STRATA_END}${after}`;
}

export function ensureSqlHeader(sql: string): string {
  const first = sql.split("\n")[0];
  if (first === MANAGED_SQL_HEADER) return sql.endsWith("\n") ? sql : `${sql}\n`;
  const body = sql.startsWith(`${MANAGED_SQL_HEADER}\n`)
    ? sql.slice(MANAGED_SQL_HEADER.length + 1)
    : sql;
  const rest = body.startsWith("\n") ? body.slice(1) : body;
  return `${MANAGED_SQL_HEADER}\n${rest.endsWith("\n") || rest.length === 0 ? rest : `${rest}\n`}`;
}

export function listManagedModels(files: ProjectFiles, project: string): ManagedModelLoc[] {
  const out: ManagedModelLoc[] = [];
  const prefix = `models/${project}/`;
  for (const [ymlPath, content] of Object.entries(files)) {
    if (!ymlPath.startsWith(prefix) || !(ymlPath.endsWith(".yml") || ymlPath.endsWith(".yaml"))) {
      continue;
    }
    const doc = asRecord(loadYaml(content));
    if (!doc) continue;
    const layer = layerOfPath(ymlPath, project);
    const slash = ymlPath.lastIndexOf("/");
    const dir = slash >= 0 ? ymlPath.slice(0, slash) : "";
    for (const raw of asArray(doc.models)) {
      const node = asRecord(raw);
      const name = asString(node?.name);
      if (!name) continue;
      const schema = asString(asRecord(node?.config)?.schema) ?? layer;
      out.push({
        tableId: qualifiedTableId(schema, name),
        name,
        ymlPath,
        sqlPath: `${dir}/${name}.sql`,
      });
    }
  }
  return out;
}

export function findManagedModel(
  files: ProjectFiles,
  project: string,
  tableId: string,
): ManagedModelLoc | undefined {
  return listManagedModels(files, project).find(
    (loc) => loc.tableId === tableId || loc.name === tableId,
  );
}

export function inspectManaged(files: ProjectFiles, project: string): ManagedReport[] {
  const lock = parseLock(files[LOCK_PATH]);
  const reports: ManagedReport[] = [];
  for (const loc of listManagedModels(files, project)) {
    const node = asRecord(
      asArray(asRecord(loadYaml(files[loc.ymlPath] ?? ""))?.models).find(
        (raw) => asString(asRecord(raw)?.name) === loc.name,
      ),
    );
    const { tag, meta } = markersOf(node);
    if (!tag && !meta) continue;
    const sql = files[loc.sqlPath] ?? "";
    const problems: string[] = [];
    let status: ManagedStatus;
    if (tag !== meta) {
      status = "manual";
      problems.push(`${loc.name}: ${DIVERGENT_MARKERS}`);
    } else if (lock[loc.sqlPath]?.sha256 !== sha256Hex(sql)) {
      status = "drift";
    } else {
      status = "managed";
    }
    reports.push({
      tableId: loc.tableId,
      modelName: loc.name,
      sqlPath: loc.sqlPath,
      ymlPath: loc.ymlPath,
      status,
      problems,
    });
  }
  return reports;
}

export function verifyReports(reports: ManagedReport[]): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  for (const r of reports) {
    if (r.status === "drift") lines.push(`drift: ${r.modelName} (${r.sqlPath})`);
    for (const p of r.problems) lines.push(p);
  }
  return { ok: lines.length === 0, lines };
}
