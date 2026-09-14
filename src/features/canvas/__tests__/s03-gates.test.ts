import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { isSpacePanIgnored } from "@/features/canvas/components/Canvas";

function grepLines(pattern: string, dir: string): string[] {
  try {
    return execFileSync("grep", ["-rn", pattern, dir], { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 1) return [];
    throw err;
  }
}

describe("S03 gates", () => {
  it("G7: grep -n zoomPercent src/features/shell → 0", () => {
    expect(grepLines("zoomPercent", "src/features/shell")).toEqual([]);
  });

  it("G8: Space guard pans only on the canvas or body, not on focused chrome", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const button = document.createElement("button");
    const menuitem = document.createElement("div");
    menuitem.setAttribute("role", "menuitemcheckbox");
    const stray = document.createElement("div");

    const flow = document.createElement("div");
    flow.className = "react-flow";
    const renderer = document.createElement("div");
    renderer.className = "react-flow__renderer";
    const pane = document.createElement("div");
    pane.className = "react-flow__pane";
    renderer.appendChild(pane);
    flow.appendChild(renderer);
    const toolbarBtn = document.createElement("button");
    flow.appendChild(toolbarBtn);
    document.body.appendChild(flow);

    expect(isSpacePanIgnored({ target: input })).toBe(true);
    expect(isSpacePanIgnored({ target: textarea })).toBe(true);
    expect(isSpacePanIgnored({ target: button })).toBe(true);
    expect(isSpacePanIgnored({ target: menuitem })).toBe(true);
    // Hotfix rewrite: a div that is NOT inside `.react-flow` must be ignored.
    expect(isSpacePanIgnored({ target: stray })).toBe(true);
    // Toolbar is an RF child but not the diagram surface.
    expect(isSpacePanIgnored({ target: toolbarBtn })).toBe(true);
    expect(isSpacePanIgnored({ target: pane })).toBe(false);
    expect(isSpacePanIgnored({ target: flow })).toBe(false);
    expect(isSpacePanIgnored({ target: document.body })).toBe(false);

    flow.remove();
  });
});
