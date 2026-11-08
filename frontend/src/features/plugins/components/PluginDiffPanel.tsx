import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";

// @monaco-editor/react disposes the models before the diff editor on unmount, which makes Monaco throw.
const disposeModelsWithEditor: DiffOnMount = (editor) => {
  const models = editor.getModel();
  editor.onDidDispose(() => {
    models?.original.dispose();
    models?.modified.dispose();
  });
};

interface PluginDiffPanelProps {
  title: string;
  description: string;
  original: string | null;
  modified: string | null;
  testId: string;
}

export function PluginDiffPanel({ title, description, original, modified, testId }: PluginDiffPanelProps) {
  return (
    <section data-testid={testId} className="min-w-0 space-y-2">
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {original === null || modified === null ? (
        <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
          {original === null
            ? "The official copy your override was based on is not on disk yet. It is restored after the next successful plugin download."
            : "The file to compare is not on disk."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-[#0b1220]">
          <DiffEditor
            height="60vh"
            language="yaml"
            theme="vs-dark"
            original={original}
            modified={modified}
            keepCurrentOriginalModel
            keepCurrentModifiedModel
            onMount={disposeModelsWithEditor}
            options={{
              readOnly: true,
              originalEditable: false,
              renderSideBySide: false,
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "JetBrains Mono, monospace",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      )}
    </section>
  );
}
