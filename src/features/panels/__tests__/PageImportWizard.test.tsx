import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { PageImportWizard } from "@/features/panels/PageImportWizard";
import { ALL_PAGE_ID } from "@/features/canvas/utils/scaleLimits";
import type { CanvasPage } from "@/infrastructure/api";

const pages: CanvasPage[] = [
  { id: ALL_PAGE_ID, name: "Todas", tableGroups: [ALL_PAGE_ID] },
  { id: "vendas", name: "Vendas", tableGroups: ["vendas"] },
  { id: "estoque", name: "Estoque", tableGroups: ["estoque"] },
];

function renderWizard(overrides: { open?: boolean } = {}) {
  const onConfirm = vi.fn();
  const onDismiss = vi.fn();
  const result = render(
    <PageImportWizard
      open={overrides.open ?? true}
      tableCount={512}
      pages={pages}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />,
  );
  return { ...result, onConfirm, onDismiss };
}

describe("PageImportWizard", () => {
  afterEach(cleanup);

  it("Abrir canvas with 'Todas as tabelas' confirms ALL_PAGE_ID", () => {
    const { onConfirm } = renderWizard();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Todas as tabelas \(pode ficar lento\)/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir canvas" }));
    expect(onConfirm).toHaveBeenCalledWith([ALL_PAGE_ID]);
  });

  it("checks named subjects and confirms their page ids", () => {
    const { onConfirm } = renderWizard();
    fireEvent.click(screen.getByRole("checkbox", { name: "Vendas" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Estoque" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir canvas" }));
    expect(onConfirm).toHaveBeenCalledWith(["vendas", "estoque"]);
  });

  it("Depois dismisses without confirming", () => {
    const { onConfirm, onDismiss } = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Depois" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps Abrir canvas disabled until a subject or all-tables is checked", () => {
    renderWizard();
    expect(screen.getByRole("button", { name: "Abrir canvas" })).toHaveProperty("disabled", true);
  });
});
