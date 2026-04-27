import type { Editor } from "@tiptap/core";

export function focusEditorStartOnNextFrame(editor: Editor | null): void {
  if (!editor || editor.isDestroyed) return;

  const focus = () => {
    if (editor.isDestroyed) return;
    editor.chain().setTextSelection(1).focus().run();
    editor.view.focus();
  };

  requestAnimationFrame(() => {
    focus();
    requestAnimationFrame(focus);
  });
}
