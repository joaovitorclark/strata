import { describe, expect, it } from "vitest";

import {
  HIDDEN_URL_LIMIT,
  parseUrlState,
  serializeUrlState,
  type UrlState,
} from "@/features/shell/urlState";

function roundTrip(state: UrlState, base = "https://strata.local/workspace"): URL {
  const href = serializeUrlState(state, base);
  return new URL(href, "https://strata.local");
}

function paramsOf(state: UrlState, base?: string): URLSearchParams {
  return roundTrip(state, base).searchParams;
}

describe("urlState", () => {
  it("G1: round-trips six states including special columns, schema ids, and unknown keys", () => {
    const cases: UrlState[] = [
      { project: "proj-1", detail: "keys" },
      { focus: "vendas.pedido", detail: "columns" },
      { project: "p1", focus: "loja.item", col: "nome com espaço" },
      { focus: "public.tabela", col: "ç" },
      { project: "p1", detail: "name" },
      { z: 1.25, x: 10.5, y: -3 },
    ];

    for (const state of cases) {
      const parsed = parseUrlState(roundTrip(state).search);
      expect(parsed.project).toBe(state.project);
      expect(parsed.detail).toBe(state.detail);
      expect(parsed.focus).toBe(state.focus);
      expect(parsed.col).toBe(state.col);
      expect(parsed.z).toBe(state.z);
      expect(parsed.x).toBe(state.x);
      expect(parsed.y).toBe(state.y);
    }

    const withUnknown = serializeUrlState(
      { project: "p1", detail: "name" },
      "https://strata.local/workspace?foo=bar&utm=keep",
    );
    const unknownParams = new URL(withUnknown).searchParams;
    expect(unknownParams.get("foo")).toBe("bar");
    expect(unknownParams.get("utm")).toBe("keep");
    expect(unknownParams.get("project")).toBe("p1");
    expect(parseUrlState(new URL(withUnknown).search).extra).toMatchObject({
      foo: "bar",
      utm: "keep",
    });

    const zxy = paramsOf({ z: 1.25, x: 10.5, y: -3 });
    expect(zxy.get("z")).toBe("1.25");
    expect(zxy.get("x")).toBe("10.50");
    expect(zxy.get("y")).toBe("-3.00");

    const withFocus = paramsOf({ focus: "vendas.pedido", z: 1.25, x: 10, y: 20 });
    expect(withFocus.get("focus")).toBe("vendas.pedido");
    expect(withFocus.has("z")).toBe(false);
    expect(withFocus.has("x")).toBe(false);
    expect(withFocus.has("y")).toBe(false);
  });

  it("G2: invalid detail is absent from parse", () => {
    expect(parseUrlState("?detail=nope").detail).toBeUndefined();
    expect(parseUrlState("?detail=KEYS").detail).toBeUndefined();
    expect(parseUrlState("?detail=columns").detail).toBe("columns");
  });

  it("G3: hidden with 51 ids is not serialized", () => {
    const ids = Array.from({ length: HIDDEN_URL_LIMIT + 1 }, (_, i) => `s.t${i}`);
    const params = paramsOf({ hidden: ids, project: "p1" });
    expect(params.has("hidden")).toBe(false);
    expect(params.get("project")).toBe("p1");

    const fifty = Array.from({ length: HIDDEN_URL_LIMIT }, (_, i) => `s.t${i}`);
    expect(paramsOf({ hidden: fifty }).get("hidden")).toBe(fifty.join(","));
    expect(paramsOf({ hidden: [] }).has("hidden")).toBe(false);
  });

  it("view round-trips and is omitted for Tudo", () => {
    expect(paramsOf({ view: "view_1", project: "p1" }).get("view")).toBe("view_1");
    expect(parseUrlState(roundTrip({ view: "bronze_ingestao" }).search).view).toBe(
      "bronze_ingestao",
    );
    expect(paramsOf({ view: "tudo" }).has("view")).toBe(false);
    expect(parseUrlState("?view=tudo").view).toBeUndefined();
  });
});
