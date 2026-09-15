import { describe, expect, it } from "vitest";
import { parseSelect } from "@/features/dbt-source/infer/parseSelect";

describe("S13 parseSelect", () => {
  it("parses a simple select with mysql fallback", () => {
    const result = parseSelect("select id as customer_id from __src__raw__alpha");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dialect).toBeTruthy();
      expect(result.ast).toBeTruthy();
    }
  });

  it("G5: SQL that fails every dialect returns ok false with error", () => {
    const result = parseSelect("THIS IS NOT VALID SQL {{{");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});
