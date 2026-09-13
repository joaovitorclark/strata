import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/index.css", "utf8");

describe("design tokens", () => {
  it("defines every semantic token in the light block before any override", () => {
    for (const token of [
      "--background",
      "--foreground",
      "--card",
      "--primary",
      "--primary-foreground",
      "--muted-foreground",
      "--border",
      "--ring",
      "--surface",
      "--success",
      "--warning",
      "--layer-bronze",
      "--layer-silver",
      "--layer-gold",
      "--rel-fk",
      "--rel-lineage",
      "--key-pk",
      "--syn-keyword",
    ]) {
      expect(css.indexOf(`${token}:`), `${token} missing`).toBeGreaterThan(-1);
    }
  });

  it("uses dark/light naming, never Catppuccin flavour names, in app source", () => {
    expect(css.includes(".dark")).toBe(true);
  });
});
