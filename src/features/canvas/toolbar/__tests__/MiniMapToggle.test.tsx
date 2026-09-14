import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { MiniMapToggle } from "../MiniMapToggle";
import { CanvasActionsCtx, type CanvasActions } from "@/features/canvas/actions";
import { useSchemaStore } from "@/features/schema/store";
import { MINIMAP_STORAGE_KEY } from "../minimapPref";

const storeState = {
  nodes: [] as Array<{ type: string }>,
  domNode: null as HTMLElement | null,
};

vi.mock("@xyflow/react", () => ({
  MiniMap: (props: { className?: string; style?: React.CSSProperties }) => (
    <div
      data-testid="rf__minimap"
      className={["react-flow__minimap", props.className].filter(Boolean).join(" ")}
      style={props.style}
    />
  ),
  useStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));

const actions = {
  layerOf: () => "bronze",
} as unknown as CanvasActions;

function renderToggle() {
  return render(
    <CanvasActionsCtx.Provider value={actions}>
      <MiniMapToggle />
    </CanvasActionsCtx.Provider>,
  );
}

describe("S12 MiniMapToggle", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    localStorage.removeItem(MINIMAP_STORAGE_KEY);
    storeState.nodes = [{ type: "table" }, { type: "table" }];
    storeState.domNode = document.body;
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem(MINIMAP_STORAGE_KEY);
  });

  it("renders a Map toggle and keeps the minimap off below 41 tables", () => {
    renderToggle();
    expect(screen.getByTestId("minimap-toggle")).toBeTruthy();
    expect(screen.queryByTestId("rf__minimap")).toBeNull();
  });

  it("M toggles the minimap and persists strata.minimap", () => {
    renderToggle();
    fireEvent.keyDown(window, { key: "m" });
    expect(screen.getByTestId("rf__minimap")).toBeTruthy();
    expect(localStorage.getItem(MINIMAP_STORAGE_KEY)).toBe("1");
    fireEvent.keyDown(window, { key: "m" });
    expect(screen.queryByTestId("rf__minimap")).toBeNull();
    expect(localStorage.getItem(MINIMAP_STORAGE_KEY)).toBe("0");
  });

  it("shows the minimap by default when the model has more than 40 tables", () => {
    storeState.nodes = Array.from({ length: 41 }, () => ({ type: "table" }));
    renderToggle();
    expect(screen.getByTestId("rf__minimap")).toBeTruthy();
  });
});
