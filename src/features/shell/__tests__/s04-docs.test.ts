import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("S04 docs gates", () => {
  it("G8: parity inventory tree click line updated if present; dead-affordances item removed", () => {
    const parity = readFileSync("docs/parity-inventory.md", "utf8");
    const treeClickLines = parity.split("\n").filter((line) => /tree click/i.test(line));
    for (const line of treeClickLines) {
      expect(line).toMatch(/S04/);
    }

    const dead = readFileSync("docs/dead-affordances.md", "utf8");
    expect(dead).not.toMatch(/Schema tree → pan/);
  });
});
