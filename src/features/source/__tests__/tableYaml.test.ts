import { describe, expect, it } from "vitest";
import { filesForTable, listDbtFiles, modelNameFromPath } from "@/features/source/tableYaml";

const files = {
  "models/demo/main/_widget.yml":
    "version: 2\nmodels:\n  - name: widget\n    columns:\n      - name: id\n",
  "models/demo/main/widget.sql": "select 1 as id\n",
  "models/demo/main/_sources.yml": `version: 2
sources:
  - name: raw
    schema: raw
    tables:
      - name: events
        columns:
          - name: id
`,
  ".strata/demo/project.yml": "format_version: 1\nname: demo\n",
};

describe("tableYaml", () => {
  it("resolves a model yml+sql", () => {
    expect(filesForTable(files, "demo", "main.widget")).toEqual({
      ymlPath: "models/demo/main/_widget.yml",
      sqlPath: "models/demo/main/widget.sql",
      tableId: "main.widget",
    });
  });

  it("resolves a source yml without sql", () => {
    const loc = filesForTable(files, "demo", "raw.events");
    expect(loc?.ymlPath).toBe("models/demo/main/_sources.yml");
    expect(loc?.sqlPath).toBeUndefined();
  });

  it("lists model files and names models from paths", () => {
    expect(listDbtFiles(files)).toContain("models/demo/main/_widget.yml");
    expect(modelNameFromPath("models/vendas/gold/_dim_cliente.yml")).toBe("dim_cliente");
    expect(modelNameFromPath("models/demo/main/_sources.yml")).toBe("sources");
  });
});
