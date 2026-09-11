import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/** DBML highlighting mapped onto the `--syn-*` token set. */
export const sourceHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "hsl(var(--syn-keyword))" },
  { tag: t.string, color: "hsl(var(--syn-string))" },
  { tag: t.number, color: "hsl(var(--syn-number))" },
  { tag: t.typeName, color: "hsl(var(--syn-type))" },
  { tag: t.standard(t.typeName), color: "hsl(var(--syn-type))" },
  { tag: t.operator, color: "hsl(var(--syn-operator))" },
  { tag: t.punctuation, color: "hsl(var(--syn-punct))" },
  { tag: t.comment, color: "hsl(var(--syn-comment))" },
]);

export const sourceEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    height: "100%",
  },
  ".cm-content": {
    caretColor: "hsl(var(--foreground))",
    fontVariantLigatures: "none",
  },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--card))",
    color: "hsl(var(--syn-gutter))",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "hsl(var(--syn-gutter))",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--syn-line-active) / 0.15)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "hsl(var(--syn-line-active) / 0.12)",
    color: "hsl(var(--syn-gutter))",
  },
});

export const sourceEditorExtensions: Extension[] = [
  sourceEditorTheme,
  syntaxHighlighting(sourceHighlightStyle),
];
