import type { DbtAction } from "@/features/dbt-source/mutations";
import type { StrataModel, StrataRef, StrataTable } from "@/features/dbt-source/model";

export type DdlDialect = "spark" | "postgres" | "oracle";

export type SourceLoc = { file: string; yamlPath: string };

export type SourceMap = {
  tables: Record<string, SourceLoc>;
  columns: Record<string, SourceLoc>;
};

export type DdlError = {
  kind: "error";
  line: number;
  message: string;
  ops?: never[];
};

export type DdlRenameCandidate = { tableId: string; from: string; to: string };

export type NeedsConfirmation = {
  kind: "needsConfirmation";
  candidates: DdlRenameCandidate[];
  ops?: never[];
};

export type DdlOps = { kind: "ops"; ops: DbtAction[] };

export type DdlOpResult = DdlOps | DdlError | NeedsConfirmation;

export type ConfirmRename = { tableId: string; oldName: string; newName: string };

export type DdlToOpsOptions = { confirmRenames?: ConfirmRename[] };

type ParsedColumn = {
  name: string;
  type: string;
  notNull: boolean;
  comment?: string;
};

type ParsedFk = { fromCol: string; toTable: string; toCol: string };

type ParsedTable = {
  id: string;
  columns: ParsedColumn[];
  pk: string[];
  fks: ParsedFk[];
  comment?: string;
};

const UNSUPPORTED =
  /\bPARTITIONED\s+BY\b|\bTBLPROPERTIES\b|\bCHECK\s*\(|\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i;

function ymlFile(table: StrataTable): string {
  const layer = table.layer ?? "main";
  if (table.kind === "source") return `models/${table.project}/${layer}/_sources.yml`;
  return `models/${table.project}/${layer}/_${table.name}.yml`;
}

function quoteIdent(name: string, dialect: DdlDialect): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return name;
  if (dialect === "spark") return `\`${name.replace(/`/g, "``")}\``;
  return `"${name.replace(/"/g, '""')}"`;
}

function splitTableId(id: string): { schema?: string; name: string } {
  const last = id.lastIndexOf(".");
  if (last <= 0) return { name: id };
  return { schema: id.slice(0, last), name: id.slice(last + 1) };
}

function qualName(id: string, dialect: DdlDialect): string {
  const { schema, name } = splitTableId(id);
  if (!schema) return quoteIdent(name, dialect);
  return `${quoteIdent(schema, dialect)}.${quoteIdent(name, dialect)}`;
}

