import { EditorState } from "@codemirror/state";
import { foldService } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { dbmlFoldExtension } from "@/features/source/dbmlFold";

function foldAt(doc: string, line: number) {
  const state = EditorState.create({
    doc,
    extensions: [dbmlFoldExtension],
  });
  const start = state.doc.line(line).from;
  const service = state.facet(foldService).find(Boolean);
  return service ? service(state, start, start) : null;
}

describe("dbmlFold", () => {
  it("folds consecutive // comment lines", () => {
    const range = foldAt("// a\n// b\nTable t { id int }\n", 1);
    expect(range).not.toBeNull();
    expect(range!.to).toBeGreaterThan(range!.from);
  });

  it("folds a { ... } block", () => {
    const range = foldAt("Table t {\n  id int\n}\n", 1);
    expect(range).not.toBeNull();
  });
});
