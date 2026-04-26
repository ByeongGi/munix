import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";

/** 주어진 블록 시작 pos에서 노드를 가져옴 */
function nodeAt(editor: Editor, pos: number) {
  return editor.state.doc.nodeAt(pos);
}

/** 노드를 한 칸 위 형제로 이동 */
export function moveBlockUp(editor: Editor, pos: number): boolean {
  const { state, view } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return false;
  const $pos = state.doc.resolve(pos);
  const prev = $pos.nodeBefore;
  if (!prev) return false;
  const prevStart = pos - prev.nodeSize;
  const from = pos;
  const to = pos + node.nodeSize;
  const tr = state.tr.delete(from, to).insert(prevStart, node);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** 노드를 한 칸 아래 형제로 이동 */
export function moveBlockDown(editor: Editor, pos: number): boolean {
  const { state, view } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return false;
  const to = pos + node.nodeSize;
  const next = state.doc.nodeAt(to);
  if (!next) return false;
  const insertAt = to + next.nodeSize - node.nodeSize;
  const tr = state.tr.delete(pos, to).insert(insertAt, node);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** 노드 복제 (바로 아래) */
export function duplicateBlock(editor: Editor, pos: number): boolean {
  const { state, view } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return false;
  const after = pos + node.nodeSize;
  view.dispatch(state.tr.insert(after, node).scrollIntoView());
  return true;
}

/** 노드 삭제 */
export function deleteBlock(editor: Editor, pos: number): boolean {
  const { state, view } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return false;
  view.dispatch(state.tr.delete(pos, pos + node.nodeSize));
  return true;
}

/** 헤딩 / 단락으로 변환 (블록 타입). NodeSelection으로 잡고 setNode */
export function convertBlock(
  editor: Editor,
  pos: number,
  target:
    | "paragraph"
    | "heading1"
    | "heading2"
    | "heading3"
    | "blockquote"
    | "codeBlock"
    | "bulletList"
    | "orderedList"
    | "taskList",
): boolean {
  const node = nodeAt(editor, pos);
  if (!node) return false;
  const chain = editor.chain().focus();
  // 노드 선택
  const sel = NodeSelection.create(editor.state.doc, pos);
  editor.view.dispatch(editor.state.tr.setSelection(sel));

  switch (target) {
    case "paragraph":
      return chain.setNode("paragraph").run();
    case "heading1":
      return chain.setNode("heading", { level: 1 }).run();
    case "heading2":
      return chain.setNode("heading", { level: 2 }).run();
    case "heading3":
      return chain.setNode("heading", { level: 3 }).run();
    case "blockquote":
      return chain.toggleBlockquote().run();
    case "codeBlock":
      return chain.setCodeBlock().run();
    case "bulletList":
      return chain.toggleBulletList().run();
    case "orderedList":
      return chain.toggleOrderedList().run();
    case "taskList":
      return chain.toggleTaskList().run();
    default:
      return false;
  }
}
