import type {
  ParsedFieldLineage,
  ParsedLayerGroup,
  ParsedRolename,
} from "@/features/schema/model/dbmlClean";
import type { ParsedRecords } from "@/features/schema/model/records";
import type { SchemaView } from "@/features/schema/model/views";
import type { Cardinality } from "@/features/schema/model/parse";

export type ProjectFiles = Record<string, string>;

export type StrataIndex = {
  columns: string[];
  unique?: boolean;
  name?: string;
};

export type StrataColumn = {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  unique?: boolean;
  default?: string;
  note?: string;
  enumName?: string;
  acceptedValues?: string[];
  color?: string;
};

export type StrataRef = {
  id: string;
  source: string;
  target: string;
  fromCol: string;
  toCol: string;
  fromRel: Cardinality;
  toRel: Cardinality;
};

export type StrataTable = {
  id: string;
  name: string;
  schema?: string;
  project: string;
  kind: "source" | "model";
  layer?: string;
  group?: string;
  note?: string;
  columns: StrataColumn[];
  compositePks?: string[][];
  indexes?: StrataIndex[];
  tags?: string[];
  resourceType?: "model" | "source" | "seed" | "snapshot";
  materialization?: "table" | "view" | "incremental" | "ephemeral";
  external?: boolean;
  externalProject?: string;
};

export type StrataEnum = { name: string; values: string[] };

export type StrataCanvas = {
  positions?: Record<string, { x: number; y: number }>;
  sizes?: Record<string, { width?: number; height?: number }>;
  collapsedGroups?: string[];
};

export type StrataModel = {
  project: string;
  tables: StrataTable[];
  refs: StrataRef[];
  records: ParsedRecords[];
  layerGroups: ParsedLayerGroup[];
  lineageFields: ParsedFieldLineage[];
  rolenames: ParsedRolename[];
  colors: Record<string, string>;
  pins: string[];
  views: SchemaView[];
  enums: StrataEnum[];
  canvas?: StrataCanvas;
};

export const PROJECT_TAG_PREFIX = "strata:";

export function projectTag(projeto: string): string {
  return `${PROJECT_TAG_PREFIX}${projeto}`;
}

export function projectFromTags(tags: string[] | undefined): string | undefined {
  const tag = tags?.find(
    (t) => t.startsWith(PROJECT_TAG_PREFIX) && t !== `${PROJECT_TAG_PREFIX}managed`,
  );
  return tag ? tag.slice(PROJECT_TAG_PREFIX.length) : undefined;
}

export function qualifiedTableId(schema: string | undefined, name: string): string {
  return schema && schema !== "public" ? `${schema}.${name}` : name;
}

export function modelNameOf(table: Pick<StrataTable, "name">): string {
  return table.name;
}

export function sourceNameOf(table: Pick<StrataTable, "schema" | "name">): {
  source: string;
  table: string;
} {
  return { source: table.schema ?? "raw", table: table.name };
}