function emitType(raw: string, dialect: DdlDialect): string {
  const trimmed = raw.trim();
  const m = /^([A-Za-z_][\w$]*)\s*(\(.*\))?$/.exec(trimmed);
  const base = (m?.[1] ?? trimmed).toLowerCase();
  const args = m?.[2] ?? "";
  const spark: Record<string, string> = {
    string: "STRING",
    text: "STRING",
    varchar: "STRING",
    bigint: "BIGINT",
    int: "INT",
    integer: "INT",
    smallint: "SMALLINT",
    decimal: "DECIMAL",
    numeric: "DECIMAL",
    float: "FLOAT",
    double: "DOUBLE",
    boolean: "BOOLEAN",
    bool: "BOOLEAN",
    date: "DATE",
    timestamp: "TIMESTAMP",
    timestamptz: "TIMESTAMP",
    json: "STRING",
    jsonb: "STRING",
  };
  const postgres: Record<string, string> = {
    string: "TEXT",
    text: "TEXT",
    varchar: "VARCHAR",
    bigint: "BIGINT",
    int: "INTEGER",
    integer: "INTEGER",
    smallint: "SMALLINT",
    decimal: "NUMERIC",
    numeric: "NUMERIC",
    float: "DOUBLE PRECISION",
    double: "DOUBLE PRECISION",
    boolean: "BOOLEAN",
    bool: "BOOLEAN",
    date: "DATE",
    timestamp: "TIMESTAMP",
    timestamptz: "TIMESTAMPTZ",
    json: "JSON",
    jsonb: "JSONB",
  };
  const oracle: Record<string, string> = {
    string: "VARCHAR2(4000)",
    text: "CLOB",
    varchar: "VARCHAR2",
    bigint: "NUMBER",
    int: "NUMBER",
    integer: "NUMBER",
    smallint: "NUMBER",
    decimal: "NUMBER",
    numeric: "NUMBER",
    float: "NUMBER",
    double: "NUMBER",
    boolean: "NUMBER(1)",
    bool: "NUMBER(1)",
    date: "DATE",
    timestamp: "TIMESTAMP",
    timestamptz: "TIMESTAMP",
    json: "CLOB",
    jsonb: "CLOB",
  };
  const map = dialect === "spark" ? spark : dialect === "postgres" ? postgres : oracle;
  const mapped = map[base];
  if (mapped) {
    if (args && !mapped.includes("(")) return `${mapped}${args}`;
    return mapped;
  }
  const fallback =
    dialect === "spark" ? "STRING" : dialect === "postgres" ? "TEXT" : "VARCHAR2(4000)";
  return args ? `${fallback}${args}` : fallback;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function refsFor(tableId: string, refs: StrataRef[]): ParsedFk[] {
  return refs
    .filter((r) => r.source === tableId)
    .map((r) => ({ fromCol: r.fromCol, toTable: r.target, toCol: r.toCol }));
}

function pkOf(table: StrataTable): string[] {
  if (table.compositePks?.[0]?.length) return [...table.compositePks[0]];
  return table.columns.filter((c) => c.pk).map((c) => c.name);
}

function columnLine(
  table: StrataTable,
  dialect: DdlDialect,
  col: StrataTable["columns"][number],
): string {
  const type = emitType(col.type, dialect);
  const nn = col.notNull || col.pk ? " NOT NULL" : "";
  const comment = dialect === "spark" && col.note ? ` COMMENT ${sqlString(col.note)}` : "";
  return `  ${quoteIdent(col.name, dialect)} ${type}${nn}${comment}`;
}

function tableToDdl(table: StrataTable, refs: StrataRef[], dialect: DdlDialect): string {
  const qn = qualName(table.id, dialect);
  const pk = pkOf(table);
  const fks = refsFor(table.id, refs);
  const lines = table.columns.map((c) => columnLine(table, dialect, c));
  if (pk.length) {
    lines.push(`  PRIMARY KEY (${pk.map((n) => quoteIdent(n, dialect)).join(", ")})`);
  }
  for (const fk of fks) {
    lines.push(
      `  FOREIGN KEY (${quoteIdent(fk.fromCol, dialect)}) REFERENCES ${qualName(fk.toTable, dialect)} (${quoteIdent(fk.toCol, dialect)})`,
    );
  }
  const body = lines.join(",\n");
  if (dialect === "spark") {
    const tableComment = table.note ? `\nCOMMENT ${sqlString(table.note)}` : "";
    return `CREATE TABLE IF NOT EXISTS ${qn} (\n${body}\n)\nUSING DELTA${tableComment};`;
  }
  const header = `CREATE TABLE ${qn} (\n${body}\n);`;
  const comments: string[] = [];
  if (table.note) comments.push(`COMMENT ON TABLE ${qn} IS ${sqlString(table.note)};`);
  for (const c of table.columns) {
    if (!c.note) continue;
    comments.push(
      `COMMENT ON COLUMN ${qn}.${quoteIdent(c.name, dialect)} IS ${sqlString(c.note)};`,
    );
  }
  return comments.length ? `${header}\n${comments.join("\n")}` : header;
}

export function toDdl(
  model: StrataModel,
  opts: { dialect: DdlDialect; tables?: string[] },
): { text: string; map: SourceMap } {
  const wanted = opts.tables ? new Set(opts.tables) : null;
  const tables = model.tables.filter((t) => !t.external && (!wanted || wanted.has(t.id)));
  const map: SourceMap = { tables: {}, columns: {} };
  const chunks: string[] = [];
  for (const table of tables) {
    const file = ymlFile(table);
    const kind = table.kind === "source" ? "sources" : "models";
    map.tables[table.id] = { file, yamlPath: `${kind}.${table.name}` };
    table.columns.forEach((c, i) => {
      map.columns[`${table.id}.${c.name}`] = {
        file,
        yamlPath: `${kind}.${table.name}.columns[${i}]`,
      };
    });
    chunks.push(tableToDdl(table, model.refs, opts.dialect));
  }
  return { text: chunks.join("\n\n") + (chunks.length ? "\n" : ""), map };
}

function lineOfMatch(text: string, index: number): number {
  if (index < 0) return 1;
  return text.slice(0, index).split("\n").length;
}

function findUnsupported(sql: string): DdlError | null {
  const m = UNSUPPORTED.exec(sql);
  if (!m || m.index == null) return null;
  return {
    kind: "error",
    line: lineOfMatch(sql, m.index),
    message: `${m[0].trim()} is not represented in the DDL projection — edit it in the dbt tab`,
  };
}

function unquote(raw: string): string {
  const t = raw.trim();
  if ((t.startsWith("`") && t.endsWith("`")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1).replace(/``/g, "`").replace(/""/g, '"');
  }
  return t;
}

function normalizeType(raw: string): string {
  return unquote(raw.trim().replace(/\s+/g, " ")).toLowerCase();
}

function splitQualified(raw: string): string {
  return raw
    .split(".")
    .map((p) => unquote(p))
    .join(".");
}

function splitTopLevel(sql: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      cur += ch;
      if (ch === quote) {
        if (sql[i + 1] === quote) {
          cur += sql[++i];
          continue;
        }
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && sql.startsWith(sep, i)) {
      out.push(cur);
      cur = "";
      i += sep.length - 1;
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseCommentLiteral(raw: string): string | undefined {
  const m = /COMMENT\s+(?:ON\s+\w+\s+[^\s]+\s+IS\s+)?('(?:''|[^'])*'|"(?:""|[^"])*")/i.exec(raw);
  if (!m) return undefined;
  const q = m[1];
  if (q.startsWith("'")) return q.slice(1, -1).replace(/''/g, "'");
  return q.slice(1, -1).replace(/""/g, '"');
}

function parseColumnDef(raw: string): ParsedColumn | null {
  const text = raw.trim();
  if (!text || /^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE)\b/i.test(text)) return null;
  const ident = /^(?:`[^`]+`|"[^"]+"|[A-Za-z_][\w$]*)/.exec(text);
  if (!ident) return null;
  const name = unquote(ident[0]);
  let rest = text.slice(ident[0].length).trim();
  const notNull = /\bNOT\s+NULL\b/i.test(rest);
  const comment = parseCommentLiteral(rest);
  rest = rest
    .replace(/\bNOT\s+NULL\b/gi, " ")
    .replace(/\bNULL\b/gi, " ")
    .replace(/\bCOMMENT\s+(?:'((?:''|[^'])*)'|"((?:""|[^"])*)")/gi, " ")
    .replace(/\bPRIMARY\s+KEY\b/gi, " ")
    .replace(/\bUNIQUE\b/gi, " ")
    .replace(/\bDEFAULT\s+\S+/gi, " ")
    .trim();
  const type = normalizeType(rest);
  if (!type) return null;
  return { name, type, notNull, comment };
}

function parseConstraint(raw: string): { pk?: string[]; fk?: ParsedFk } | null {
  const text = raw.trim().replace(/^CONSTRAINT\s+(?:`[^`]+`|"[^"]+"|\w+)\s+/i, "");
  const pk = /^PRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(text);
  if (pk) {
    return {
      pk: pk[1]
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter(Boolean),
    };
  }
  const fk = /^FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+([^\s(]+)\s*\(([^)]*)\)/i.exec(text);
  if (fk) {
    return {
      fk: {
        fromCol: unquote(fk[1].trim()),
        toTable: splitQualified(fk[2]),
        toCol: unquote(fk[3].trim()),
      },
    };
  }
  return null;
}

function parseCreateTable(stmt: string): ParsedTable | null {
  const src = stmt.trim().replace(/;+\s*$/, "");
  const head = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i.exec(src);
  if (!head) return null;
  let i = head[0].length;
  while (i < src.length && /\s/.test(src[i])) i++;
  const nameStart = i;
  while (i < src.length && src[i] !== "(" && !/\s/.test(src[i])) i++;
  const id = splitQualified(src.slice(nameStart, i));
  while (i < src.length && src[i] !== "(") i++;
  if (src[i] !== "(") return null;
  const bodyStart = i + 1;
  let depth = 1;
  let quote: string | null = null;
  i++;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) {
        if (src[i + 1] === quote) {
          i++;
          continue;
        }
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return null;
  const body = src.slice(bodyStart, i);
  const tail = src.slice(i + 1);
  const tableComment = parseCommentLiteral(tail);
  const table: ParsedTable = { id, columns: [], pk: [], fks: [] };
  if (tableComment) table.comment = tableComment;
  for (const part of splitTopLevel(body, ",")) {
    const cons = parseConstraint(part);
    if (cons?.pk) {
      table.pk.push(...cons.pk);
      continue;
    }
    if (cons?.fk) {
      table.fks.push(cons.fk);
      continue;
    }
    const col = parseColumnDef(part);
    if (col) {
      table.columns.push(col);
      if (/\bPRIMARY\s+KEY\b/i.test(part) && !table.pk.includes(col.name)) {
        table.pk.push(col.name);
      }
    }
  }
  return table;
}

function applyCommentOn(sql: string, tables: Map<string, ParsedTable>): void {
  const re = /COMMENT\s+ON\s+(TABLE|COLUMN)\s+([^\s]+)\s+IS\s+('(?:''|[^'])*'|"(?:""|[^"])*")/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const kind = m[1].toLowerCase();
    const target = splitQualified(m[2]);
    const value = m[3].startsWith("'")
      ? m[3].slice(1, -1).replace(/''/g, "'")
      : m[3].slice(1, -1).replace(/""/g, '"');
    if (kind === "table") {
      const table = tables.get(target);
      if (table) table.comment = value;
      continue;
    }
    const last = target.lastIndexOf(".");
    if (last <= 0) continue;
    const tableId = target.slice(0, last);
    const colName = target.slice(last + 1);
    const table = tables.get(tableId);
    const col = table?.columns.find((c) => c.name === colName);
    if (col) col.comment = value;
  }
}

