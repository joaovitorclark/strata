import { describe, expect, it } from "vitest";
import i18n from "@/i18n";

describe("i18n", () => {
  it("falls back to pt-BR, not en", () => {
    expect(i18n.options.fallbackLng).toEqual(["pt-BR"]);
  });

  it("resolves a key in both locales", () => {
    expect(i18n.t("theme.dark")).toBe("Escuro");
    expect(i18n.getFixedT("en")("theme.dark")).toBe("Dark");
  });
});
