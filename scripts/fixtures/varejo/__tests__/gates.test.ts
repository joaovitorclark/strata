import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { traceField } from "@/features/canvas/utils/focusGraph";
import { fromDbtProject, type ProjectFiles, type StrataModel } from "@/features/dbt-source";
import { buildVarejoFiles, writeVarejoFiles } from "../generate";
import {
  CHAINS,
  PROJECTS,
  allLineageFields,
  domainTables,
  strataModelFor,
} from "../spec";

function dropUndef<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortBy<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}

function sortRecord<T>(rec: Record<string, T> | undefined): Record<string, T> | undefined {
  if (!rec) return rec;
  return Object.fromEntries(Object.entries(rec).sort(([a], [b]) => a.localeCompare(b)));
}

function normalizeModel(model: StrataModel): unknown {
  return dropUndef({
    project: model.project,
    tables: sortBy(model.tables, (t) => t.id).map((t) => ({
      ...t,
      columns: t.columns.map((c) => ({ ...c })),
      tags: t.tags ? [...t.tags].sort() : undefined,
      indexes: t.indexes?.map((idx) => ({ ...idx, columns: [...idx.columns] })),
    })),
    refs: sortBy(model.refs, (r) => r.id),
    records: sortBy(
      model.records.map((r) => ({
        table: r.table,
        columns: r.columns,
        rows: r.rows,
        note: r.note,
      })),
      (r) => r.table,
    ),
    layerGroups: sortBy(
      model.layerGroups.map((g) => ({ ...g, tables: [...g.tables].sort() })),
      (g) => g.id,
    ),
    lineageFields: sortBy(
      model.lineageFields,
      (l) => `${l.targetTable}.${l.targetColumn}<${l.sourceTable}.${l.sourceColumn}`,
    ),
    rolenames: sortBy(
      model.rolenames,
      (r) => `${r.child.table}.${r.child.column}<${r.parent.table}.${r.parent.column}`,
    ),
    colors: sortRecord(model.colors),
    pins: [...(model.pins ?? [])].sort(),
    views: sortBy(
      model.views.map((v) => ({
        ...v,
        tables: [...v.tables].sort(),
        positions: v.positions ? sortRecord(v.positions) : undefined,
      })),
      (v) => v.id,
    ),
    enums: sortBy(model.enums, (e) => e.name),
    canvas: model.canvas
      ? {
          positions: model.canvas.positions ? sortRecord(model.canvas.positions) : undefined,
          sizes: model.canvas.sizes ? sortRecord(model.canvas.sizes) : undefined,
          collapsedGroups: [...(model.canvas.collapsedGroups ?? [])].sort(),
        }
      : undefined,
  });
}

