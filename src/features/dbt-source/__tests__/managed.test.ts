import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyDbtAction } from "@/features/dbt-source/mutations";
import {
  DIVERGENT_MARKERS,
  GITATTRIBUTES_PATH,
  LOCK_PATH,
  STRATA_BEGIN,
  STRATA_END,
  STRATA_MANAGED_TAG,
  inspectManaged,
  sha256Hex,
  type ProjectFiles,
} from "@/features/dbt-source/managed";
import { MANAGED_SQL_HEADER } from "@/features/dbt-source/managedHeader";
import { asArray, asRecord, loadYaml } from "@/features/dbt-source/yaml";
import { regenerate } from "@/features/dbt-source/yamlEdit.managed";
import packageJson from "../../../../package.json";

const PROJECT = "demo";
const TABLE = "main.nova";
const SQL = "models/demo/main/nova.sql";
const YML = "models/demo/main/_nova.yml";

function generate(): ProjectFiles {
  return applyDbtAction({}, PROJECT, { op: "addTable", tableId: TABLE }).files;
}

function modelNode(files: ProjectFiles, ymlPath = YML) {
  const doc = asRecord(loadYaml(files[ymlPath] ?? ""));
  return asRecord(asArray(doc?.models)[0]);
}

function strataOf(files: ProjectFiles, ymlPath = YML) {
  const node = modelNode(files, ymlPath);
  return asRecord(asRecord(asRecord(node?.config)?.meta)?.strata);
}

function tagsOf(files: ProjectFiles, ymlPath = YML): string[] {
  const node = modelNode(files, ymlPath);
  return asArray(asRecord(node?.config)?.tags).map(String);
}

function lockOf(
  files: ProjectFiles,
): Record<string, { sha256?: string; generator_version?: string }> {
  return (asRecord(loadYaml(files[LOCK_PATH] ?? "{}")) ?? {}) as Record<
    string,
    { sha256?: string; generator_version?: string }
  >;
}

describe("D5 managed markers", () => {
  it("G1: generating a managed model writes 5 consistent markers", () => {
    const files = generate();
    const tags = tagsOf(files);
    const strata = strataOf(files);
    const sql = files[SQL] ?? "";
    const attrs = files[GITATTRIBUTES_PATH] ?? "";
    const lock = lockOf(files);

    expect(tags).toContain(STRATA_MANAGED_TAG);
    expect(tags).toContain(`strata:${PROJECT}`);
    expect(strata?.managed).toBe(true);
    expect(strata?.generator).toBe("strata");
    expect(strata?.generator_version).toBe(packageJson.version);
    expect(sql.split("\n")[0]).toBe(MANAGED_SQL_HEADER);
    expect(attrs).toContain(STRATA_BEGIN);
    expect(attrs).toContain(STRATA_END);
    expect(attrs).toContain(`${SQL} linguist-generated=true`);
    expect(lock[SQL]?.sha256).toBe(sha256Hex(sql));
    expect(lock[SQL]?.generator_version).toBe(packageJson.version);
    expect(inspectManaged(files, PROJECT).find((r) => r.sqlPath === SQL)?.status).toBe("managed");
  });

  it("G2: tag removed by hand → manual + marcadores divergentes", () => {
    const files = generate();
    files[YML] = files[YML].replace(new RegExp(`^\\s*- ${STRATA_MANAGED_TAG}\\s*\\n`, "m"), "");
    expect(tagsOf(files)).not.toContain(STRATA_MANAGED_TAG);
    expect(strataOf(files)?.managed).toBe(true);
    const report = inspectManaged(files, PROJECT).find((r) => r.sqlPath === SQL);
    expect(report?.status).toBe("manual");
    expect(report?.problems.some((p) => p.includes(DIVERGENT_MARKERS))).toBe(true);
  });

  it("G3: .sql changed without updating the lock → drift", () => {
    const files = generate();
    files[SQL] = `${files[SQL]}\n-- hand edit\n`;
    const report = inspectManaged(files, PROJECT).find((r) => r.sqlPath === SQL);
    expect(report?.status).toBe("drift");
  });

  it("G4: makeManual removes 4 markers and keeps .sql byte-for-byte", () => {
    const files = generate();
    const sqlBefore = files[SQL];
    const result = applyDbtAction(files, PROJECT, { op: "makeManual", tableId: TABLE });
    expect(result.files[SQL]).toBe(sqlBefore);
    expect(tagsOf(result.files)).not.toContain(STRATA_MANAGED_TAG);
    expect(strataOf(result.files)?.managed).not.toBe(true);
    expect(strataOf(result.files)?.generator).toBeUndefined();
    const attrs = result.files[GITATTRIBUTES_PATH] ?? "";
    expect(attrs).not.toContain(`${SQL} linguist-generated=true`);
    expect(lockOf(result.files)[SQL]).toBeUndefined();
  });

  it("G5: regenerate without confirmation writes nothing", () => {
    const files = generate();
    const snapshot = structuredClone(files);
    const result = regenerate(files, PROJECT, TABLE, { confirmed: false });
    expect(result.files).toBe(files);
    expect(result.changes).toEqual({});
    expect(files).toEqual(snapshot);
  });

  it("G6: user .gitattributes lines outside the strata block stay intact", () => {
    const user = "*.md linguist-documentation=true\nREADME.md export-ignore\n";
    const before: ProjectFiles = {
      [GITATTRIBUTES_PATH]: `${user}${STRATA_BEGIN}\n${STRATA_END}\n`,
    };
    const added = applyDbtAction(before, PROJECT, { op: "addTable", tableId: TABLE });
    expect(added.files[GITATTRIBUTES_PATH]).toContain("*.md linguist-documentation=true");
    expect(added.files[GITATTRIBUTES_PATH]).toContain("README.md export-ignore");
    expect(added.files[GITATTRIBUTES_PATH]).toContain(`${SQL} linguist-generated=true`);
    const removed = applyDbtAction(added.files, PROJECT, { op: "removeTable", tableId: TABLE });
    expect(removed.files[GITATTRIBUTES_PATH]).toContain("*.md linguist-documentation=true");
    expect(removed.files[GITATTRIBUTES_PATH]).toContain("README.md export-ignore");
    expect(removed.files[GITATTRIBUTES_PATH]).not.toContain(`${SQL} linguist-generated=true`);
  });

  it("sha256Hex matches node:crypto", () => {
    const sample = `${MANAGED_SQL_HEADER}\nselect 1 as id\n`;
    expect(sha256Hex(sample)).toBe(createHash("sha256").update(sample, "utf8").digest("hex"));
  });
});
