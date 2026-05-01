import {
  canInsertNode,
  isNodeSelection,
  mergeAttributes,
  Node,
} from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const horizontalRuleSelector = "[data-munix-horizontal-rule]";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    horizontalRule: {
      setHorizontalRule: () => ReturnType;
    };
  }
}

function findHorizontalRulePos(
  view: EditorView,
  rule: HTMLElement,
  nodeName: string,
): number | null {
  let found: number | null = null;

  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== nodeName) return;
    if (view.nodeDOM(pos) === rule) {
      found = pos;
      return false;
    }
  });

  return found;
}

function findHorizontalRuleNearPoint(view: EditorView, event: MouseEvent) {
  const rules = Array.from(
    view.dom.querySelectorAll<HTMLElement>(horizontalRuleSelector),
  );
  let nearest: { rule: HTMLElement; distance: number } | null = null;

  for (const rule of rules) {
    const rect = rule.getBoundingClientRect();
    const inHitArea =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top - 8 &&
      event.clientY <= rect.bottom + 8;

    if (!inHitArea) continue;

    const centerY = rect.top + rect.height / 2;
    const distance = Math.abs(event.clientY - centerY);
    if (!nearest || distance < nearest.distance) {
      nearest = { rule, distance };
    }
  }

  return nearest?.rule;
}

export const HorizontalRuleNode = Node.create({
  name: "horizontalRule",

  group: "block",

  selectable: true,

  atom: true,

  parseHTML() {
    return [{ tag: "hr" }, { tag: "div[data-munix-horizontal-rule]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-munix-horizontal-rule": "",
        role: "separator",
        "aria-orientation": "horizontal",
      }),
    ];
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

                if (!tr.selection.empty) tr.scrollIntoView();
              }
              return true;
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    const moveAfterRule = (options: { createParagraph: boolean }) => {
      const { state, view } = this.editor;
      const { selection, schema } = state;
      if (
        !(selection instanceof NodeSelection) ||
        selection.node.type.name !== this.name
      ) {
        return false;
      }

      let insertPos = selection.to;
      let tr = state.tr;
      const $after = state.doc.resolve(selection.to);
      const next = $after.nodeAfter;

      if (!next) {
        if (!options.createParagraph) return true;
        const paragraphType = schema.nodes.paragraph;
        const paragraph = paragraphType?.create();
        if (!paragraph) return false;
        tr = tr.insert(selection.to, paragraph);
      } else if (next.type.name === this.name) {
        view.dispatch(
          tr
            .setSelection(NodeSelection.create(tr.doc, selection.to))
            .scrollIntoView(),
        );
        return true;
      } else if (!next.isTextblock) {
        view.dispatch(
          tr
            .setSelection(NodeSelection.create(tr.doc, selection.to))
            .scrollIntoView(),
        );
        return true;
      }

      insertPos += 1;
      view.dispatch(
        tr
          .setSelection(TextSelection.create(tr.doc, insertPos))
          .scrollIntoView(),
      );
      return true;
    };

    const moveBeforeRule = () => {
      const { state, view } = this.editor;
      const { selection } = state;
      if (
        !(selection instanceof NodeSelection) ||
        selection.node.type.name !== this.name
      ) {
        return false;
      }

      const $before = state.doc.resolve(selection.from);
      const previous = $before.nodeBefore;
      if (!previous) return true;

      const previousPos = selection.from - previous.nodeSize;
      const nextSelection = previous.isTextblock
        ? TextSelection.create(state.doc, selection.from - 1)
        : NodeSelection.create(state.doc, previousPos);

      view.dispatch(state.tr.setSelection(nextSelection).scrollIntoView());
      return true;
    };

    const deleteSelectedRule = () => {
      const { state, view } = this.editor;
      const { selection } = state;
      if (
        !(selection instanceof NodeSelection) ||
        selection.node.type.name !== this.name
      ) {
        return false;
      }

      view.dispatch(state.tr.deleteSelection().scrollIntoView());
      return true;
    };

    return {
      Enter: () => moveAfterRule({ createParagraph: true }),
      ArrowUp: moveBeforeRule,
      ArrowDown: () => moveAfterRule({ createParagraph: false }),
      Backspace: deleteSelectedRule,
      Delete: deleteSelectedRule,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("horizontalRuleSelection"),
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              if (!(event.target instanceof HTMLElement)) return false;
              const rule =
                event.target.closest<HTMLElement>(horizontalRuleSelector) ??
                findHorizontalRuleNearPoint(view, event);
              if (!rule || !view.dom.contains(rule)) return false;

              const pos = findHorizontalRulePos(view, rule, this.name);
              if (pos == null) return false;

              event.preventDefault();
              view.dispatch(
                view.state.tr.setSelection(
                  NodeSelection.create(view.state.doc, pos),
                ),
              );
              return true;
            },
          },
          handleClickOn: (view, pos, node, _nodePos, event, direct) => {
            if (!direct || node.type.name !== this.name) return false;
            event.preventDefault();
            view.dispatch(
              view.state.tr.setSelection(
                NodeSelection.create(view.state.doc, pos),
              ),
            );
            return true;
          },
        },
      }),
    ];
  },
});
