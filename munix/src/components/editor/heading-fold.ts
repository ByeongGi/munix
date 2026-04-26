import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState } from "@tiptap/pm/state";

/**
 * 헤딩 접기. 헤딩 좌측에 ▾/▸ 버튼을 표시 (CSS ::before),
 * 클릭하면 해당 헤딩 다음부터 같은-또는-상위 레벨 헤딩 직전까지의 블록을 숨김.
 *
 * fold 상태는 ephemeral (plugin state) — 마크다운에 저장 안 됨.
 */

interface HeadingFoldState {
  folded: Set<number>;
  decorations: DecorationSet;
}

const headingFoldKey = new PluginKey<HeadingFoldState>("headingFold");

function buildDecorations(
  state: EditorState,
  folded: Set<number>,
): DecorationSet {
  const decos: Decoration[] = [];
  const doc = state.doc;

  // doc의 직접 자식만 순회 (depth 1 블록)
  doc.forEach((node, pos) => {
    if (node.type.name === "heading") {
      const isFolded = folded.has(pos);
      decos.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: `munix-heading${isFolded ? " munix-heading-folded" : ""}`,
        }),
      );

      if (isFolded) {
        const myLevel = (node.attrs.level as number) ?? 1;
        let cursor = pos + node.nodeSize;
        while (cursor < doc.content.size) {
          const next = doc.nodeAt(cursor);
          if (!next) break;
          if (
            next.type.name === "heading" &&
            ((next.attrs.level as number) ?? 1) <= myLevel
          )
            break;
          decos.push(
            Decoration.node(cursor, cursor + next.nodeSize, {
              class: "munix-fold-hidden",
            }),
          );
          cursor += next.nodeSize;
        }
      }
    }
  });

  return DecorationSet.create(doc, decos);
}

export const HeadingFold = Extension.create({
  name: "headingFold",
  addProseMirrorPlugins() {
    return [
      new Plugin<HeadingFoldState>({
        key: headingFoldKey,
        state: {
          init: (_, state) => ({
            folded: new Set(),
            decorations: buildDecorations(state, new Set()),
          }),
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(headingFoldKey) as
              | { toggle: number }
              | undefined;
            let folded = prev.folded;
            let changed = false;
            if (meta) {
              folded = new Set(prev.folded);
              if (folded.has(meta.toggle)) folded.delete(meta.toggle);
              else folded.add(meta.toggle);
              changed = true;
            }
            // doc 변경 시 stale 위치 정리는 일단 생략 (folded 위치 변동은 사용자 편집과 함께 자연 갱신)
            if (!tr.docChanged && !changed) return prev;
            return {
              folded,
              decorations: buildDecorations(newState, folded),
            };
          },
        },
        props: {
          decorations(state) {
            return headingFoldKey.getState(state)?.decorations;
          },
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement | null;
            if (!target) return false;
            const heading = target.closest("h1, h2, h3, h4, h5, h6");
            if (!heading) return false;
            // 헤딩의 경계 내에서, ::before 영역 (left of text) 클릭만 허용
            const rect = heading.getBoundingClientRect();
            const x = event.clientX;
            // ::before는 left: -1.4em에 있음 (24-32px 가량 왼쪽)
            if (x < rect.left - 36 || x > rect.left + 4) return false;

            // 헤딩 노드의 시작 pos 찾기
            const $pos = view.state.doc.resolve(pos);
            for (let d = $pos.depth; d >= 0; d--) {
              if ($pos.node(d).type.name === "heading") {
                const headingPos = $pos.before(d);
                event.preventDefault();
                view.dispatch(
                  view.state.tr.setMeta(headingFoldKey, {
                    toggle: headingPos,
                  }),
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