function parseDdl(sql: string): Map<string, ParsedTable> {
  const tables = new Map<string, ParsedTable>();
  for (const stmt of splitTopLevel(sql, ";")) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    if (/^CREATE\s+TABLE\b/i.test(trimmed)) {
      const table = parseCreateTable(trimmed);
      if (table) tables.set(table.id, table);
    }
  }
  applyCommentOn(sql, tables);
  return tables;
}

function typesEqual(a: string, b: string): boolean {
  const norm = (t: string) =>
    t
      .replace(/\binteger\b/g, "int")
      .replace(/\bstring\b/g, "string")
      .replace(/\btext\b/g, "string")
      .replace(/\bvarchar2\s*\(\s*4000\s*\)/g, "string")
      .replace(/\bvarchar\b/g, "string");
  return norm(a) === norm(b);
}

function fkKey(fk: ParsedFk): string {
  return `${fk.fromCol}>${fk.toTable}.${fk.toCol}`;
}

function diffTable(
  tableId: string,
  before: ParsedTable,
  after: ParsedTable,
  confirm: ConfirmRename[] | undefined,
): DbtAction[] | NeedsConfirmation {
  const ops: DbtAction[] = [];
  const beforeByName = new Map(before.columns.map((c) => [c.name, c]));
  const afterByName = new Map(after.columns.map((c) => [c.name, c]));
  const matchedBefore = new Set<string>();
  const matchedAfter = new Set<string>();

  const confirmFor = (confirm ?? []).filter((c) => c.tableId === tableId);
  for (const c of confirmFor) {
    if (beforeByName.has(c.oldName) && afterByName.has(c.newName)) {
      matchedBefore.add(c.oldName);
      matchedAfter.add(c.newName);
      ops.push({
        op: "renameColumn",
        tableId,
        oldName: c.oldName,
        newName: c.newName,
      });
    }
  }

  for (const col of after.columns) {
    if (matchedAfter.has(col.name)) continue;
    const prev = beforeByName.get(col.name);
    if (!prev) continue;
    matchedBefore.add(col.name);
    matchedAfter.add(col.name);
    if (!typesEqual(prev.type, col.type)) {
      ops.push({ op: "setColumnType", tableId, column: col.name, dataType: col.type });
    }
    if (prev.notNull !== col.notNull) {
      ops.push({ op: "setNotNull", tableId, column: col.name, value: col.notNull });
    }
    if ((prev.comment ?? "") !== (col.comment ?? "")) {
      ops.push({
        op: "setDescription",
        tableId,
        column: col.name,
        description: col.comment ?? "",
      });
    }
  }

  const leftoverBefore = before.columns.filter((c) => !matchedBefore.has(c.name));
  const leftoverAfter = after.columns.filter((c) => !matchedAfter.has(c.name));
  const renamePairs: Array<{ from: string; to: string }> = [];
  const remB = leftoverBefore.slice();
  const remA = leftoverAfter.slice();

  const uniqueTypePairing =
    remB.length === remA.length &&
    remB.length > 0 &&
    remB.every((b) => remB.filter((x) => typesEqual(x.type, b.type)).length === 1) &&
    remA.every((a) => remB.some((b) => typesEqual(b.type, a.type)));

  if (remB.length === 1 && remA.length === 1 && typesEqual(remB[0].type, remA[0].type)) {
    renamePairs.push({ from: remB[0].name, to: remA[0].name });
    remB.length = 0;
    remA.length = 0;
  } else if (uniqueTypePairing) {
    for (const b of remB) {
      const a = remA.find((x) => typesEqual(x.type, b.type));
      if (a) renamePairs.push({ from: b.name, to: a.name });
    }
    remB.length = 0;
    remA.length = 0;
  } else if (remB.length > 0 && remA.length > 0) {
    const candidates: DdlRenameCandidate[] = [];
    for (const b of remB) {
      for (const a of remA) {
        if (typesEqual(a.type, b.type)) candidates.push({ tableId, from: b.name, to: a.name });
      }
    }
    if (candidates.length > 0 && !confirmFor.length) {
      return { kind: "needsConfirmation", candidates };
    }
  }

  for (const pair of renamePairs) {
    if (!ops.some((o) => o.op === "renameColumn" && o.oldName === pair.from)) {
      ops.push({
        op: "renameColumn",
        tableId,
        oldName: pair.from,
        newName: pair.to,
      });
    }
    const prev = beforeByName.get(pair.from);
    const next = afterByName.get(pair.to);
    if (prev && next) {
      if (!typesEqual(prev.type, next.type)) {
        ops.push({ op: "setColumnType", tableId, column: pair.to, dataType: next.type });
      }
      if (prev.notNull !== next.notNull) {
        ops.push({ op: "setNotNull", tableId, column: pair.to, value: next.notNull });
      }
    }
  }

  if (remB.length && remA.length === 0) {
    for (const b of remB) ops.push({ op: "removeColumn", tableId, column: b.name });
  }
  if (remA.length && remB.length === 0) {
    for (const a of remA) ops.push({ op: "addColumn", tableId, name: a.name, dataType: a.type });
  }

  const beforePk = new Set(before.pk);
  const afterPk = new Set(after.pk);
  const renamed = new Map(renamePairs.map((p) => [p.from, p.to]));
  for (const col of afterPk) {
    const oldName =
      [...renamed.entries()].find(([, to]) => to === col)?.[0] ??
      (beforePk.has(col) ? col : undefined);
    if (oldName && beforePk.has(oldName) && renamed.get(oldName) === col) {
      // pk moved with rename
    } else if (!beforePk.has(col) && !beforePk.has(oldName ?? "")) {
      ops.push({ op: "setPrimaryKey", tableId, column: col, value: true });
    }
  }
  for (const col of beforePk) {
    const mapped = renamed.get(col) ?? col;
    if (!afterPk.has(mapped) && !afterPk.has(col)) {
      ops.push({ op: "setPrimaryKey", tableId, column: col, value: false });
    }
  }

  const beforeFks = new Set(before.fks.map(fkKey));
  const afterFks = new Set(after.fks.map(fkKey));
  for (const fk of after.fks) {
    if (!beforeFks.has(fkKey(fk))) {
      ops.push({
        op: "addRef",
        fromTable: tableId,
        fromCol: fk.fromCol,
        toTable: fk.toTable,
        toCol: fk.toCol,
      });
    }
  }
  for (const fk of before.fks) {
    if (!afterFks.has(fkKey(fk))) {
      ops.push({
        op: "removeRef",
        fromTable: tableId,
        fromCol: fk.fromCol,
        toTable: fk.toTable,
        toCol: fk.toCol,
      });
    }
  }

  if ((before.comment ?? "") !== (after.comment ?? "")) {
    ops.push({ op: "setDescription", tableId, description: after.comment ?? "" });
  }

  return ops;
}

