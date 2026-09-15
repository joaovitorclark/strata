import { describe, expect, it } from "vitest";
import { diffFiles, lineDiff } from "@/features/dbt-source/dbtDiff";

describe("dbtDiff", () => {
  it("numbers added and removed lines", () => {
    expect(lineDiff("a\nb\n", "a\nc\n")).toEqual(["2- b", "2+ c"]);
  });

  it("diffFiles skips unchanged paths with empty hunks", () => {
    const hunks = diffFiles({ "a.yml": "name: x\n" }, { "a.yml": "name: y\n" });
    expect(hunks[0]?.path).toBe("a.yml");
    expect(hunks[0]?.lines.some((l) => l.includes("name: y"))).toBe(true);
  });
});
