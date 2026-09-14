import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSchemaStore } from "@/features/schema/store";
import { BatchSection } from "@/features/shell/inspector/BatchSection";

describe("Inspector batch hide", () => {
  beforeEach(() => {
    useSchemaStore.getState().setHiddenTables([]);
  });

  it("R3: hides the selected tables as view state and leaves the DBML untouched", () => {
    const onApply = vi.fn();
    render(
      <BatchSection
        tableIds={["loja.cliente", "loja.pedido"]}
        layers={[]}
        dbml={"Table loja.cliente {\n  id int\n}\n"}
        onApply={onApply}
        onSetColor={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("inspector-batch-hide"));

    expect(onApply).not.toHaveBeenCalled();
    expect(useSchemaStore.getState().hiddenTableIds).toEqual(["loja.cliente", "loja.pedido"]);
  });
});
