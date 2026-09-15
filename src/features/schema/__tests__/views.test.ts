import { createHash } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXPORTERS, exporterCommandId } from "@/features/command-palette/actions";
import { splitDbmlBlocks } from "@/features/schema/model/blocks";
import { cleanDbml } from "@/features/schema/model/dbmlClean";
import { organize } from "@/features/schema/model/organize";
import {
  parseViewsBlock,
  removeTableFromViews,
  renameTableInViews,
  resolveViewTables,
  serializeViewsBlock,
  type SchemaView,
} from "@/features/schema/model/views";

const FOUR_VIEWS = `Views {
  bronze_ingestao [detail: keys] {
    tables: bronze.raw_events, bronze.raw_customers
    positions: bronze.raw_events 120 80, bronze.raw_customers 480 80
  }
  gold_negocio [detail: docs] {
    tables: gold.*
  }
  silver_only {
    tables: silver.dim_customer
    positions: silver.dim_customer 10 20
  }
  staging_plain {
    tables: staging.events
  }
}
`;

const ROOT = process.cwd();
const GOLDEN_ROOT = path.join(ROOT, "fixtures", "golden");
const SAMPLE_PATH = path.join(GOLDEN_ROOT, "sample.dbml");
const VIEWS_SUFFIX = `
Views {
  bronze_ingestao [detail: keys] {
    tables: loja.cliente
    positions: loja.cliente 120 80
  }
}
`;

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function firstDiff(golden: Buffer, actual: Buffer): string {
  const n = Math.min(golden.length, actual.length);
  for (let i = 0; i < n; i++) {
    if (golden[i] !== actual[i]) {
      return `first differing byte at offset ${i}`;
    }
  }
  if (golden.length !== actual.length) {
    return `common prefix identical; golden_len=${golden.length} actual_len=${actual.length}`;
  }
  return "identical";
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function rec(current: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await rec(path.join(current, entry.name), nextRel);
      else out.push(nextRel);
    }
  }
  await rec(dir, "");
  return out.sort();
}

function relUnderFormat(written: string, outputDir: string): string {
  const abs = path.isAbsolute(written) ? written : path.resolve(ROOT, written);
  const rel = path.relative(outputDir, abs);
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts[0] === "..") {
    throw new Error(`exported file is outside the isolated output dir: ${written}`);
  }
  return parts.slice(1).join("/");
}

function dialectOf(exporter: (typeof EXPORTERS)[number]): "spark" | "oracle" | undefined {
  return "dialect" in exporter ? exporter.dialect : undefined;
}

function serverHref(file: string): string {
  return pathToFileURL(path.join(ROOT, "server", file)).href;
}

describe("views block", () => {
  it("G1: parse/serialize round-trip of 4 views (glob, positions, no positions, missing detail)", () => {
    expect(splitDbmlBlocks(FOUR_VIEWS).some((b) => b.type === "views")).toBe(true);

    const parsed = parseViewsBlock(FOUR_VIEWS);
    expect(parsed).toHaveLength(4);

    const byId = Object.fromEntries(parsed.map((v) => [v.id, v]));
    expect(byId.bronze_ingestao).toMatchObject({
      id: "bronze_ingestao",
      name: "bronze_ingestao",
      detail: "keys",
      tables: ["bronze.raw_events", "bronze.raw_customers"],
      positions: {
        "bronze.raw_events": { x: 120, y: 80 },
        "bronze.raw_customers": { x: 480, y: 80 },
      },
    });
    expect(byId.gold_negocio).toMatchObject({
      id: "gold_negocio",
      detail: "docs",
      tables: ["gold.*"],
    });
    expect(byId.gold_negocio.positions).toBeUndefined();
    expect(byId.silver_only.detail).toBeUndefined();
    expect(byId.silver_only.positions).toEqual({ "silver.dim_customer": { x: 10, y: 20 } });
    expect(byId.staging_plain).toMatchObject({
      tables: ["staging.events"],
    });
    expect(byId.staging_plain.detail).toBeUndefined();
    expect(byId.staging_plain.positions).toBeUndefined();

    const again = parseViewsBlock(serializeViewsBlock(parsed));
    expect(again).toEqual(parsed);

    const src = `Table t {\n  id int\n}\n${FOUR_VIEWS}`;
    expect(cleanDbml(src)).not.toMatch(/Views/i);
    expect(organize(src)).toMatch(/Views\s*\{/);
  });

  it("G2: renameTableInViews and removeTableFromViews", () => {
    const views: SchemaView[] = parseViewsBlock(FOUR_VIEWS);
    const renamed = renameTableInViews(views, "bronze.raw_events", "bronze.raw_evts");
    const bronze = renamed.find((v) => v.id === "bronze_ingestao")!;
    expect(bronze.tables).toEqual(["bronze.raw_evts", "bronze.raw_customers"]);
    expect(bronze.positions).toEqual({
      "bronze.raw_evts": { x: 120, y: 80 },
      "bronze.raw_customers": { x: 480, y: 80 },
    });
    expect(renamed.find((v) => v.id === "gold_negocio")!.tables).toEqual(["gold.*"]);

    const removed = removeTableFromViews(renamed, "bronze.raw_customers");
    const after = removed.find((v) => v.id === "bronze_ingestao")!;
    expect(after.tables).toEqual(["bronze.raw_evts"]);
    expect(after.positions).toEqual({ "bronze.raw_evts": { x: 120, y: 80 } });
  });

  it("G3: resolveViewTables expands gold.*", () => {
    const view: SchemaView = {
      id: "gold_negocio",
      name: "gold_negocio",
      tables: ["gold.*"],
    };
    expect(
      resolveViewTables(view, ["gold.fato", "gold.dim_product", "silver.dim_customer", "gold"]),
    ).toEqual(["gold.fato", "gold.dim_product"]);
  });
});

describe("G4: exporters ignore Views {}", () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T12:00:00.000Z"));
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "strata-views-golden-"));
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

  it("G4: golden fixtures of the 9 exporters are unchanged when DBML contains Views {}", async () => {
    const filesHref = serverHref("files.ts");
    const dbmlIoHref = serverHref("dbmlIo.ts");
    const exportHref = serverHref("exportDispatch.ts");
    const { ensureRegistry, getActiveSlug, projectOutputDir } = await import(filesHref);
    const { dbmlToModel } = await import(dbmlIoHref);
    const { runExport } = await import(exportHref);

    await ensureRegistry();
    const outputDir = projectOutputDir(await getActiveSlug());
    const sample = await fs.readFile(SAMPLE_PATH, "utf8");
    const dbml = `${sample.replace(/\n+$/, "")}\n${VIEWS_SUFFIX}`;
    expect(dbml).toMatch(/Views\s*\{/);
    expect(cleanDbml(dbml)).toBe(cleanDbml(sample));

    for (const exporter of EXPORTERS) {
      const dialect = dialectOf(exporter);
      const written = await runExport(dbmlToModel(dbml), {
        format: exporter.id,
        dialect,
      });

      const goldenDir = path.join(GOLDEN_ROOT, exporter.id);
      let goldenRels = await walkFiles(goldenDir);
      if (exporter.id === "localdrawdb" && dialect) {
        goldenRels = goldenRels.filter((rel) => rel === `model_${dialect}.sql`);
      }
      const actualByRel = new Map<string, Buffer>();
      for (const file of written as string[]) {
        const rel = relUnderFormat(file, outputDir);
        actualByRel.set(
          rel,
          await fs.readFile(path.isAbsolute(file) ? file : path.resolve(ROOT, file)),
        );
      }

      expect(
        goldenRels.length,
        `no golden files under fixtures/golden/${exporter.id}/`,
      ).toBeGreaterThan(0);
      expect(actualByRel.size, `${exporter.id} export wrote no files`).toBeGreaterThan(0);

      const allRels = [...new Set([...goldenRels, ...actualByRel.keys()])].sort();
      for (const rel of allRels) {
        const goldenPath = path.join(goldenDir, rel);
        const actual = actualByRel.get(rel) ?? null;
        const golden = existsSync(goldenPath) ? await fs.readFile(goldenPath) : null;
        const message = [
          `${exporterCommandId(exporter)}/${rel} changed when Views {} was present`,
          `golden: ${golden ? sha256(golden) : "(missing)"}`,
          `actual: ${actual ? sha256(actual) : "(missing)"}`,
          golden && actual ? firstDiff(golden, actual) : "one side missing",
        ].join("\n");
        expect(golden, message).toBeTruthy();
        expect(actual, message).toBeTruthy();
        expect(golden!.equals(actual!), message).toBe(true);
      }
    }
  });
});

