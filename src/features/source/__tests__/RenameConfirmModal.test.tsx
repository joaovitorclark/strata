import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { RenameConfirmModal } from "@/features/source/RenameConfirmModal";
import type { RenameImpact } from "@/features/schema/model/reconcile";

const impacts: RenameImpact[] = [
  {
    rename: { kind: "column", table: "clientes", oldCol: "id", newCol: "codigo" },
    refCount: 1,
    affectsRefs: true,
  },
];

describe("RenameConfirmModal", () => {
  afterEach(cleanup);

  it("shows the rename-with-child-FKs confirmation", () => {
    render(
      <RenameConfirmModal
        impacts={impacts}
        onApply={vi.fn()}
        onKeepSeparate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/clientes\.id → codigo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manter separado" })).toBeTruthy();
  });

  it("Aplicar and Manter separado fire the matching callbacks", () => {
    const onApply = vi.fn();
    const onKeepSeparate = vi.fn();
    render(
      <RenameConfirmModal
        impacts={impacts}
        onApply={onApply}
        onKeepSeparate={onKeepSeparate}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onApply).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Manter separado" }));
    expect(onKeepSeparate).toHaveBeenCalledOnce();
  });

  it("clicking the backdrop closes without applying", () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    render(
      <RenameConfirmModal
        impacts={impacts}
        onApply={onApply}
        onKeepSeparate={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId("rename-modal-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });
});
