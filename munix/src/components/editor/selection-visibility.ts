import { Extension } from "@tiptap/core";
import {
  AllSelection,
  NodeSelection,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const pluginKey = new PluginKey<boolean>("selectionVisibility");

function coversDocument(state: EditorState): boolean {
  const { selection, doc } = state;
  if (selection instanceof AllSelection) return true;
  if (selection.empty) return false;

  const docStart = 1;
  const docEnd = Math.max(docStart, doc.content.size);
  return selection.from <= docStart && selection.to >= docEnd;
}

function shouldDecorateAllSelection(state: EditorState): boolean {
  return pluginKey.getState(state) === true || coversDocument(state);
}

function selectionIntersectsNode(
  state: EditorState,
  pos: number,
  nodeSize: number,
): boolean {
  const { selection } = state;
  if (selection instanceof NodeSelection) return false;
  return (
    !selection.empty && selection.from < pos + nodeSize && selection.to > pos
  );
}

function createSelectionDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];
  const decorateText = shouldDecorateAllSelection(state);

  state.doc.descendants((node, pos) => {
    if (
      node.type.name === "horizontalRule" &&
      selectionIntersectsNode(state, pos, node.nodeSize)
    ) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: "munix-selected-node",
        }),
      );
      return;
    }

    if (!decorateText) return;
    if (!node.isTextblock || node.content.size === 0) return;

    decorations.push(
      Decoration.inline(pos + 1, pos + node.nodeSize - 1, {
        class: "munix-all-selected-text",
      }),
    );
  });

  return DecorationSet.create(state.doc, decorations);
}

function selectWholeDocument(state: EditorState): Transaction {
  const { doc } = state;
  const from = 1;
  const to = Math.max(from, doc.content.size);

  return state.tr
    .setSelection(TextSelection.create(doc, from, to))
    .setMeta(pluginKey, true)
    .scrollIntoView();
}

export const SelectionVisibility = Extension.create({
  name: "selectionVisibility",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => false,
          apply: (
            tr: Transaction,
            value: boolean,
            _oldState: EditorState,
            newState: EditorState,
          ) => {
            const next = tr.getMeta(pluginKey);
            if (typeof next === "boolean") return next;
            if (tr.selectionSet || tr.docChanged)
              return coversDocument(newState);
            return value;
          },
        },
        props: {
          decorations: (state) => createSelectionDecorations(state),
          handleKeyDown: (view, event) => {
            const isSelectAll =
              event.key.toLowerCase() === "a" &&
              (event.metaKey || event.ctrlKey) &&
              !event.altKey &&
              !event.shiftKey;
            if (!isSelectAll) return false;

            event.preventDefault();
            view.dispatch(selectWholeDocument(view.state));
            return true;
          },
        },
      }),
    ];
  },
});
