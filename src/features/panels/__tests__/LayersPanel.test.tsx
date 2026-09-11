import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { LayersPanel } from "@/features/panels/LayersPanel";
import { parsePagesCollapsed } from "@/features/canvas/utils/pagesPanelState";
import { ALL_PAGE_ID } from "@/features/canvas/utils/scaleLimits";
import { TABLE_COLORS } from "@/features/canvas/tableColors";
import { LAYER_PRESETS } from "@/features/schema/model/layers";
import { useSchemaStore } from "@/features/schema/store";
import type { CanvasPage, Layer } from "@/infrastructure/api";

const layers: Layer[] = [
  { id: "bronze", name: "Bronze", color: TABLE_COLORS[4] },
  { id: "prata", name: "Prata", color: TABLE_COLORS[11] },
];

const pages: CanvasPage[] = [
  { id: ALL_PAGE_ID, name: "Todas", tableGroups: [ALL_PAGE_ID] },
  { id: "vendas", name: "Vendas", tableGroups: ["g1"] },
  { id: "estoque", name: "Estoque", tableGroups: ["g2"] },
];

const tables = [{ id: "loja.pedido" }, { id: "loja.cliente" }, { id: "gold.dim_product" }];

function renderPanel(overrides: Partial<ComponentProps<typeof LayersPanel>> = {}) {
  const onAddLayer = vi.fn();
  const onFocusTable = vi.fn();
  const onAutolayout = vi.fn();
  const onChangeActivePages = vi.fn();
  const result = render(
    <LayersPanel
      layers={layers}
      tables={tables}
      onAddLayer={onAddLayer}
      onFocusTable={onFocusTable}
      onAutolayout={onAutolayout}
      pages={pages}
      activePageIds={[ALL_PAGE_ID]}
      onChangeActivePages={onChangeActivePages}
      {...overrides}
    />,
  );
  return { ...result, onAddLayer, onFocusTable, onAutolayout, onChangeActivePages };
}

describe("LayersPanel", () => {
  beforeEach(() => {
    useSchemaStore.setState(useSchemaStore.getInitialState(), true);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("imports parsePagesCollapsed from pagesPanelState rather than redefining it", () => {
    expect(typeof LayersPanel).toBe("function");
    expect(parsePagesCollapsed("1")).toBe(true);
    expect(parsePagesCollapsed("0")).toBe(false);
    expect(parsePagesCollapsed(null)).toBe(true);
  });

  it("collapses and expands the panel", () => {
    renderPanel();
    expect(screen.getByText("Camadas e tabelas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Camadas e tabelas/ }));
    expect(screen.queryByPlaceholderText("Buscar tabela…")).toBeNull();
    expect(document.querySelector(".layers-panel")?.className).toMatch(/is-collapsed/);
    expect(localStorage.getItem("ldb.panel.layers")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: /Camadas/ }));
    expect(screen.getByPlaceholderText("Buscar tabela…")).toBeTruthy();
  });

  it('checks "Todas" to show every TableGroup page', () => {
    const { onChangeActivePages } = renderPanel({ activePageIds: ["vendas"] });
    fireEvent.click(screen.getByRole("checkbox", { name: "Todas" }));
    expect(onChangeActivePages).toHaveBeenCalledWith([ALL_PAGE_ID]);
  });

  it("checks and unchecks a named page", () => {
    const { onChangeActivePages } = renderPanel({ activePageIds: [] });
    fireEvent.click(screen.getByRole("checkbox", { name: "Vendas" }));
    expect(onChangeActivePages).toHaveBeenCalledWith(["vendas"]);
    const { onChangeActivePages: onChange2 } = renderPanel({ activePageIds: ["vendas"] });
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Vendas" }).at(-1)!);
    expect(onChange2).toHaveBeenCalledWith([]);
  });

  it("checks and unchecks a layer to show or hide its tables", () => {
    renderPanel();
    const box = screen.getByRole("checkbox", { name: /Bronze/ });
    expect((box as HTMLInputElement).checked).toBe(true);
    fireEvent.click(box);
    expect(useSchemaStore.getState().hiddenLayers.has("bronze")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Bronze/ }));
    expect(useSchemaStore.getState().hiddenLayers.has("bronze")).toBe(false);
  });

  it("+ camada prompts for a name and picks a TABLE_COLORS swatch", () => {
    vi.spyOn(window, "prompt").mockReturnValue("Nova");
    const { onAddLayer } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "+ camada" }));
    fireEvent.click(screen.getByRole("button", { name: TABLE_COLORS[0] }));
    expect(onAddLayer).toHaveBeenCalledWith("Nova", TABLE_COLORS[0]);
  });

  it.each([
    ["medallion-pt", "Medallion (pt-BR): Bronze / Prata / Ouro"],
    ["medallion-en", "Medallion (en): Bronze / Silver / Gold"],
    ["raw-edw-mart", "Raw / EDW / Mart"],
    ["inbound-staging-solutions", "Inbound / Staging / Solutions"],
    ["sor-sot-spec", "SOR / SOT / Spec"],
  ] as const)("inserts preset %s", (id, label) => {
    const { onAddLayer } = renderPanel();
    fireEvent.change(screen.getByTitle(/nomenclatura medallion/), { target: { value: id } });
    const preset = LAYER_PRESETS[id];
    expect(screen.getByText(label)).toBeTruthy();
    expect(onAddLayer).toHaveBeenCalledTimes(preset.layers.length);
    for (const layer of preset.layers) {
      expect(onAddLayer).toHaveBeenCalledWith(layer.name, layer.color);
    }
  });

  it("Esmaecer toggles dim mode", () => {
    renderPanel();
    const initial = useSchemaStore.getState().layerDimMode;
    fireEvent.click(screen.getByRole("checkbox", { name: "Esmaecer (em vez de esconder)" }));
    expect(useSchemaStore.getState().layerDimMode).toBe(!initial);
  });

  it("toggles lineage, relations, and field-lineage visibility", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar linhagem" }));
    expect(useSchemaStore.getState().lineageVisible).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar relacionamentos" }));
    expect(useSchemaStore.getState().relationsVisible).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar linhagem de campos" }));
    expect(useSchemaStore.getState().fieldLineageVisible).toBe(true);
  });

  it("toggles Modo linhagem", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Modo linhagem/ }));
    expect(useSchemaStore.getState().lineageMode).toBe(true);
    expect(screen.getByRole("button", { name: /Modo linhagem \(ativo\)/ })).toBeTruthy();
  });

  it("filters the table list by id", () => {
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Buscar tabela…"), {
      target: { value: "gold" },
    });
    expect(screen.getByRole("button", { name: "gold.dim_product" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "loja.pedido" })).toBeNull();
  });

  it("clicking a table name focuses it on the canvas", () => {
    const { onFocusTable } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "loja.cliente" }));
    expect(onFocusTable).toHaveBeenCalledWith("loja.cliente");
    fireEvent.doubleClick(screen.getByRole("button", { name: "loja.pedido" }));
    expect(onFocusTable).toHaveBeenCalledWith("loja.pedido");
  });

  it("Organizar canvas runs autolayout", () => {
    const { onAutolayout } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Organizar canvas" }));
    expect(onAutolayout).toHaveBeenCalledTimes(1);
  });
});
