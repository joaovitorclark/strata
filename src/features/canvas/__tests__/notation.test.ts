import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_NOTATION,
  notationStorageKey,
  parseNotation,
  readNotation,
  writeNotation,
} from "@/features/canvas/utils/notation";

describe("S09 notation storage", () => {
  const projectId = "proj-s09";

  afterEach(() => {
    localStorage.removeItem(notationStorageKey(projectId));
  });

  it("defaults to IE and ignores unknown values", () => {
    expect(DEFAULT_NOTATION).toBe("ie");
    expect(parseNotation(null)).toBe("ie");
    expect(parseNotation("crow")).toBe("ie");
    expect(parseNotation("barker")).toBe("barker");
    expect(parseNotation("minimal")).toBe("minimal");
  });

  it("persists per project in localStorage strata.notation.<projectId>", () => {
    expect(readNotation(projectId)).toBe("ie");
    writeNotation(projectId, "barker");
    expect(localStorage.getItem("strata.notation.proj-s09")).toBe("barker");
    expect(readNotation(projectId)).toBe("barker");
  });
});
