import type { CanvasActions } from "@/features/canvas/actions";
import type { ParsedFieldLineage, TableView } from "@/features/schema/model/parse";

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type MappingKey = {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
};

export type InspectorProps = {
  tableMeta: CanvasActions["tableMeta"];
  layerOf: CanvasActions["layerOf"];
  colorOf: CanvasActions["colorOf"];
  onSetColor: CanvasActions["onSetColor"];
  layers: CanvasActions["layers"];
  tables: TableView[];
  dbml?: string;
  onApply?: (next: string) => void;
  lineageFields?: ParsedFieldLineage[];
  problemCount?: number;
  onFocusTable?: (tableId: string) => void;
  onSetLayer?: CanvasActions["onSetLayer"];
  onRenameTable?: CanvasActions["onRenameTable"];
  onRenameColumn?: CanvasActions["onRenameColumn"];
  onRemoveTables?: (ids: string[]) => void;
  onGoToColumn?: (table: string, column: string) => void;
  onAddMapping?: (
    sourceTable: string,
    sourceColumn: string,
    targetColumn: string,
    note?: string,
    ref?: string,
  ) => void;
  onUpdateMapping?: (
    prev: MappingKey,
    next: {
      sourceTable: string;
      sourceColumn: string;
      targetColumn: string;
      note?: string;
      ref?: string;
    },
  ) => void;
  onRemoveMapping?: (sourceTable: string, sourceColumn: string, targetColumn: string) => void;
};

export function layerEdgeClass(layerId: string | undefined): string {
  switch ((layerId ?? "").toLowerCase()) {
    case "bronze":
      return "bg-layer-bronze";
    case "silver":
    case "prata":
      return "bg-layer-silver";
    case "gold":
    case "ouro":
      return "bg-layer-gold";
    default:
      return "bg-layer-raw";
  }
}

export function formatFkTarget(ref: string): string {
  const i = ref.lastIndexOf(".");
  if (i <= 0 || i === ref.length - 1) return ref;
  return `${ref.slice(0, i)}(${ref.slice(i + 1)})`;
}

export function tableFromRef(ref: string): string {
  const i = ref.lastIndexOf(".");
  return i > 0 ? ref.slice(0, i) : ref;
}

export function shortName(id: string): string {
  const dot = id.lastIndexOf(".");
  return dot >= 0 ? id.slice(dot + 1) : id;
}
