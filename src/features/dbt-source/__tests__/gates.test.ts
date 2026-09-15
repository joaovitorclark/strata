import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDbml, type ParseResult } from "@/features/schema/model/parse";
import {
  filterProject,
  fromDbml,
  fromDbtProject,
  toDbtProject,
  toParseResult,
  type ProjectFiles,
  type StrataModel,
} from "@/features/dbt-source";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const DBML_PATH = path.join(ROOT, "fixtures/dbt-source/kitchen-sink.dbml");
const DBT_DIR = path.join(ROOT, "fixtures/dbt-source/kitchen-sink");

export function readProjectFiles(root: string): ProjectFiles {
  const files: ProjectFiles = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
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

function sortBy<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}

function dropUndef<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
    colors: model.colors,
    pins: [...(model.pins ?? [])].sort(),
    views: sortBy(model.views, (v) => v.id),
    enums: sortBy(model.enums, (e) => e.name),
  });
}

function parseSubset(parsed: ParseResult) {
  return dropUndef({
    tables: sortBy(parsed.tables, (t) => t.id).map((t) => ({
      id: t.id,
      name: t.name,
      schema: t.schema,
      group: t.group,
      note: t.note,
      compositePks: t.compositePks,
      columns: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        pk: c.pk,
        notNull: c.notNull,
        note: c.note,
        acceptedValues: c.acceptedValues,
      })),
    })),
    refs: sortBy(parsed.refs, (r) => r.id).map((r) => ({
      source: r.source,
      target: r.target,
      fromCol: r.fromCol,
      toCol: r.toCol,
    })),
    notes: sortBy(
      parsed.tables.filter((t) => t.note).map((t) => ({ id: t.id, note: t.note })),
      (t) => t.id,
    ),
    lineageFields: sortBy(
      parsed.lineageFields,
      (l) => `${l.targetTable}.${l.targetColumn}<${l.sourceTable}.${l.sourceColumn}`,
    ),
    layers: sortBy(
      parsed.layerGroups.map((g) => ({ id: g.id, name: g.name, tables: [...g.tables].sort() })),
      (g) => g.id,
    ),
    groups: Object.fromEntries(
      sortBy(
        parsed.tables.filter((t) => t.group).map((t) => [t.id, t.group] as const),
        ([id]) => id,
      ),
    ),
  });
}

const kitchenSinkDbml = readFileSync(DBML_PATH, "utf8");

