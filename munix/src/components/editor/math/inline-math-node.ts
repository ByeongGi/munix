import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { InlineMathView } from "./inline-math-view";

export interface InlineMathAttrs {
  latex: string;
}

/**
 * Obsidian 호환 인라인 수식: `$x^2 + y^2$`.
 *
 * - inline atom 노드 (group: inline)
 * - parseHTML: `<span data-math-inline="...">` (preprocessMarkdown에서 변환)
 * - markdown 직렬화: `$latex$`
 */
export const InlineMath = Node.create<{
  HTMLAttributes: Record<string, unknown>;
}>({
  name: "inlineMath",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-math-inline") ?? "",
        renderHTML: (attrs) =>
          ({ "data-math-inline": attrs.latex as string }) as Record<
            string,
            string
          >,
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-math-inline]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const latex = (node.attrs.latex as string) || "";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "munix-math-inline",
      }),
      `$${latex}$`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void },
          node: { attrs: InlineMathAttrs },
        ) {
          const latex = node.attrs.latex ?? "";
          state.write(`$${latex}$`);
        },
        parse: {},
      },
    };
  },
});
