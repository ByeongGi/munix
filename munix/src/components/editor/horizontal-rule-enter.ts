import { Extension } from "@tiptap/core";

/**
 * Markdown parity: a paragraph containing only `---` should become a horizontal
 * rule when the user presses Enter.
 */
export const HorizontalRuleEnter = Extension.create({
  name: "horizontalRuleEnter",

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (!selection.empty) return false;

        const { $from } = selection;
        const parent = $from.parent;
        if (parent.type.name !== "paragraph") return false;
        if (parent.textContent !== "---") return false;
        if ($from.parentOffset !== parent.content.size) return false;

        return editor
          .chain()
          .focus()
          .deleteRange({ from: $from.start(), to: $from.end() })
          .setHorizontalRule()
          .run();
      },
    };
  },
});
