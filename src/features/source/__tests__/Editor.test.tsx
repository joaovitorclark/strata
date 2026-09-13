import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { Editor } from "@/features/source/Editor";

vi.mock("@uiw/react-codemirror", () => ({
  default: () => <div data-testid="codemirror" />,
}));

describe("Editor", () => {
  afterEach(cleanup);

  it("clicks the error banner to jump to the error line", () => {
    const onGoToError = vi.fn();
    render(
      <Editor
        value="Table a { id int"
        onChange={() => {}}
        error="unclosed table"
        errorLine={1}
        onGoToError={onGoToError}
      />,
    );
    fireEvent.click(screen.getByText(/unclosed table/));
    expect(onGoToError).toHaveBeenCalled();
  });
});
