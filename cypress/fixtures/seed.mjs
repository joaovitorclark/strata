#!/usr/bin/env node
/**
 * One-shot generator for the committed Cypress fixture data directory.
 *
 * Starts Fastify on STRATA_DATA_DIR=cypress/fixtures/data (STRATA_DOMAIN=local),
 * creates smoke / wide / large via POST /api/projects, imports DBML through
 * POST /api/projects/:id/import, persists with PUT, deletes `default`, activates
 * smoke. Specs must not run this at runtime.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_DIR = path.join(ROOT, "cypress", "fixtures", "data");
const TSX = path.join(ROOT, "node_modules", ".bin", "tsx");
const PORT = Number(process.env.PORT ?? 5174);
const BASE = `http://127.0.0.1:${PORT}`;

function smokeDbml() {
  return `Table vendas.cliente {
  id bigint [pk]
  nome string
}

Table vendas.pedido {
  id bigint [pk]
  cliente_id bigint
  total decimal(18,2)
}

Table vendas.item {
  id bigint [pk]
  sku string
}

Table vendas.resumo {
  id bigint [pk]
  total decimal(18,2)
}

Ref: vendas.pedido.cliente_id > vendas.cliente.id

Lineage {
  vendas.resumo < vendas.pedido
}

LayerGroup bronze {
  vendas.cliente
}

LayerGroup prata {
  vendas.pedido
  vendas.item
}

LayerGroup ouro {
  vendas.resumo
}
`;
}

function wideDbml() {
  const cols = ["  id bigint [pk]"];
  for (let i = 2; i <= 187; i += 1) {
    cols.push(`  c${String(i).padStart(3, "0")} int`);
  }
  return `Table wide.hub {
${cols.join("\n")}
}

Table wide.left {
  id bigint [pk]
  hub_id bigint
}

Table wide.right {
  id bigint [pk]
  hub_id bigint
}

Ref: wide.left.hub_id > wide.hub.id
Ref: wide.right.hub_id > wide.hub.id
`;
}

function largeDbml() {
  const tables = [];
  const bronze = [];
  const prata = [];
  const ouro = [];
  for (let i = 1; i <= 200; i += 1) {
    const name = `t${String(i).padStart(3, "0")}`;
    const id = `lake.${name}`;
    tables.push(`Table ${id} {
  id bigint [pk]
  a int
  b string
}`);
    if (i % 3 === 1) bronze.push(id);
    else if (i % 3 === 2) prata.push(id);
    else ouro.push(id);
  }
  const layer = (name, members) =>
    `LayerGroup ${name} {\n${members.map((m) => `  ${m}`).join("\n")}\n}`;
  return `${tables.join("\n\n")}\n\n${layer("bronze", bronze)}\n\n${layer("prata", prata)}\n\n${layer("ouro", ouro)}\n`;
}

function countTables(dbml) {
  return (dbml.match(/^Table /gm) ?? []).length;
}

function columnCount(dbml, tableId) {
  const re = new RegExp(`^Table ${tableId.replaceAll(".", "\\.")} \\{([^}]*)\\}`, "m");
  const m = dbml.match(re);
  if (!m) throw new Error(`table ${tableId} missing from imported dbml`);
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^Note:/i.test(l) && !/^indexes\b/i.test(l)).length;
}

async function waitForServer(timeoutMs = 30_000) {
  const start = Date.now();
  let lastErr = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/context`);
      if (res.ok) return;
      lastErr = `${res.status} ${await res.text()}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`seed server did not become ready on ${BASE}: ${lastErr}`);
}

async function api(method, pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status}: ${text}`);
  }
  return json;
}

async function seedProject(name, dbml) {
  const meta = await api("POST", "/api/projects", { name });
  const imported = await api("POST", `/api/projects/${meta.id}/import`, { dbml });
  if (imported.warnings?.some((w) => /DBML do projeto ignorado/i.test(w))) {
    throw new Error(`${name} import ignored DBML: ${imported.warnings.join("; ")}`);
  }
  await api("PUT", `/api/projects/${meta.id}`, { dbml: imported.dbml, canvas: {} });
  return { meta, dbml: imported.dbml };
}

function startServer() {
  const logPath = path.join(os.tmpdir(), `strata-seed-server-${PORT}.log`);
  const log = createWriteStream(logPath);
  const child = spawn(TSX, ["server/index.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      STRATA_DATA_DIR: FIXTURE_DIR,
      STRATA_DOMAIN: "local",
      PORT: String(PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  return { child, logPath };
}

async function stopServer(child) {
  if (!child.pid || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function main() {
  await fs.rm(FIXTURE_DIR, { recursive: true, force: true });
  await fs.mkdir(FIXTURE_DIR, { recursive: true });

  const { child, logPath } = startServer();
  let failed = false;
  try {
    await waitForServer();

    const ctx = await api("GET", "/api/context");
    if (ctx.domain?.slug !== "local") {
      throw new Error(`expected pinned domain local, got ${JSON.stringify(ctx)}`);
    }

    // First project-list hits ensureRegistry() which creates `default`.
    await api("GET", "/api/projects");

    const smoke = await seedProject("smoke", smokeDbml());
    const wide = await seedProject("wide", wideDbml());
    const large = await seedProject("large", largeDbml());

    const smokeTables = countTables(smoke.dbml);
    const wideTables = countTables(wide.dbml);
    const largeTables = countTables(large.dbml);
    const hubCols = columnCount(wide.dbml, "wide.hub");
    if (smokeTables !== 4) throw new Error(`smoke expected 4 tables, got ${smokeTables}`);
    if (wideTables !== 3) throw new Error(`wide expected 3 tables, got ${wideTables}`);
    if (largeTables !== 200) throw new Error(`large expected 200 tables, got ${largeTables}`);
    if (hubCols !== 187) throw new Error(`wide.hub expected 187 columns, got ${hubCols}`);
    if (!smoke.dbml.includes("vendas.pedido")) {
      throw new Error("smoke dbml missing vendas.pedido");
    }
    if (!/^Ref:/m.test(smoke.dbml)) throw new Error("smoke missing Ref");
    if (!/Lineage\s*\{/.test(smoke.dbml)) throw new Error("smoke missing Lineage");
    for (const layer of ["bronze", "prata", "ouro"]) {
      if (!new RegExp(`LayerGroup ${layer}`).test(smoke.dbml)) {
        throw new Error(`smoke missing LayerGroup ${layer}`);
      }
    }

    const listed = await api("GET", "/api/projects");
    const def = listed.projects.find((p) => p.slug === "default");
    if (def) await api("DELETE", `/api/projects/${def.id}`);

    const after = await api("GET", "/api/projects");
    const slugs = after.projects.map((p) => p.slug).sort();
    if (slugs.join(",") !== "large,smoke,wide") {
      throw new Error(`expected slugs large,smoke,wide; got ${slugs.join(",")}`);
    }
    const smokeMeta = after.projects.find((p) => p.slug === "smoke");
    await api("POST", `/api/projects/${smokeMeta.id}/activate`);

    const activated = await api("GET", "/api/projects");
    if (activated.activeId !== smokeMeta.id) {
      throw new Error(`activeId is ${activated.activeId}, expected smoke ${smokeMeta.id}`);
    }

    console.log("seeded cypress/fixtures/data");
    console.log(`  smoke: ${smokeTables} tables`);
    console.log(`  wide: ${wideTables} tables, wide.hub ${hubCols} columns`);
    console.log(`  large: ${largeTables} tables`);
    console.log(`  active: smoke (${smokeMeta.id})`);
  } catch (err) {
    failed = true;
    console.error(err);
    console.error(`server log: ${logPath}`);
    throw err;
  } finally {
    await stopServer(child);
  }
  if (failed) process.exit(1);
}

main().catch(() => process.exit(1));
