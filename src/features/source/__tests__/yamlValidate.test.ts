import { describe, expect, it } from "vitest";
import { validateDbtYaml } from "@/features/source/yamlValidate";

const valid = `version: 2
models:
  - name: widget
    columns:
      - name: id
        data_type: bigint
`;

describe("validateDbtYaml", () => {
  it("accepts version + models with named columns", () => {
    expect(validateDbtYaml(valid)).toEqual({ ok: true });
  });

  it("accepts sources instead of models", () => {
    const text = `version: 2
sources:
  - name: raw
    tables:
      - name: events
        columns:
          - name: id
`;
    expect(validateDbtYaml(text)).toEqual({ ok: true });
  });

  it("rejects invalid YAML with a 0-based line", () => {
    const result = validateDbtYaml("version: 2\nmodels: [\n  - broken");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.line).toBeGreaterThanOrEqual(0);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("rejects missing version", () => {
    const result = validateDbtYaml("models:\n  - name: x\n    columns:\n      - name: id\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toMatch(/version/);
  });

  it("rejects missing models and sources", () => {
    const result = validateDbtYaml("version: 2\nseeds: []\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toMatch(/models|sources/);
  });

  it("rejects a column without name", () => {
    const result = validateDbtYaml(`version: 2
models:
  - name: widget
    columns:
      - data_type: int
`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toMatch(/name/);
  });
});
