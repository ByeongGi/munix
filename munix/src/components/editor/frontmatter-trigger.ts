import { Extension, InputRule } from "@tiptap/core";

interface FrontmatterTriggerOptions {
  hasFrontmatter: () => boolean;
  onTrigger: () => void;
}

export function createFrontmatterTrigger({
  hasFrontmatter,
  onTrigger,
}: FrontmatterTriggerOptions) {
  return Extension.create({
    name: "frontmatterTrigger",

    addInputRules() {
      return [
        new InputRule({
          find: /^---$/,
          handler: ({ state, range, chain }) => {
            const { selection } = state;
            const isFirstTopLevelBlock = selection.$from.before(1) === 0;

            if (!isFirstTopLevelBlock || hasFrontmatter()) return null;

            chain().deleteRange(range).run();
            queueMicrotask(onTrigger);
          },
        }),
      ];
    },
  });
}
