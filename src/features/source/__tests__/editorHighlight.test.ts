import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TOKENS = [
  "--syn-keyword",
  "--syn-string",
  "--syn-number",
  "--syn-type",
  "--syn-operator",
  "--syn-punct",
  "--syn-comment",
  "--syn-line-active",
  "--syn-gutter",
] as const;

describe("editorHighlight", () => {
  it("uses every --syn-* token at least once", () => {
    const src = readFileSync("src/features/source/editorHighlight.ts", "utf8");
    for (const token of TOKENS) {
      expect(src.includes(token), token).toBe(true);
    }
  });
});
