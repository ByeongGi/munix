import { Extension } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";

/**
 * Tiptap Table의 삭제/선택 UX 개선.
 *
 * 1. 표 전체를 NodeSelection으로 잡은 상태에서 Backspace/Delete → 표 삭제
 * 2. CellSelection(드래그로 여러 셀 선택)에서 Backspace/Delete → 선택된 셀 내용 비우기
 *    (기본 동작이지만 명시적으로 보장)
 * 3. Mod+Shift+Backspace → 커서가 표 안에 있으면 표 전체 삭제
 * 4. Esc → 커서가 표 안이면 표 노드 선택 (다음 Backspace로 삭제)
 */
export const TableDeleteFix = Extension.create({
  name: "tableDeleteFix",

  addKeyboardShortcuts() {
    const findAncestorTablePos = (): { pos: number; depth: number } | null => {
      const { selection } = this.editor.state;
      const $pos =
        selection instanceof TextSelection ? selection.$anchor : null;
      if (!$pos) return null;
      for (let d = $pos.depth; d > 0; d--) {
        if ($pos.node(d).type.name === "table") {
          return { pos: $pos.before(d), depth: d };
        }
      }
      return null;
    };

    const deleteIfTableNodeSelection = (): boolean => {
      const { state } = this.editor;
      const { selection } = state;
      if (
        selection instanceof NodeSelection &&
        selection.node.type.name === "table"
      ) {
        return this.editor.chain().focus().deleteTable().run();
      }
      if (selection instanceof CellSelection) {
        return false;
      }
      return false;
    };

    return {
      Backspace: deleteIfTableNodeSelection,
      Delete: deleteIfTableNodeSelection,
      "Mod-Shift-Backspace": ({ editor }) => {
        return editor.chain().focus().deleteTable().run();
      },
      Escape: ({ editor }) => {
        const found = findAncestorTablePos();
        if (!found) return false;
        const { state, view } = editor;
        const nodeSel = NodeSelection.create(state.doc, found.pos);
        view.dispatch(state.tr.setSelection(nodeSel));
        return true;
      },
    };
  },
});
