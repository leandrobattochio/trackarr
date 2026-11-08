import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PluginDiffPanel } from "@/features/plugins/components/PluginDiffPanel";

const original = { dispose: vi.fn() };
const modified = { dispose: vi.fn() };
let disposeEditor: () => void = () => {};

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: (props: {
    keepCurrentOriginalModel?: boolean;
    keepCurrentModifiedModel?: boolean;
    onMount?: (editor: unknown) => void;
  }) => {
    props.onMount?.({
      getModel: () => ({ original, modified }),
      onDidDispose: (listener: () => void) => {
        disposeEditor = listener;
      },
    });
    return (
      <div
        data-testid="diff-editor"
        data-keep-models={String(Boolean(props.keepCurrentOriginalModel && props.keepCurrentModifiedModel))}
      />
    );
  },
}));

describe("PluginDiffPanel", () => {
  it("disposes the diff models only after the editor itself is disposed", () => {
    render(<PluginDiffPanel testId="diff" title="What you changed" description="d" original="a" modified="b" />);

    expect(screen.getByTestId("diff-editor")).toHaveAttribute("data-keep-models", "true");
    expect(original.dispose).not.toHaveBeenCalled();

    disposeEditor();

    expect(original.dispose).toHaveBeenCalledTimes(1);
    expect(modified.dispose).toHaveBeenCalledTimes(1);
  });
});
