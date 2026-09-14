import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function grepCount(pattern: string, file: string): number {
  try {
    return Number(execFileSync("grep", ["-c", pattern, file], { encoding: "utf8" }).trim());
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 1) return 0;
    throw err;
  }
}

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

function isRemovalTestPath(path: string): boolean {
  return (
    path.includes("__tests__/") || /\.test\.[jt]sx?$/.test(path) || /\.spec\.[jt]sx?$/.test(path)
  );
}

describe("S02 frame chrome gates", () => {
  it("G1: Workspace.tsx has zero absolute overlays", () => {
    expect(grepCount("absolute", "src/features/shell/Workspace.tsx")).toBe(0);
  });

  it("G2: DraggableOverlay and EditorChrome are gone from src/ outside removal tests", () => {
    const hits = grepLines("DraggableOverlay\\|EditorChrome", "src").filter((line) => {
      const path = line.split(":")[0] ?? "";
      return !isRemovalTestPath(path);
    });
    expect(hits).toEqual([]);
  });
});
