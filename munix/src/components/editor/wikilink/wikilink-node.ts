import { Node, mergeAttributes } from "@tiptap/core";

export interface WikilinkAttrs {
  target: string;
  alias: string | null;
}

export const Wikilink = Node.create<{
  HTMLAttributes: Record<string, unknown>;
}>({
  name: "wikilink",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      target: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-wikilink-target") ?? "",
        renderHTML: (attrs) =>
          ({ "data-wikilink-target": attrs.target as string }) as Record<
            string,
            string
          >,
      },
      alias: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-wikilink-alias"),
        renderHTML: (attrs) => {
          if (!attrs.alias) return {};
          return { "data-wikilink-alias": attrs.alias as string };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-wikilink-target]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const target = (node.attrs.target as string) || "";
    const alias = (node.attrs.alias as string | null) ?? null;
    const display = alias ?? target;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "munix-wikilink",
        title: target,
      }),
      `[[${display}]]`,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void },
          node: { attrs: WikilinkAttrs },
        ) {
          const { target, alias } = node.attrs;
          if (alias) state.write(`[[${target}|${alias}]]`);
          else state.write(`[[${target}]]`);
        },
        parse: {},
      },
    };
  },
});
