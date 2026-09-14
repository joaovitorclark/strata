import { describe, expect, it } from "vitest";

import { relationMarkerId } from "@/features/canvas/components/EdgeMarkers";
import type { Cardinality } from "@/features/schema/model/parse";
import type { Notation } from "@/features/canvas/utils/notation";

const cases: Array<[Notation, Cardinality, boolean, string]> = [
  ["ie", "1", false, "ie-one-rest"],
  ["ie", "1", true, "ie-zero-one-rest"],
  ["ie", "*", false, "ie-many-rest"],
  ["ie", "*", true, "ie-zero-many-rest"],
  ["barker", "1", false, "barker-one-rest"],
  ["barker", "1", true, "barker-zero-one-rest"],
  ["barker", "*", false, "barker-many-rest"],
  ["barker", "*", true, "barker-zero-many-rest"],
  ["minimal", "1", false, "minimal-one-rest"],
  ["minimal", "1", true, "minimal-zero-one-rest"],
  ["minimal", "*", false, "minimal-many-rest"],
  ["minimal", "*", true, "minimal-zero-many-rest"],
];

describe("S09 edge markers", () => {
  it("G1: map (notation, cardinality, nullable) → marker id, 12 cases", () => {
    expect(cases).toHaveLength(12);
    for (const [notation, cardinality, nullable, id] of cases) {
      expect(relationMarkerId(notation, cardinality, nullable, false)).toBe(id);
    }
  });
});
