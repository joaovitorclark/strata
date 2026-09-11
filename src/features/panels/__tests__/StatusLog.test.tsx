import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { StatusLog } from "@/features/panels/StatusLog";

const logs = [
  { ts: Date.UTC(2026, 8, 11, 15, 4, 5), msg: "Import concluído" },
  { ts: Date.UTC(2026, 8, 11, 15, 3, 1), msg: "Projeto carregado" },
];

describe("StatusLog", () => {
  afterEach(cleanup);

  it("opens the last-100 session log when the status button is clicked", () => {
    render(<StatusLog status="Pronto" saveState="idle" logs={logs} />);
    expect(screen.queryByText("Import concluído")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Salvo" }));
    expect(screen.getByText("Import concluído")).toBeTruthy();
    expect(screen.getByText("Projeto carregado")).toBeTruthy();
  });

  it("closes the log when clicking outside the popover", () => {
    render(
      <div>
        <button type="button">fora</button>
        <StatusLog status="Pronto" saveState="idle" logs={logs} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvo" }));
    expect(screen.getByText("Import concluído")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("button", { name: "fora" }));
    expect(screen.queryByText("Import concluído")).toBeNull();
  });
});
