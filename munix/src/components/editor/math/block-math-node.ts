import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlockMathView } from "./block-math-view";

export interface BlockMathAttrs {
  latex: string;
}

/**
 * Obsidian 호환 블록 수식: 자체 라인 `$$\n...\n$$`.
 *
 * - block 노드 (group: block)
 * - parseHTML: `<div data-math-block="...">` (preprocessMarkdown에서 변환)
 * - markdown 직렬화: `$$\nlatex\n$$` (앞뒤 빈 줄)
 */
export const BlockMath = Node.create<{
  HTMLAttributes: Record<string, unknown>;
}>({
  name: "blockMath",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-math-block") ?? "",
        renderHTML: (attrs) =>
          ({ "data-math-block": attrs.latex as string }) as Record<
            string,
            string
          >,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-math-block]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const latex = (node.attrs.latex as string) || "";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "munix-math-block",
      }),
      `$$${latex}$$`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockMathView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (s: string) => void;
            closeBlock: (n: unknown) => void;
            ensureNewLine: () => void;
          },
          node: { attrs: BlockMathAttrs },
        ) {
          const latex = node.attrs.latex ?? "";
          state.write(`$$\n${latex}\n$$`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});
