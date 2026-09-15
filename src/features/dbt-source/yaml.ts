import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export function loadYaml(text: string): unknown {
  return parseYaml(text);
}

export function dumpYaml(value: unknown): string {
  return stringifyYaml(value, { lineWidth: 100, aliasDuplicateObjects: false });
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}
