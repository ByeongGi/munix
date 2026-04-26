import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { slashSuggestion } from "./suggestion";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: slashSuggestion,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
