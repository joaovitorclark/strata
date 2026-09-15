import { describe, expect, it } from "vitest";
import * as yamlEdit from "@/features/dbt-source/yamlEdit";
import { readProjectFiles } from "./gates.test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const HAND = path.join(ROOT, "fixtures/dbt-source/handwritten");
const PROJECT = "demo";

describe("D2 G4 renameTable managed vs manual SQL", () => {
  it("updates managed ref() and lineage; leaves manual.sql intact and reports the broken ref", () => {
    const before = readProjectFiles(HAND);
    const result = yamlEdit.renameTable(before, PROJECT, "main.widget", "main.renamed");
    expect(result.files["models/demo/main/gadget.sql"]).toContain("ref('renamed')");
    expect(result.files["models/demo/main/manual.sql"]).toBe(before["models/demo/main/manual.sql"]);
    expect(result.problems?.some((p) => p.includes("manual.sql"))).toBe(true);
    expect(result.files["models/demo/main/_gadget.yml"]).toContain("main.renamed.id");
  });
});

describe("D2 G5 setLayer moves yml+sql with no leftover duplicates", () => {
  it("relocates gadget into silver/ and drops the old paths", () => {
    const result = yamlEdit.setLayer(readProjectFiles(HAND), PROJECT, "main.gadget", "silver");
    expect(result.files["models/demo/silver/_gadget.yml"]).toBeTruthy();
    expect(result.files["models/demo/silver/gadget.sql"]).toBeTruthy();
    expect(result.files["models/demo/main/_gadget.yml"]).toBeUndefined();
    expect(result.files["models/demo/main/gadget.sql"]).toBeUndefined();
    const leftovers = Object.keys(result.files).filter(
      (p) => p.includes("gadget") && p.includes("/main/"),
    );
    expect(leftovers).toEqual([]);
  });
});
