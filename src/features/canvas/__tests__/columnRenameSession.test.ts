import { afterEach, describe, expect, it } from "vitest";
import {
  armRenameFromPointerEvent,
  clearRenameDraft,
  getRenameDraft,
  resetRenameDraftsForTests,
} from "@/features/canvas/components/columnRenameSession";

describe("column rename session", () => {
  afterEach(() => {
    resetRenameDraftsForTests();
    document.body.innerHTML = "";
  });

  it("arms a draft from capture-phase pointerdown on the pencil before the node remounts", () => {
    document.body.innerHTML = `
      <div data-testid="rf__node-vendas.item">
        <div class="col-row">
          <button data-testid="col-rename" data-col-name="sku" type="button">
            <svg></svg>
          </button>
        </div>
      </div>
    `;
    const icon = document.querySelector("svg");
    expect(icon).toBeTruthy();
    const event = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(event, "target", { value: icon });
    armRenameFromPointerEvent(event);
    expect(getRenameDraft("vendas.item")).toEqual({ column: "sku", draft: "sku" });
  });

  it("clears an armed draft", () => {
    document.body.innerHTML = `
      <div data-testid="rf__node-vendas.item">
        <button data-testid="col-rename" data-col-name="sku" type="button"></button>
      </div>
    `;
    const btn = document.querySelector('[data-testid="col-rename"]');
    const event = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(event, "target", { value: btn });
    armRenameFromPointerEvent(event);
    clearRenameDraft("vendas.item");
    expect(getRenameDraft("vendas.item")).toBeUndefined();
  });
});
