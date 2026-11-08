type MonacoEditor = { getValue: () => string; setValue: (value: string) => void };
type MonacoWindow = { editor: { getEditors: () => MonacoEditor[] } };

export function getEditor(monaco: MonacoWindow) {
  return monaco.editor.getEditors()[0];
}

// Monaco reads keys through EditContext, which cy.type cannot drive, so edit its model directly.
export function setEditorValue(update: (current: string) => string) {
  cy.window()
    .its("monaco")
    .then((monaco: MonacoWindow) => {
      const editor = getEditor(monaco);
      editor.setValue(update(editor.getValue()));
    });
}
