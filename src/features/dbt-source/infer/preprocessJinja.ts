export type JinjaRemoval = { kind: "config" | "control"; text: string };

export type PreprocessResult = {
  sql: string;
  removals: JinjaRemoval[];
  hasUnknownMacro: boolean;
};

const REF_RE = /\{\{\s*ref\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;
const SOURCE_RE = /\{\{\s*source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g;
const THIS_RE = /\{\{\s*this\s*\}\}/g;
const CONTROL_RE = /\{%[\s\S]*?%\}/g;

function findConfigSpans(sql: string): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  const startRe = /\{\{\s*config\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(sql))) {
    const open = m.index;
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      i += 1;
    }
    while (i < sql.length && sql[i] !== "}") i += 1;
    if (sql[i] === "}" && sql[i + 1] === "}") i += 2;
    out.push({ start: open, end: i, text: sql.slice(open, i) });
  }
  return out;
}

export function preprocessJinja(sql: string): PreprocessResult {
  const removals: JinjaRemoval[] = [];
  let next = sql;
  const configs = findConfigSpans(next);
  for (const span of configs.reverse()) {
    removals.push({ kind: "config", text: span.text });
    next = next.slice(0, span.start) + next.slice(span.end);
  }
  next = next.replace(CONTROL_RE, (text) => {
    removals.push({ kind: "control", text });
    return " ";
  });
  next = next.replace(REF_RE, (_all, name: string) => `__ref__${name}`);
  next = next.replace(
    SOURCE_RE,
    (_all, source: string, table: string) => `__src__${source}__${table}`,
  );
  next = next.replace(THIS_RE, "__this__");
  let hasUnknownMacro = false;
  let macroIndex = 0;
  next = next.replace(/\{\{[\s\S]*?\}\}/g, () => {
    hasUnknownMacro = true;
    const token = `__jinja_macro_${macroIndex}__`;
    macroIndex += 1;
    return token;
  });
  return { sql: next, removals, hasUnknownMacro };
}
