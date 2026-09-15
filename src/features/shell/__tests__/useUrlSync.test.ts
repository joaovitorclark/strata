import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSchemaStore } from "@/features/schema/store";
import { flushUrlSync, isUrlSyncReady, useUrlSync } from "@/features/shell/useUrlSync";

describe("isUrlSyncReady", () => {
  it("is false when the project has not hydrated yet", () => {
    expect(isUrlSyncReady({ hydratedProjectId: null, currentProjectId: "p1" })).toBe(false);
  });

  it("is false when hydratedProjectId does not match currentProjectId", () => {
    expect(isUrlSyncReady({ hydratedProjectId: "old", currentProjectId: "p1" })).toBe(false);
  });

  it("is true when hydratedProjectId matches currentProjectId", () => {
    expect(isUrlSyncReady({ hydratedProjectId: "p1", currentProjectId: "p1" })).toBe(true);
  });

  it("is true for the offline fallback empty project id", () => {
    expect(isUrlSyncReady({ hydratedProjectId: "", currentProjectId: "" })).toBe(true);
  });
});

describe.sequential("useUrlSync", () => {
  beforeEach(() => {
    cleanup();
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    window.history.replaceState(window.history.state, "", "/");
  });

  afterEach(() => {
    flushUrlSync();
    cleanup();
    window.history.replaceState(window.history.state, "", "/");
  });

  it("does not apply incoming URL while the project is not hydrated", async () => {
    useSchemaStore.setState({
      currentProjectId: "p1",
      dbml: "Table t { id int }",
      hydratedProjectId: null,
    });
    window.history.replaceState(window.history.state, "", "/?hidden=foo.bar");
    const { unmount } = renderHook(() => useUrlSync({ focusTableWithPan: vi.fn() }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(useSchemaStore.getState().hiddenTableIds).toEqual([]);
    unmount();
  });

  it("applies incoming URL and goes live when hydrated even if dbml is empty", async () => {
    useSchemaStore.setState({
      currentProjectId: "p1",
      dbml: "",
      hydratedProjectId: "p1",
    });
    window.history.replaceState(window.history.state, "", "/?hidden=foo.bar");
    const { unmount } = renderHook(() => useUrlSync({ focusTableWithPan: vi.fn() }));
    await waitFor(() => {
      expect(useSchemaStore.getState().hiddenTableIds).toEqual(["foo.bar"]);
    });
    act(() => {
      useSchemaStore.getState().selectTable("t1");
    });
    act(() => {
      flushUrlSync();
    });
    expect(window.location.search).toContain("focus=t1");
    unmount();
  });
});
