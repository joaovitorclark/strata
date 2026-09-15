import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@/i18n";
import { allTablesPage } from "@/features/canvas/utils/pageFilter";
import { useSchemaStore } from "@/features/schema/store";
import { DbtCodePanel } from "@/features/source/DbtCodePanel";

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value }: { value: string }) => (
    <textarea data-testid="codemirror" defaultValue={value} />
  ),
}));

const YML = `version: 2
models:
  - name: widget
    columns:
      - name: id
        data_type: bigint
`;

describe("DbtCodePanel", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    useSchemaStore.getState().hydrateDocument({
      dbml: "Table main.widget { id bigint }",
      positions: {},
      sizes: {},
      colors: {},
      collapsedGroups: [],
      canvasPages: [allTablesPage()],
      activePageIds: ["__all__"],
      files: {
        "models/demo/main/_widget.yml": YML,
        ".strata/demo/project.yml": "format_version: 1\nname: demo\n",
      },
      documentFormat: "dbt",
      dbtProject: "demo",
    });
    useSchemaStore.getState().selectTable("main.widget");
  });

  afterEach(cleanup);

  it("shows the selected table yaml", () => {
    render(<DbtCodePanel open />);
    expect(screen.getByTestId("dbt-yaml-editor")).toBeTruthy();
    expect(screen.getByTestId("codemirror")).toBeTruthy();
  });

  it("shows a file tree when nothing is selected", () => {
    useSchemaStore.getState().selectTable(null);
    render(<DbtCodePanel open />);
    expect(screen.getByTestId("dbt-file-tree")).toBeTruthy();
    expect(screen.getByText("models/demo/main/_widget.yml")).toBeTruthy();
  });
});
