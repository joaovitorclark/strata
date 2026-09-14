import type { ColumnView, ParseResult, TableView } from "@/features/schema/model/parse";
import type { StrataModel } from "./model";

export function toParseResult(model: StrataModel): ParseResult {
  const tables: TableView[] = model.tables
    .filter((t) => !t.external)
    .map((t) => {
      const columns: ColumnView[] = t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        pk: c.pk,
        notNull: c.notNull,
        note: c.note,
        acceptedValues: c.acceptedValues,
        color: c.color ?? model.colors[`${t.id}.${c.name}`],
      }));
      const table: TableView = {
        id: t.id,
        name: t.name,
        schema: t.schema,
        group: t.group,
        note: t.note,
        compositePks: t.compositePks,
        columns,
        resourceType: t.resourceType,
        materialization: t.materialization,
        tags: t.tags,
      };
      return table;
    });

  const localIds = new Set(tables.map((t) => t.id));
  const refs = model.refs
    .filter((r) => localIds.has(r.source) && localIds.has(r.target))
    .map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      label: `${r.fromCol} → ${r.toCol}`,
      fromCol: r.fromCol,
      toCol: r.toCol,
      fromRel: r.fromRel,
      toRel: r.toRel,
    }));

  return {
    tables,
    refs,
    records: model.records,
    layerGroups: model.layerGroups,
    lineageFields: model.lineageFields,
    rolenames: model.rolenames,
    colors: model.colors,
    pins: model.pins,
  };
}
