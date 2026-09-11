import { describe, expect, it } from "vitest";
import {
  HEADER_COLOR_FALLBACK,
  buildNodeExtras,
  hydrateFromProject,
  resolveActivePageIds,
} from "@/features/shell/workspaceModel";
import { ALL_PAGE_ID, PAGE_WIZARD_THRESHOLD } from "@/features/canvas/utils/scaleLimits";
import { parseDbml } from "@/features/schema/model/parse";

describe("workspaceModel", () => {
  it("falls back to a token string, never a new hex", () => {
    expect(HEADER_COLOR_FALLBACK).toBe("hsl(var(--card))");
    expect(HEADER_COLOR_FALLBACK).not.toMatch(/#[0-9a-fA-F]/);
    const parsed = parseDbml(`Table a {
  id int
}
`);
    expect(parsed.tables[0]?.id).toBe("a");
    const extras = buildNodeExtras({
      model: parsed,
      canvasLineage: [],
      colors: {},
      layers: [],
      layerOf: () => undefined,
      externalLinksByTable: new Map(),
    });
    expect(extras.get("a")?.headerColor).toBe(HEADER_COLOR_FALLBACK);
  });

  it("resolveActivePageIds uses ALL_PAGE_ID below the wizard threshold", () => {
    expect(resolveActivePageIds({}, 10)).toEqual([ALL_PAGE_ID]);
    expect(resolveActivePageIds({}, PAGE_WIZARD_THRESHOLD + 1)).toEqual([]);
  });

  it("hydrateFromProject keeps sample dbml when the payload is empty", () => {
    const loaded = hydrateFromProject({ dbml: "", canvas: {} }, "p1");
    expect(loaded.dbml).toContain("Table loja.cliente");
    expect(loaded.projectId).toBe("p1");
  });

  it("hydrateFromProject restores canvas.pinnedByTable", () => {
    const loaded = hydrateFromProject(
      { dbml: "Table a { id int }", canvas: { pinnedByTable: { a: ["id"] } } },
      "p1",
    );
    expect(loaded.pinnedByTable).toEqual({ a: ["id"] });
  });
});
