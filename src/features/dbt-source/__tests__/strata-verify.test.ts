import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyDbtAction } from "@/features/dbt-source/mutations";
import { readProjectFiles } from "./gates.test";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../../../");
const KITCHEN = path.join(ROOT, "fixtures/dbt-source/kitchen-sink");
const VERIFY = path.join(ROOT, "scripts/strata-verify.mjs");

function runVerify(dir?: string): { status: number | null; text: string } {
  const env = { ...process.env };
  if (dir) env.STRATA_VERIFY_DIR = dir;
  else delete env.STRATA_VERIFY_DIR;
  try {
    const out = execFileSync(process.execPath, [VERIFY, ...(dir ? [dir] : [])], {
      cwd: ROOT,
      encoding: "utf8",
      env,
    });
    return { status: 0, text: out };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, text: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("D5 G8 strata:verify", () => {
  it("exit 0 on kitchen-sink; exit 1 with model name after drifting a managed .sql", () => {
    const clean = runVerify(KITCHEN);
    expect(clean.status, clean.text).toBe(0);

    const tmp = mkdtempSync(path.join(os.tmpdir(), "strata-d5-verify-"));
    try {
      let files = readProjectFiles(KITCHEN);
      files = applyDbtAction(files, "vendas", { op: "addTable", tableId: "gold.d5_verify" }).files;
      const sqlPath = "models/vendas/gold/d5_verify.sql";
      files[sqlPath] = `${files[sqlPath]}\n-- drifted\n`;
      for (const [rel, content] of Object.entries(files)) {
        const dest = path.join(tmp, rel);
        mkdirSync(path.dirname(dest), { recursive: true });
        writeFileSync(dest, content, "utf8");
      }
      const drifted = runVerify(tmp);
      expect(drifted.status, drifted.text).toBe(1);
      expect(drifted.text).toMatch(/d5_verify/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