function readDirFiles(root: string): ProjectFiles {
  const files: ProjectFiles = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (name === "target" || name === "logs" || name === "dbt_packages" || name === ".venv-dbt") {
        continue;
      }
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files[path.relative(root, full).split(path.sep).join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return files;
}

const EXPECTED_COUNTS: Record<string, { bronze: number; silver: number; gold: number; total: number }> =
  {
    vendas: { bronze: 12, silver: 14, gold: 8, total: 34 },
    estoque: { bronze: 10, silver: 12, gold: 6, total: 28 },
    clientes: { bronze: 8, silver: 10, gold: 6, total: 24 },
  };

describe("S15 varejo domain", () => {
  it("G1: exact table counts per project and layer (§3, 86)", () => {
    const locals = domainTables().filter((t) => !t.external);
    expect(locals).toHaveLength(86);
    const counts: Record<string, Record<string, number>> = {};
    for (const projeto of PROJECTS) counts[projeto] = { bronze: 0, silver: 0, gold: 0 };
    for (const table of locals) {
      const layer = table.layer ?? "";
      expect(PROJECTS, table.id).toContain(table.project);
      expect(["bronze", "silver", "gold"], table.id).toContain(layer);
      counts[table.project][layer] += 1;
    }
    for (const projeto of PROJECTS) {
      const got = counts[projeto];
      const exp = EXPECTED_COUNTS[projeto];
      expect(got, projeto).toEqual({ bronze: exp.bronze, silver: exp.silver, gold: exp.gold });
      expect(got.bronze + got.silver + got.gold, `${projeto} total`).toBe(exp.total);
    }
  });

  it("G2: app_eventos ≥180 cols, composite PK, 3 enums, 2 composite indexes", () => {
    const tables = domainTables();
    const app = tables.find((t) => t.id === "bronze.app_eventos");
    expect(app, "bronze.app_eventos").toBeTruthy();
    expect(app!.columns.length).toBeGreaterThanOrEqual(180);
    for (const prefix of ["device_", "geo_", "utm_", "sessao_"] as const) {
      expect(
        app!.columns.some((c) => c.name.startsWith(prefix)),
        `app_eventos prefix ${prefix}`,
      ).toBe(true);
    }

    const itens = tables.find((t) => t.id === "bronze.itens_pedido");
    expect(itens?.compositePks?.[0]).toEqual(["pedido_id", "item_seq"]);

    const enumNames = new Set(
      tables.flatMap((t) => t.columns.map((c) => c.enumName).filter((n): n is string => !!n)),
    );
    expect([...enumNames].sort()).toEqual(["canal_venda", "status_pedido", "tipo_movimentacao"]);

    const compositeIdx = tables.flatMap((t) => t.indexes ?? []).filter((idx) => idx.columns.length >= 2);
    expect(compositeIdx.length).toBeGreaterThanOrEqual(2);
  });

  it("G3: 3 lineage chains of ≥4 hops via traceField", () => {
    const lineageFields = allLineageFields();
    expect(CHAINS).toHaveLength(3);
    for (const chain of CHAINS) {
      expect(chain.length, chain.map((s) => `${s.table}.${s.column}`).join(" → ")).toBeGreaterThanOrEqual(
        4,
      );
      const start = chain[0];
      const result = traceField({
        table: start.table,
        column: start.column,
        lineageFields,
      });
      expect(result.cycle, `${start.table}.${start.column} cycle`).toBe(false);
      const keys = new Set(result.columns.map((c) => `${c.table}.${c.column}`));
      for (const hop of chain) {
        expect(keys, `${start.table}.${start.column}`).toContain(`${hop.table}.${hop.column}`);
      }
      const depths = Object.fromEntries(
        result.columns.map((c) => [`${c.table}.${c.column}`, c.depth]),
      );
      expect(depths[`${chain[chain.length - 1].table}.${chain[chain.length - 1].column}`]).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it("G4: every managed model column has lineage", () => {
    const lineage = allLineageFields();
    const managed = domainTables().filter(
      (t) => t.kind === "model" && !t.external && t.tags?.includes("strata:managed"),
    );
    expect(managed.length).toBeGreaterThan(0);
    for (const table of managed) {
      for (const col of table.columns) {
        const hits = lineage.filter(
          (l) => l.targetTable === table.id && l.targetColumn === col.name,
        );
        expect(hits.length, `${table.id}.${col.name}`).toBeGreaterThan(0);
      }
    }
  });

  it("G5: fromDbtProject(generated) ≡ StrataModel from spec", () => {
    const files = buildVarejoFiles();
    expect(Object.keys(files).length).toBeGreaterThan(10);
    for (const projeto of PROJECTS) {
      const fromDbt = fromDbtProject(files, projeto);
      const fromSpec = strataModelFor(projeto);
      expect(
        fromDbt.tables.filter((t) => !t.external),
        projeto,
      ).toHaveLength(EXPECTED_COUNTS[projeto].total);
      expect(normalizeModel(fromDbt), projeto).toEqual(normalizeModel(fromSpec));
    }
  });

  it("G6: generating twice yields byte-identical directories", () => {
    const a = mkdtempSync(path.join(os.tmpdir(), "varejo-a-"));
    const b = mkdtempSync(path.join(os.tmpdir(), "varejo-b-"));
    try {
      writeVarejoFiles(a, buildVarejoFiles());
      writeVarejoFiles(b, buildVarejoFiles());
      const filesA = readDirFiles(a);
      const filesB = readDirFiles(b);
      expect(Object.keys(filesA).length).toBeGreaterThan(10);
      expect(Object.keys(filesA).sort()).toEqual(Object.keys(filesB).sort());
      for (const rel of Object.keys(filesA).sort()) {
        expect(filesB[rel], rel).toBe(filesA[rel]);
      }
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });
});

