import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FootnoteBlockView } from "./footnote-block-view";

export interface FootnoteBlockAttrs {
  id: string;
}

/**
 * Obsidian/Markdown 호환 각주 정의: 줄 시작 `[^id]: text`.
 *
 * - block 노드 (group: block, content: inline*)
 * - parseHTML: `<div data-fndef="...">` (preprocessMarkdown에서 변환)
 * - markdown 직렬화: `[^id]: ` + inline 본문 + 줄바꿈
 *
 * inline content를 그대로 보존하므로 정의 안에 link/강조/wikilink 등을 사용 가능.
 */
export const FootnoteBlock = Node.create<{
  HTMLAttributes: Record<string, unknown>;
}>({
  name: "footnoteBlock",
  group: "block",
  content: "inline*",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-fndef") ?? "",
        renderHTML: (attrs) =>
          ({ "data-fndef": attrs.id as string }) as Record<string, string>,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-fndef]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const id = (node.attrs.id as string) || "";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "munix-fn-def",
        "data-fndef": id,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FootnoteBlockView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (s: string) => void;
            renderInline: (n: unknown) => void;
            closeBlock: (n: unknown) => void;
            ensureNewLine: () => void;
          },
          node: { attrs: FootnoteBlockAttrs },
        ) {
          const id = node.attrs.id ?? "";
          state.write(`[^${id}]: `);
          state.renderInline(node);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});
