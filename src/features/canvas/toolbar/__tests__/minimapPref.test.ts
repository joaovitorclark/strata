import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MINIMAP_AUTO_ON_TABLES,
  MINIMAP_STORAGE_KEY,
  minimapLayerColor,
  readMinimapVisible,
  writeMinimapPref,
} from "../minimapPref";

describe("S12 minimap preference", () => {
  afterEach(() => {
    localStorage.removeItem(MINIMAP_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it("defaults off at 40 tables and on strictly above 40", () => {
    expect(MINIMAP_AUTO_ON_TABLES).toBe(40);
    expect(readMinimapVisible(0)).toBe(false);
    expect(readMinimapVisible(40)).toBe(false);
    expect(readMinimapVisible(41)).toBe(true);
  });

  it("localStorage strata.minimap wins over the table-count default", () => {
    writeMinimapPref(true);
    expect(localStorage.getItem(MINIMAP_STORAGE_KEY)).toBe("1");
    expect(readMinimapVisible(2)).toBe(true);
    writeMinimapPref(false);
    expect(localStorage.getItem(MINIMAP_STORAGE_KEY)).toBe("0");
    expect(readMinimapVisible(200)).toBe(false);
  });

  it("falls back to the table-count default when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readMinimapVisible(50)).toBe(true);
    expect(readMinimapVisible(1)).toBe(false);
  });

  it("colors minimap nodes with --layer-* tokens only", () => {
    expect(minimapLayerColor("bronze")).toBe("hsl(var(--layer-bronze))");
    expect(minimapLayerColor("prata")).toBe("hsl(var(--layer-silver))");
    expect(minimapLayerColor("silver")).toBe("hsl(var(--layer-silver))");
    expect(minimapLayerColor("ouro")).toBe("hsl(var(--layer-gold))");
    expect(minimapLayerColor("gold")).toBe("hsl(var(--layer-gold))");
    expect(minimapLayerColor(undefined)).toBe("hsl(var(--layer-raw))");
    expect(minimapLayerColor("bronze")).not.toMatch(/#/);
  });
});