describe("S11 review: block location and transient parse errors", () => {
  it("R6: a table whose name ends in `views` is never taken for the Views block", async () => {
    const { replaceViewsBlock } = await import("@/features/schema/model/views");
    const src = "Table reporting.daily_views {\n  id int [pk]\n}\n\nTable gold.x {\n  id int\n}\n";
    expect(parseViewsBlock(src)).toEqual([]);
    const out = replaceViewsBlock(src, [{ id: "a", name: "a", tables: ["gold.x"] }]);
    expect(out).toContain("Table reporting.daily_views {\n  id int [pk]\n}");
    expect(out).toContain("Table gold.x {\n  id int\n}");
    expect(parseViewsBlock(out)).toEqual([{ id: "a", name: "a", tables: ["gold.x"] }]);
    const again = replaceViewsBlock(out, [{ id: "b", name: "b", tables: ["gold.x"] }]);
    expect(again).toContain("Table reporting.daily_views {\n  id int [pk]\n}");
    expect(parseViewsBlock(again).map((v) => v.id)).toEqual(["b"]);
    expect(replaceViewsBlock(again, [])).not.toMatch(/^Views\s*\{/m);
  });

  it("R6: replacing keeps blocks after Views and a note that mentions `Views {`", async () => {
    const { replaceViewsBlock } = await import("@/features/schema/model/views");
    const src =
      "Table a.t {\n  id int [note: 'see Views { x }']\n}\n\nViews {\n  v1 {\n    tables: a.t\n  }\n}\n\nTable b.u {\n  id int\n}\n";
    const out = replaceViewsBlock(src, [{ id: "v2", name: "v2", tables: ["b.u"] }]);
    expect(out).toContain("[note: 'see Views { x }']");
    expect(out).toContain("Table b.u {\n  id int\n}");
    expect(parseViewsBlock(out).map((v) => v.id)).toEqual(["v2"]);
  });

  it("R7: a transient DBML parse error does not empty the views", async () => {
    const { useSchemaStore } = await import("@/features/schema/store");
    const good =
      "Table gold.x {\n  id int\n}\n\nTable gold.y {\n  id int\n}\n\nViews {\n  negocio {\n    tables: gold.x, gold.y\n  }\n}\n";
    useSchemaStore.getState().setDbml(good);
    const broken = good.replace("id int\n}\n\nTable gold.y", "id int\n\nTable gold.y");
    useSchemaStore.getState().setDbml(broken);
    // Fix the brace in place, as the editor would — not by restoring the original text.
    useSchemaStore
      .getState()
      .setDbml((d) => d.replace("id int\n\nTable gold.y", "id int\n}\n\nTable gold.y"));
    expect(parseViewsBlock(useSchemaStore.getState().dbml)[0].tables).toEqual(["gold.x", "gold.y"]);
  });
});
