export type YamlLdbMap = { table?: string; column?: string; note?: string; ref?: string };
export type YamlLdb = {
  schema?: string;
  layer?: string;
  group?: string;
  color?: string;
  groupColor?: string;
  layerColor?: string;
  pk?: string[];
  records?: { columns?: unknown[]; rows?: unknown[] };
  map?: YamlLdbMap;
};
export type YamlMeta = {
  localdrawdb?: YamlLdb;
  strata?: { pinned?: unknown[] };
};
export type YamlTestObject = {
  accepted_values?: { values?: unknown };
  relationships?: { to?: string; field?: string };
};
export type YamlColumn = {
  name?: string;
  description?: string;
  data_type?: string;
  data_tests?: Array<string | YamlTestObject>;
  meta?: YamlMeta;
};
export type YamlModel = {
  name?: string;
  description?: string;
  config?: { materialized?: string; tags?: string[] };
  columns?: YamlColumn[];
  meta?: YamlMeta;
};
export type YamlSourceTable = { name?: string; description?: string; columns?: YamlColumn[] };
export type YamlDoc = {
  version?: number;
  profile?: unknown;
  "model-paths"?: string[];
  sources?: Array<{ schema?: string; tables?: YamlSourceTable[] }>;
  models?: YamlModel[];
};
