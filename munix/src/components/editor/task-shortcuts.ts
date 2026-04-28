import { Extension, type Editor } from "@tiptap/core";

export const TaskShortcuts = Extension.create({
  name: "taskShortcuts",

  addKeyboardShortcuts() {
    const toggleTaskChecked = ({ editor }: { editor: Editor }) => {
      if (!editor.isActive("taskItem")) return false;

      const checked = editor.getAttributes("taskItem").checked === true;
      return editor
        .chain()
        .focus()
        .updateAttributes("taskItem", { checked: !checked })
        .run();
    };

    return {
      "Mod-Enter": toggleTaskChecked,
    };
  },
});