export function ddlToOperations(
  before: string,
  after: string,
  _model: StrataModel,
  _dialect: DdlDialect,
  opts?: DdlToOpsOptions,
): DdlOpResult {
  const unsupported = findUnsupported(after);
  if (unsupported) {
    const was = findUnsupported(before);
    if (
      !was ||
      was.line !== unsupported.line ||
      !before.includes(UNSUPPORTED.exec(after)?.[0] ?? "\0")
    ) {
      // New unsupported clause in the edited text.
      const added = !UNSUPPORTED.test(before);
      if (added) return unsupported;
    }
  }
  if (UNSUPPORTED.test(after) && !UNSUPPORTED.test(before)) return findUnsupported(after)!;

  const beforeTables = parseDdl(before);
  const afterTables = parseDdl(after);
  const ops: DbtAction[] = [];

  for (const id of afterTables.keys()) {
    if (!beforeTables.has(id)) ops.push({ op: "addTable", tableId: id });
  }
  for (const id of beforeTables.keys()) {
    if (!afterTables.has(id)) ops.push({ op: "removeTable", tableId: id });
  }

  for (const [id, afterTable] of afterTables) {
    const beforeTable = beforeTables.get(id);
    if (!beforeTable) continue;
    const diff = diffTable(id, beforeTable, afterTable, opts?.confirmRenames);
    if (!Array.isArray(diff)) return diff;
    ops.push(...diff);
  }

  return { kind: "ops", ops };
}
