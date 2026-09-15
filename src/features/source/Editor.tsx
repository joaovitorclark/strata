import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { useTranslation } from "react-i18next";
import { Outline } from "@/features/source/Outline";
import { dbmlFoldExtension } from "@/features/source/dbmlFold";
import { cursorLineExtension } from "@/features/source/cursorLineExtension";
import { sourceEditorExtensions, sourceEditorTheme } from "@/features/source/editorHighlight";
import { lineOfColumn } from "@/features/schema/model/lineLocate";
import { cn } from "@/lib/utils";

export type EditorHandle = {
  goToLine: (line: number) => void;
  goToColumn: (table: string, column: string) => void;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  errorLine?: number;
  onFocusTable?: (tableId: string) => void;
  onGoToError?: () => void;
  onCursorLine?: (line0: number) => void;
  onCommit?: () => void;
  showOutline?: boolean;
};

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  {
    value,
    onChange,
    error,
    errorLine,
    onFocusTable,
    onGoToError,
    onCursorLine,
    onCommit,
    showOutline = true,
  },
  ref,
) {
  const { t } = useTranslation();
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const onCursorLineRef = useRef(onCursorLine);
  onCursorLineRef.current = onCursorLine;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const extensions = useMemo(
    () => [
      sql(),
      dbmlFoldExtension,
      cursorLineExtension((line0) => onCursorLineRef.current?.(line0)),
      EditorView.domEventHandlers({
        blur: () => {
          onCommitRef.current?.();
          return false;
        },
      }),
      ...sourceEditorExtensions,
    ],
    [],
  );

  const goToLine = useCallback((line: number) => {
    const view = cmRef.current?.view;
    if (!view) return;
    const lineInfo = view.state.doc.line(Math.min(Math.max(1, line + 1), view.state.doc.lines));
    view.dispatch({
      selection: { anchor: lineInfo.from },
      effects: EditorView.scrollIntoView(lineInfo.from, { y: "start" }),
    });
    view.focus();
  }, []);

  const goToColumn = useCallback(
    (table: string, column: string) => {
      const line = lineOfColumn(value, table, column);
      if (line != null) goToLine(line);
    },
    [value, goToLine],
  );

  useImperativeHandle(ref, () => ({ goToLine, goToColumn }), [goToLine, goToColumn]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {showOutline && <Outline dbml={value} onGoToLine={goToLine} onFocusTable={onFocusTable} />}
      <CodeMirror
        ref={cmRef}
        value={value}
        height="100%"
        className="cm-host min-h-0 flex-1 overflow-hidden font-mono text-xs"
        theme={sourceEditorTheme}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          history: false,
          historyKeymap: false,
          syntaxHighlighting: false,
        }}
        placeholder={t("source.placeholder")}
      />
      {error && (
        <button
          type="button"
          className={cn(
            "w-full truncate border-t border-destructive bg-destructive/10 px-3 py-1.5",
            "text-left font-mono text-xs text-destructive",
          )}
          onClick={() => {
            if (errorLine != null) goToLine(errorLine);
            onGoToError?.();
          }}
          title={errorLine != null ? t("source.errorGoTo") : undefined}
        >
          ⚠ {error}
        </button>
      )}
    </div>
  );
});
