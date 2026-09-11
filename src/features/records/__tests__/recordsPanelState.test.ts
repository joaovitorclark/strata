import { describe, expect, it } from "vitest";
import { parseRecordsOpen } from "@/features/records/utils/recordsPanelState";

describe("parseRecordsOpen", () => {
  it('fechado por default; aberto só quando persistido "1"', () => {
    expect(parseRecordsOpen(null)).toBe(false);
    expect(parseRecordsOpen("0")).toBe(false);
    expect(parseRecordsOpen("1")).toBe(true);
  });
});
