import { Extension, type Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  moveBlockUp,
  moveBlockDown,
  duplicateBlock,
  deleteBlock,
} from "./block-actions";

/** 현재 selection이 위치한 최상위 블록의 시작 pos를 반환 */
function topLevelBlockPos(editor: Editor): number | null {
  const { $from } = editor.state.selection;
  if ($from.depth === 0) return null;
  // depth 1이 doc의 직접 자식
  return $from.before(1);
}

export const BlockShortcuts = Extension.create({
  name: "blockShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-ArrowUp": ({ editor }) => {
        const pos = topLevelBlockPos(editor);
        if (pos == null) return false;
        return moveBlockUp(editor, pos);
      },
      "Mod-Shift-ArrowDown": ({ editor }) => {
        const pos = topLevelBlockPos(editor);
        if (pos == null) return false;
        return moveBlockDown(editor, pos);
      },
      "Mod-d": ({ editor }) => {
        const pos = topLevelBlockPos(editor);
        if (pos == null) return false;
        return duplicateBlock(editor, pos);
      },
      "Mod-Shift-Delete": ({ editor }) => {
        const pos = topLevelBlockPos(editor);
        if (pos == null) return false;
        return deleteBlock(editor, pos);
      },
      "Mod-Shift-a": ({ editor }) => {
        const pos = topLevelBlockPos(editor);
        if (pos == null) return false;
        const sel = NodeSelection.create(editor.state.doc, pos);
        editor.view.dispatch(
          editor.state.tr.setSelection(sel).scrollIntoView(),
        );
        return true;
      },
    };
  },
});
