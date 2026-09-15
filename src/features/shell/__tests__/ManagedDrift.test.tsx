import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { applyDbtAction } from "@/features/dbt-source/mutations";
import { inspectManaged } from "@/features/dbt-source/managed";
import { allTablesPage } from "@/features/canvas/utils/pageFilter";
import { useSchemaStore } from "@/features/schema/store";
import { ManagedDrift } from "@/features/shell/inspector/ManagedDrift";

const PROJECT = "demo";
const TABLE = "main.nova";
const SQL = "models/demo/main/nova.sql";

function hydrateDrifted() {
  let files = applyDbtAction({}, PROJECT, { op: "addTable", tableId: TABLE }).files;
  files = { ...files, [SQL]: `${files[SQL]}\n-- drifted\n` };
  useSchemaStore.getState().hydrateDocument({
    dbml: "Table main.nova { id int }",
    positions: {},
    sizes: {},
    colors: {},
    collapsedGroups: [],
    canvasPages: [allTablesPage()],
    activePageIds: ["__all__"],
    files,
    documentFormat: "dbt",
    dbtProject: PROJECT,
  });
  return files;
}

describe("ManagedDrift", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
  });
  afterEach(() => cleanup());

  it("shows drift actions and makeManual clears markers", () => {
    hydrateDrifted();
    expect(inspectManaged(useSchemaStore.getState().files, PROJECT)[0]?.status).toBe("drift");
    render(<ManagedDrift tableId={TABLE} />);
    expect(screen.getByTestId("managed-drift")).toBeTruthy();
    fireEvent.click(screen.getByTestId("managed-make-manual"));
    const report = inspectManaged(useSchemaStore.getState().files, PROJECT).find(
      (r) => r.tableId === TABLE,
    );
    expect(report).toBeUndefined();
  });

  it("regenerate without confirm writes nothing", () => {
    hydrateDrifted();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ManagedDrift tableId={TABLE} />);
    const sql = useSchemaStore.getState().files[SQL];
    fireEvent.click(screen.getByTestId("managed-regenerate"));
    expect(confirm).toHaveBeenCalled();
    expect(useSchemaStore.getState().files[SQL]).toBe(sql);
    expect(inspectManaged(useSchemaStore.getState().files, PROJECT)[0]?.status).toBe("drift");
    confirm.mockRestore();
  });
});
