import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { isSpacePanIgnored } from "@/features/canvas/components/Canvas";

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

describe("S03 gates", () => {
  it("G7: grep -n zoomPercent src/features/shell → 0", () => {
    expect(grepLines("zoomPercent", "src/features/shell")).toEqual([]);
  });

  it("G8: Space guard ignores events from input and textarea", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const div = document.createElement("div");
    expect(isSpacePanIgnored({ target: input })).toBe(true);
    expect(isSpacePanIgnored({ target: textarea })).toBe(true);
    expect(isSpacePanIgnored({ target: div })).toBe(false);
  });
});
