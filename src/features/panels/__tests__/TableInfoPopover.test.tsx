import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@/i18n";
import { TableInfoPopover } from "@/features/panels/TableInfoPopover";
import type { TableMeta } from "@/features/canvas/actions";

const meta: TableMeta = {
  sources: ["loja.raw_pedido"],
  sample: {
    columns: ["id", "cliente_id"],
    rows: [
      ["1", "10"],
      ["2", "11"],
      ["3", "12"],
      ["4", "13"],
      ["5", "14"],
      ["6", "15"],
    ],
  },
  pks: ["id"],
  fks: [{ column: "cliente_id", ref: "loja.cliente.id" }],
  refsIn: ["loja.item"],
  note: "pedidos da loja",
  columnNotes: [{ column: "id", note: "surrogate" }],
  resourceType: "model",
  materialization: "incremental",
  tags: ["pii"],
  has: true,
};

describe("TableInfoPopover", () => {
  afterEach(cleanup);

  it("shows sources, sample rows (up to 5), PKs/FKs, dbt badges, and comments", () => {
    const { container } = render(<TableInfoPopover meta={meta} />);
    expect(container.querySelector(".info-popover")).toBeTruthy();
    expect(screen.getByText("Sources (linhagem)")).toBeTruthy();
    expect(screen.getByText(/loja\.raw_pedido/)).toBeTruthy();
    expect(screen.getByText("Exemplo de dados")).toBeTruthy();
    expect(container.querySelectorAll(".info-sample tbody tr")).toHaveLength(5);
    expect(screen.getByText(/PK:\s*id/)).toBeTruthy();
    expect(screen.getByText(/FK:\s*cliente_id → loja\.cliente\.id/)).toBeTruthy();
    expect(screen.getByText(/referenciada por/)).toBeTruthy();
    expect(screen.getByText("model")).toBeTruthy();
    expect(screen.getByText("incremental")).toBeTruthy();
    expect(screen.getByText("#pii")).toBeTruthy();
    expect(screen.getByText("pedidos da loja")).toBeTruthy();
    expect(screen.getByText(/surrogate/)).toBeTruthy();
  });
});
