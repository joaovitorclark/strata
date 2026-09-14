import { serializeViewsBlock } from "@/features/schema/model/views";
import type { StrataModel, StrataTable } from "./model";

function ident(name: string): string {
  return /[^A-Za-z0-9_]/.test(name) ? `"${name.replace(/"/g, "")}"` : name;
}

function tableStub(table: StrataTable): string {
  const cols = table.columns.map((c) => {
    const flags: string[] = [];
    if (c.pk) flags.push("pk");
    if (c.notNull) flags.push("not null");
    if (c.unique) flags.push("unique");
    const suffix = flags.length ? ` [${flags.join(", ")}]` : "";
    return `  ${ident(c.name)} ${c.type}${suffix}`;
  });
  return `Table ${table.id} {\n${cols.join("\n")}\n}`;
}

/** DBML de exibição para views/pins/cores e parseDbml auxiliar. O canvas usa toParseResult. */
export function toDisplayDbml(model: StrataModel): string {
  const parts: string[] = [];
  const local = model.tables.filter((t) => !t.external);

  for (const g of model.layerGroups) {
    const body = g.tables.map((id) => `  ${id}`).join("\n");
    parts.push(`LayerGroup ${g.name} {\n${body}\n}`);
  }

  const groups = new Map<string, string[]>();
  for (const t of local) {
    if (!t.group) continue;
    const list = groups.get(t.group) ?? [];
    list.push(t.id);
    groups.set(t.group, list);
  }
  for (const [name, ids] of groups) {
    parts.push(`TableGroup ${name} {\n${ids.map((id) => `  ${id}`).join("\n")}\n}`);
  }

  for (const t of local) parts.push(tableStub(t));

  for (const r of model.refs) {
    parts.push(`Ref: ${r.source}.${ident(r.fromCol)} > ${r.target}.${ident(r.toCol)}`);
  }

  if (model.lineageFields.length) {
    const lines = model.lineageFields.map(
      (l) =>
        `  ${l.targetTable}.${ident(l.targetColumn)} < ${l.sourceTable}.${ident(l.sourceColumn)}`,
    );
    parts.push(`LineageFields {\n${lines.join("\n")}\n}`);
  }

  if (model.rolenames.length) {
    const lines = model.rolenames.map(
      (r) =>
        `  ${r.child.table}.${ident(r.child.column)} < ${r.parent.table}.${ident(r.parent.column)}`,
    );
    parts.push(`Rolenames {\n${lines.join("\n")}\n}`);
  }

  const colorLines = Object.entries(model.colors).map(([k, v]) => `  ${k}: ${v}`);
  if (colorLines.length) parts.push(`Colors {\n${colorLines.join("\n")}\n}`);

  if (model.pins.length) {
    parts.push(`Pins {\n${model.pins.map((p) => `  ${p}`).join("\n")}\n}`);
  }

  const views = serializeViewsBlock(model.views);
  if (views.trim()) parts.push(views.trimEnd());

  return `${parts.filter(Boolean).join("\n\n")}\n`;
}
