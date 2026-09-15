import { describe, expect, it } from "vitest";
import { columnNameError } from "@/features/dbt-source/columnName";

describe("columnNameError", () => {
  it("rejects empty, invalid and duplicate names", () => {
    expect(columnNameError("  ", ["id"])).toBe("empty");
    expect(columnNameError("1bad", ["id"])).toBe("invalid");
    expect(columnNameError("id", ["id", "nome"])).toBe("duplicate");
    expect(columnNameError("id", ["id", "nome"], "id")).toBeNull();
    expect(columnNameError("sku_novo", ["id"])).toBeNull();
  });
});
