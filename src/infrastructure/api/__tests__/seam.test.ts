import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

describe("api seam", () => {
  it("is the only place that calls fetch", () => {
    const offenders = walk("src")
      .filter((p) => !p.startsWith(join("src", "infrastructure", "api")))
      .filter((p) => /\bfetch\s*\(/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });
});
