import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";

/**
 * Obsidian callout: blockquote 첫 줄이 `[!KIND]` 형식이면 스타일링.
 * `+/-` 접이식 마커 지원 — `-`면 기본 접힌 상태, `+`면 기본 펼친 상태.
 * 사용자가 헤더 클릭 시 로컬 fold 상태를 토글 (doc은 변경하지 않음 — ephemeral).
 */

const KIND_ALIAS: Record<string, string> = {
  note: "note",
  info: "info",
  tip: "tip",
  hint: "tip",
  important: "tip",
  warning: "warning",
  caution: "warning",
  danger: "danger",
  error: "danger",
  bug: "danger",
  failure: "danger",
  success: "success",
  done: "success",
  check: "success",
  quote: "quote",
  cite: "quote",
  todo: "todo",
  question: "info",
  faq: "info",
  help: "info",
  example: "note",
  abstract: "note",
  summary: "note",
  tldr: "note",
};

const CALLOUT_RE = /^\s*\[!([a-zA-Z]+)\]([-+]?)\s*(.*)$/;

interface CalloutInfo {
  kind: string;
  foldable: boolean;
  foldedByMarker: boolean;
  title: string;
}

function detectCallout(node: PMNode): CalloutInfo | null {
  if (node.type.name !== "blockquote") return null;
  const first = node.firstChild;
  if (!first) return null;
  const text = first.textContent;
  const m = CALLOUT_RE.exec(text);
  if (!m) return null;
  const rawKind = m[1]?.toLowerCase() ?? "note";
  const kind = KIND_ALIAS[rawKind] ?? "note";
  const foldMark = m[2] ?? "";
  return {
    kind,
    foldable: foldMark === "-" || foldMark === "+",
    foldedByMarker: foldMark === "-",
    title: m[3]?.trim() ?? "",
  };
}

interface PluginStateShape {
  decorations: DecorationSet;
  // doc 위치(pos)별로 "사용자가 토글한 fold 상태"를 추적 (marker 기본값과의 차이)
  userToggled: Set<number>;
}

const calloutKey = new PluginKey<PluginStateShape>("calloutDecoration");

function mapPositions(positions: Set<number>, tr: Transaction): Set<number> {
  if (!tr.docChanged || positions.size === 0) return positions;
  const next = new Set<number>();
  for (const pos of positions) {
    const mapped = tr.mapping.mapResult(pos, -1);
    if (!mapped.deleted) next.add(mapped.pos);
  }
  return next;
}

function transactionTouchesNodeType(
  tr: Transaction,
  state: EditorState,
  typeName: string,
): boolean {
  if (!tr.docChanged) return false;
  let touched = false;
  const docSize = state.doc.content.size;

  for (const stepMap of tr.mapping.maps) {
    stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      if (touched) return;
      const from = Math.max(0, Math.min(newStart, docSize));
      const to = Math.max(from, Math.min(newEnd, docSize));
      state.doc.nodesBetween(from, to, (node) => {
        if (node.type.name !== typeName) return;
        touched = true;
        return false;
      });
    });
    if (touched) break;
  }

  return touched;
}

function buildDecorations(
  state: EditorState,
  userToggled: Set<number>,
): DecorationSet {
  const decos: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    const info = detectCallout(node);
    if (!info) return;
    const userDidToggle = userToggled.has(pos);
    const folded = info.foldable
      ? info.foldedByMarker !== userDidToggle
      : false;
    const classes = [
      "munix-callout",
      `munix-callout-${info.kind}`,
      info.foldable ? "munix-callout-foldable" : "",
      folded ? "munix-callout-folded" : "",
    ]
      .filter(Boolean)
      .join(" ");
    decos.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: classes,
        "data-callout-kind": info.kind,
        "data-callout-title": info.title,
      }),
    );
  });
  return DecorationSet.create(state.doc, decos);
}

export const CalloutDecoration = Extension.create({
  name: "calloutDecoration",
  addProseMirrorPlugins() {
    return [
      new Plugin<PluginStateShape>({
        key: calloutKey,
        state: {
          init: (_, state) => ({
            userToggled: new Set(),
            decorations: buildDecorations(state, new Set()),
          }),
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(calloutKey) as
              | { toggle: number }
              | undefined;
            let next = mapPositions(prev.userToggled, tr);
            if (meta) {
              next = new Set(next);
              if (next.has(meta.toggle)) next.delete(meta.toggle);
              else next.add(meta.toggle);
            }
            if (!tr.docChanged && !meta) return prev;
            if (!meta && !transactionTouchesNodeType(tr, newState, "blockquote")) {
              return {
                userToggled: next,
                decorations: prev.decorations.map(tr.mapping, tr.doc),
              };
            }
            return {
              userToggled: next,
              decorations: buildDecorations(newState, next),
            };
          },
        },
        props: {
          decorations(state) {
            return calloutKey.getState(state)?.decorations;
          },
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement | null;
            if (!target) return false;
            const calloutEl = target.closest(
              ".munix-callout-foldable",
            ) as HTMLElement | null;
            if (!calloutEl) return false;
            // 첫 자식(타이틀 paragraph) 클릭만 받음
            const titleEl = calloutEl.querySelector(":scope > p:first-child");
            if (!titleEl || !titleEl.contains(target)) return false;
            // 현재 노드 시작 pos 계산
            const resolved = view.state.doc.resolve(pos);
            for (let d = resolved.depth; d > 0; d--) {
              if (resolved.node(d).type.name === "blockquote") {
                const nodeStart = resolved.before(d);
                event.preventDefault();
                view.dispatch(
                  view.state.tr.setMeta(calloutKey, { toggle: nodeStart }),
                );
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
