import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSchemaStore } from "@/features/schema/store";
import { allTablesPage } from "@/features/canvas/utils/pageFilter";
import { applyDbtFileChanges } from "@/features/source/applyDbtFileChanges";
import {
  readStoredDrawerTab,
  writeStoredDrawerTab,
  DRAWER_TAB_STORAGE_KEY,
} from "@/features/source/dbtDrawerTab";
import { dbtBaselineFiles, noteDbtBaseline, resetDbtBaseline } from "@/features/source/dbtBaseline";

const WIDGET = `version: 2
models:
  - name: widget
    columns:
      - name: id
        data_type: bigint
`;

describe("applyDbtFileChanges", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    useSchemaStore.getState().hydrateDocument({
      dbml: "Table placeholder { id int }",
      positions: {},
      sizes: {},
      colors: {},
      collapsedGroups: [],
      canvasPages: [allTablesPage()],
      activePageIds: ["__all__"],
      files: {
        "models/demo/main/_widget.yml": WIDGET,
        ".strata/demo/project.yml": "format_version: 1\nname: demo\n",
      },
      documentFormat: "dbt",
      dbtProject: "demo",
    });
  });

  it("writes the yaml into files and queues persist", () => {
    const next = `${WIDGET}    description: from-drawer\n`;
    applyDbtFileChanges({ "models/demo/main/_widget.yml": next });
    const s = useSchemaStore.getState();
    expect(s.files["models/demo/main/_widget.yml"]).toBe(next);
    expect(s.lastDbtChanges["models/demo/main/_widget.yml"]).toBe(next);
    expect(s.dbtPersistGen).toBeGreaterThan(0);
  });
});

describe("dbtDrawerTab localStorage", () => {
  beforeEach(() => {
    localStorage.removeItem(DRAWER_TAB_STORAGE_KEY);
  });

  it("defaults dbt projects to the dbt tab", () => {
    expect(readStoredDrawerTab("dbt")).toBe("dbt");
    expect(readStoredDrawerTab("dbml")).toBe("dbml");
  });

  it("round-trips a stored tab and ignores the wrong format", () => {
    writeStoredDrawerTab("ddl");
    expect(readStoredDrawerTab("dbt")).toBe("ddl");
    expect(readStoredDrawerTab("dbml")).toBe("dbml");
  });

  it("swallows localStorage throws", () => {
    const proto = Object.getPrototypeOf(localStorage) as Storage;
    const spy = vi.spyOn(proto, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => writeStoredDrawerTab("diff")).not.toThrow();
    spy.mockRestore();
  });
});

describe("dbtBaseline", () => {
  beforeEach(() => {
    resetDbtBaseline();
  });

  it("skips empty files so a later hydrate can capture", () => {
    noteDbtBaseline("proj-1", {});
    expect(dbtBaselineFiles()).toEqual({});
    const files = { "models/demo/main/_widget.yml": WIDGET };
    noteDbtBaseline("proj-1", files);
    expect(dbtBaselineFiles()).toEqual(files);
  });

  it("does not recapture after the first non-empty snapshot for a project", () => {
    const original = { "models/demo/main/_widget.yml": WIDGET };
    noteDbtBaseline("proj-1", original);
    noteDbtBaseline("proj-1", {
      "models/demo/main/_widget.yml": `${WIDGET}    description: later\n`,
    });
    expect(dbtBaselineFiles()).toEqual(original);
  });
});
