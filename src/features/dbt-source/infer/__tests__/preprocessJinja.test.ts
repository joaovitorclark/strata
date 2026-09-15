import { describe, expect, it } from "vitest";
import { preprocessJinja } from "@/features/dbt-source/infer/preprocessJinja";

describe("S13 G1 preprocessJinja", () => {
  it("replaces ref() with __ref__ identifier", () => {
    const out = preprocessJinja("select * from {{ ref('stg_cliente') }}");
    expect(out.sql).toContain("__ref__stg_cliente");
    expect(out.sql).not.toContain("{{");
    expect(out.hasUnknownMacro).toBe(false);
  });

  it("replaces source() with __src__ identifier", () => {
    const out = preprocessJinja("select * from {{ source('raw', 'alpha') }}");
    expect(out.sql).toContain("__src__raw__alpha");
    expect(out.sql).not.toContain("{{");
    expect(out.hasUnknownMacro).toBe(false);
  });

  it("replaces this with __this__", () => {
    const out = preprocessJinja("select * from {{ this }}");
    expect(out.sql).toContain("__this__");
    expect(out.sql).not.toMatch(/\{\{\s*this\s*\}\}/);
  });

  it("removes config() and records it", () => {
    const out = preprocessJinja("{{ config(materialized='view') }}\nselect 1 as id");
    expect(out.sql).not.toContain("config(");
    expect(out.sql).toContain("select 1 as id");
    expect(out.removals.some((r) => r.kind === "config")).toBe(true);
  });

  it("removes {% if %} control tags and records them", () => {
    const sql = `{% if true %}
select id from {{ ref('x') }}
{% endif %}`;
    const out = preprocessJinja(sql);
    expect(out.sql).not.toMatch(/\{%/);
    expect(out.sql).toContain("__ref__x");
    expect(out.removals.some((r) => r.kind === "control")).toBe(true);
  });

  it("marks unknown macros and keeps inference going", () => {
    const out = preprocessJinja("select {{ some_macro('x') }} as computed from {{ ref('x') }}");
    expect(out.hasUnknownMacro).toBe(true);
    expect(out.sql).toContain("__ref__x");
    expect(out.sql).toMatch(/__jinja_macro_/);
    expect(out.sql).not.toContain("{{");
  });
});
