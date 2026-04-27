import type { Editor } from "@tiptap/core";
import type { MouseEvent } from "react";

export function focusEditorEndOnEmptySurface(
  editor: Editor | null,
  event: MouseEvent<HTMLElement>,
): void {
  if (!editor || editor.isDestroyed || event.button !== 0) return;

  const target = event.target as HTMLElement | null;
  if (!target) return;

  if (target.closest("input, textarea, select, button, [role='button']")) {
    return;
  }

  const clickedEditorSurface =
    target === event.currentTarget ||
    target.closest(".munix-editor-content-surface") !== null;
  if (!clickedEditorSurface) return;

  const editorRoot = editor.view.dom;
  if (target !== editorRoot && editorRoot.contains(target)) {
    return;
  }

  event.preventDefault();
  focusEditorEndOnNextFrame(editor);
}

export function focusEditorEndOnNextFrame(editor: Editor | null): void {
  focusEditorSelectionOnNextFrame(editor, "end");
}

export function focusEditorStartOnNextFrame(editor: Editor | null): void {
  focusEditorSelectionOnNextFrame(editor, "start");
}

function focusEditorSelectionOnNextFrame(
  editor: Editor | null,
  position: "start" | "end",
): void {
  if (!editor || editor.isDestroyed) return;

  const focus = () => {
    if (editor.isDestroyed) return;
    if (position === "start") {
      editor.chain().setTextSelection(1).focus().run();
    } else {
      editor.chain().focus("end").run();
    }
    editor.view.focus();
  };

  requestAnimationFrame(() => {
    focus();
    requestAnimationFrame(focus);
  });
}
