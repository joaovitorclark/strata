import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { ProblemsPanel } from "@/features/panels/ProblemsPanel";
import type { ModelIssue } from "@/features/schema/model/validateModel";

const issues: ModelIssue[] = [
  { severity: "error", message: "FK órfã", tableId: "loja.pedido", line: 12 },
  { severity: "warn", message: "Tabela sem PK: loja.item", tableId: "loja.item", line: 4 },
];

describe("ProblemsPanel", () => {
  afterEach(cleanup);

  it("renders nothing when there are no issues", () => {
    const { container } = render(<ProblemsPanel issues={[]} />);
    expect(container.querySelector(".problems-badge")).toBeNull();
  });

  it("clicks the badge to open and close the issues popover", () => {
    render(<ProblemsPanel issues={issues} />);
    const badge = screen.getByRole("button", { name: /1 erro/ });
    expect(screen.queryByText("FK órfã")).toBeNull();
    fireEvent.click(badge);
    expect(screen.getByText("FK órfã")).toBeTruthy();
    fireEvent.click(badge);
    expect(screen.queryByText("FK órfã")).toBeNull();
  });

  it("Linha jumps to the issue line and closes the popover", () => {
    const onGoToLine = vi.fn();
    render(<ProblemsPanel issues={issues} onGoToLine={onGoToLine} />);
    fireEvent.click(screen.getByRole("button", { name: /1 erro/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Linha" })[0]);
    expect(onGoToLine).toHaveBeenCalledWith(12);
    expect(screen.queryByText("FK órfã")).toBeNull();
  });

  it("Tabela pans to the issue table and closes the popover", () => {
    const onFocusTable = vi.fn();
    render(<ProblemsPanel issues={issues} onFocusTable={onFocusTable} />);
    fireEvent.click(screen.getByRole("button", { name: /1 erro/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Tabela" })[0]);
    expect(onFocusTable).toHaveBeenCalledWith("loja.pedido");
    expect(screen.queryByText("FK órfã")).toBeNull();
  });

  it("clicking outside the badge/popover closes it", () => {
    render(
      <div>
        <ProblemsPanel issues={issues} />
        <button type="button">fora</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /1 erro/ }));
    expect(screen.getByText("FK órfã")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("button", { name: "fora" }));
    expect(screen.queryByText("FK órfã")).toBeNull();
  });
});