describe("D1 dbt-source gates", () => {
  it("G1: fromDbtProject(kitchen-sink, vendas) ≡ fromDbml filtrado para vendas", () => {
    const fromText = filterProject(fromDbml(kitchenSinkDbml), "vendas");
    const files = readProjectFiles(DBT_DIR);
    const fromDbt = fromDbtProject(files, "vendas");
    // Expected differences (justified):
    // 1. records[].raw — DBML keeps the original Records block; dbt rebuilds from CSV.
    //    Dropped in normalizeModel.
    // 2. canvas positions — fromDbml has none; kitchen-sink .strata may hold view coords
    //    in views.yml (compared via views) and empty canvas.yml. Not part of normalizeModel.
    expect(normalizeModel(fromDbt)).toEqual(normalizeModel(fromText));
  });

  it("G2: toParseResult ≡ parseDbml for tables, columns, types, pks, refs, notes, lineage, layers, groups", () => {
    const model = fromDbml(kitchenSinkDbml);
    expect(parseSubset(toParseResult(model))).toEqual(parseSubset(parseDbml(kitchenSinkDbml)));
  });

  it("G3: fromDbtProject(toDbtProject(m)) ≡ m", () => {
    const original = filterProject(fromDbml(kitchenSinkDbml), "vendas");
    const files = toDbtProject(original, "vendas");
    const roundTrip = fromDbtProject(files, "vendas");
    expect(normalizeModel(roundTrip)).toEqual(normalizeModel(original));
  });

  it("G4: nothing visual outside .strata/; nothing semantic inside .strata/", () => {
    const model = filterProject(fromDbml(kitchenSinkDbml), "vendas");
    const files = toDbtProject(model, "vendas");
    const visualKey = /(?:^|\n)\s*(positions|collapsedGroups|pins|views):/;
    const semanticKey = /(?:^|\n)\s*(data_type|primary_key|not_null|lineage|accepted_values):/;
    for (const [filePath, content] of Object.entries(files)) {
      if (filePath.startsWith(".strata/")) {
        expect(content, filePath).not.toMatch(semanticKey);
      } else if (!filePath.endsWith(".csv") && !filePath.endsWith(".sql")) {
        expect(content, filePath).not.toMatch(visualKey);
      }
    }
  });

  it("G5: enum name, composite index order, Records CSV with non-ASCII and commas", () => {
    const model = filterProject(fromDbml(kitchenSinkDbml), "vendas");
    const dim = model.tables.find((t) => t.id === "gold.dim_cliente");
    expect(dim?.columns.find((c) => c.name === "status")?.enumName).toBe("order_status");
    const idx = dim?.indexes?.find((i) => i.columns.length > 1);
    expect(idx?.columns).toEqual(["email", "nome"]);

    const files = toDbtProject(model, "vendas");
    const seed = Object.entries(files).find(
      ([p]) => p.startsWith("seeds/vendas/") && p.endsWith(".csv"),
    );
    expect(seed, "seed csv").toBeTruthy();
    const csv = seed![1];
    expect(csv).toContain("José, o Bravo");
    expect(csv).toMatch(/"[^"]*José, o Bravo[^"]*"/);

    const back = fromDbtProject(files, "vendas");
    const rec = back.records.find((r) => r.table === "gold.dim_cliente");
    expect(rec?.rows).toEqual(model.records.find((r) => r.table === "gold.dim_cliente")?.rows);
    expect(
      back.tables.find((t) => t.id === "gold.dim_cliente")?.columns.find((c) => c.name === "status")
        ?.enumName,
    ).toBe("order_status");
    expect(back.tables.find((t) => t.id === "gold.dim_cliente")?.indexes?.[0]?.columns).toEqual([
      "email",
      "nome",
    ]);
  });

  it("G6: ref() estoque→vendas becomes an external table, not an error", () => {
    const domain: ProjectFiles = {
      ...toDbtProject(filterProject(fromDbml(kitchenSinkDbml), "vendas"), "vendas"),
      ...toDbtProject(filterProject(fromDbml(kitchenSinkDbml), "estoque"), "estoque"),
    };
    const estoque = fromDbtProject(domain, "estoque");
    expect(estoque.tables.some((t) => t.id === "estoque.posicao" && !t.external)).toBe(true);
    const remote = estoque.tables.find((t) => t.id === "gold.fato_pedido");
    expect(remote?.external).toBe(true);
    expect(remote?.externalProject).toBe("vendas");
    expect((estoque as StrataModel & { error?: string }).error).toBeUndefined();
  });

  it("G7: sources-only project: PK/FK/not null from tests; lineage between sources", () => {
    const files = toDbtProject(filterProject(fromDbml(kitchenSinkDbml), "catalogo"), "catalogo");
    const catalogo = fromDbtProject(files, "catalogo");
    expect(catalogo.tables.every((t) => t.kind === "source" || t.external)).toBe(true);
    const categoria = catalogo.tables.find((t) => t.id === "catalog.categoria");
    const produto = catalogo.tables.find((t) => t.id === "catalog.produto");
    expect(categoria?.columns.find((c) => c.name === "id")?.pk).toBe(true);
    expect(produto?.columns.find((c) => c.name === "sku")?.unique).toBe(true);
    expect(produto?.columns.find((c) => c.name === "categoria_id")?.notNull).toBe(true);
    expect(
      catalogo.refs.some((r) => r.source === "catalog.produto" && r.target === "catalog.categoria"),
    ).toBe(true);
    expect(
      catalogo.lineageFields.some(
        (l) =>
          l.targetTable === "catalog.produto" &&
          l.targetColumn === "categoria_id" &&
          l.sourceTable === "catalog.categoria",
      ),
    ).toBe(true);
  });
});
