import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function grepLines(pattern: string, dir: string): string[] {
  try {
    return execFileSync("grep", ["-rn", pattern, dir], { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 1) return [];
    throw err;
  }
}

describe("S10 inspector leftovers", () => {
  it("G9: former column editor in src/features/shell only lives in inspector/LineageSection.tsx", () => {
    const needle = ["Column", "Panel"].join("");
    const hits = grepLines(needle, "src/features/shell");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((line) => line.includes("inspector/LineageSection.tsx"))).toBe(true);
  });
});
