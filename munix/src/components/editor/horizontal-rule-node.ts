import {
  canInsertNode,
  isNodeSelection,
  mergeAttributes,
  Node,
} from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    horizontalRule: {
      setHorizontalRule: () => ReturnType;
    };
  }
}

export const HorizontalRuleNode = Node.create({
  name: "horizontalRule",

  group: "block",

  parseHTML() {
    return [{ tag: "hr" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["hr", mergeAttributes(HTMLAttributes)];
  },

  markdownTokenName: "hr",

  parseMarkdown: (_token, helpers) => helpers.createNode("horizontalRule"),

  renderMarkdown: () => "---",

  addCommands() {
    return {
      setHorizontalRule:
        () =>
        ({ chain, state }) => {
          const ruleType = state.schema.nodes[this.name];
          if (!ruleType || !canInsertNode(state, ruleType)) {
            return false;
          }

          const { selection } = state;
          const { $to: $originTo } = selection;
          const currentChain = chain();

          if (isNodeSelection(selection)) {
            currentChain.insertContentAt($originTo.pos, { type: this.name });
          } else {
            currentChain.insertContent({ type: this.name });
          }

          return currentChain
            .command(({ state: chainState, tr, dispatch }) => {
              if (dispatch) {
                const { $to } = tr.selection;
                const posAfter = $to.end();

                if ($to.nodeAfter) {
                  if ($to.nodeAfter.isTextblock) {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
                  } else if ($to.nodeAfter.isBlock) {
                    tr.setSelection(NodeSelection.create(tr.doc, $to.pos));
                  } else {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos));
                  }
                } else {
                  const nodeType =
                    chainState.schema.nodes.paragraph ??
                    $to.parent.type.contentMatch.defaultType;
                  const node = nodeType?.create();
                  if (node) {
                    tr.insert(posAfter, node);
                    tr.setSelection(TextSelection.create(tr.doc, posAfter + 1));
                  }
                }

                tr.scrollIntoView();
              }
              return true;
            })
            .run();
        },
    };
  },
});
