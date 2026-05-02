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

interface SelectionVisibilityState {
  forceAllSelected: boolean;
  decorations: DecorationSet;
}

const pluginKey = new PluginKey<SelectionVisibilityState>(
  "selectionVisibility",
);

function coversDocument(state: EditorState): boolean {
  const { selection, doc } = state;
  if (selection instanceof AllSelection) return true;
  if (selection.empty) return false;

  const docStart = 1;
  const docEnd = Math.max(docStart, doc.content.size);
  return selection.from <= docStart && selection.to >= docEnd;
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

function createSelectionDecorations(
  state: EditorState,
  forceAllSelected: boolean,
): DecorationSet {
  const { selection } = state;
  const decorateText = forceAllSelected || coversDocument(state);

  if (!decorateText && selection.empty) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];

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
          init: (_, state): SelectionVisibilityState => ({
            forceAllSelected: false,
            decorations: createSelectionDecorations(state, false),
          }),
          apply: (
            tr: Transaction,
            value: SelectionVisibilityState,
            _oldState: EditorState,
            newState: EditorState,
          ): SelectionVisibilityState => {
            const next = tr.getMeta(pluginKey);
            const forceAllSelected =
              typeof next === "boolean" ? next : coversDocument(newState);

            if (
              !tr.selectionSet &&
              !tr.docChanged &&
              typeof next !== "boolean"
            ) {
              return value;
            }

            return {
              forceAllSelected,
              decorations: createSelectionDecorations(
                newState,
                forceAllSelected,
              ),
            };
          },
        },
        props: {
          decorations: (state) => pluginKey.getState(state)?.decorations,
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
