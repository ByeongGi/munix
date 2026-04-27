import { Extension, type Editor } from "@tiptap/core";

const INDENT_TEXT = "\t";

function isHandledBySpecificNode(editor: Editor) {
  return editor.isActive("codeBlock") || editor.isActive("table");
}

function sinkActiveListItem(editor: Editor) {
  if (editor.can().sinkListItem("taskItem")) {
    return editor.chain().focus().sinkListItem("taskItem").run();
  }

  if (editor.can().sinkListItem("listItem")) {
    return editor.chain().focus().sinkListItem("listItem").run();
  }

  return false;
}

function liftActiveListItem(editor: Editor) {
  if (editor.can().liftListItem("taskItem")) {
    return editor.chain().focus().liftListItem("taskItem").run();
  }

  if (editor.can().liftListItem("listItem")) {
    return editor.chain().focus().liftListItem("listItem").run();
  }

  return false;
}

export const IndentShortcuts = Extension.create({
  name: "indentShortcuts",

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (isHandledBySpecificNode(editor)) return false;
        if (sinkActiveListItem(editor)) return true;

        editor.chain().focus().insertContent(INDENT_TEXT).run();
        return true;
      },
      "Shift-Tab": ({ editor }) => {
        if (isHandledBySpecificNode(editor)) return false;
        return liftActiveListItem(editor) || true;
      },
    };
  },
});
