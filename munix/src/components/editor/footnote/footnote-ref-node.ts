import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FootnoteRefView } from "./footnote-ref-view";

export interface FootnoteRefAttrs {
  id: string;
}

/**
 * Obsidian/Markdown 호환 각주 참조: 본문 안 `[^id]`.
 *
 * - inline atom 노드 (group: inline)
 * - parseHTML: `<sup data-fnref="...">` (preprocessMarkdown에서 변환)
 * - markdown 직렬화: `[^id]`
 */
export const FootnoteRef = Node.create<{
  HTMLAttributes: Record<string, unknown>;
}>({
  name: "footnoteRef",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-fnref") ?? "",
        renderHTML: (attrs) =>
          ({ "data-fnref": attrs.id as string }) as Record<string, string>,
      },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-fnref]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const id = (node.attrs.id as string) || "";
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        class: "munix-fn-ref",
      }),
      `[${id}]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FootnoteRefView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void },
          node: { attrs: FootnoteRefAttrs },
        ) {
          const id = node.attrs.id ?? "";
          state.write(`[^${id}]`);
        },
        parse: {},
      },
    };
  },
});
