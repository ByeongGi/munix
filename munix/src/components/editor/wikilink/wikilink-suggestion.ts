import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { useVaultStore } from "@/store/vault-store";
import type { FileNode } from "@/types/ipc";
import {
  WikilinkList,
  type WikilinkListHandle,
  type WikilinkItem,
} from "./wikilink-list";

const wikilinkPluginKey = new PluginKey("wikilinkSuggestion");

function flattenMdFiles(
  nodes: FileNode[],
  out: WikilinkItem[] = [],
): WikilinkItem[] {
  for (const n of nodes) {
    if (n.kind === "file" && /\.md$/i.test(n.name)) {
      out.push({
        path: n.path,
        title: n.name.replace(/\.md$/i, ""),
      });
    }
    if (n.children) flattenMdFiles(n.children, out);
  }
  return out;
}

export const wikilinkSuggestion: Omit<
  SuggestionOptions<WikilinkItem>,
  "editor"
> = {
  char: "[[",
  allowSpaces: true,
  startOfLine: false,
  pluginKey: wikilinkPluginKey,

  items: ({ query }) => {
    const files = useVaultStore.getState().files;
    const all = flattenMdFiles(files);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (f) =>
            f.title.toLowerCase().includes(q) ||
            f.path.toLowerCase().includes(q),
        )
      : all;
    return filtered.slice(0, 10);
  },

  command: ({ editor, range, props }) => {
    const item = props as WikilinkItem;
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent([
        {
          type: "wikilink",
          attrs: { target: item.title, alias: null },
        },
        { type: "text", text: " " },
      ])
      .run();
  },

  render: () => {
    let component: ReactRenderer<WikilinkListHandle> | null = null;
    let popup: TippyInstance[] = [];

    return {
      onStart: (props) => {
        component = new ReactRenderer(WikilinkList, {
          props: {
            items: props.items,
            command: (item: WikilinkItem) =>
              props.command(item as unknown as Record<string, unknown>),
          },
          editor: props.editor,
        });
        if (!props.clientRect) return;
        popup = tippy("body", {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          hideOnClick: false,
          placement: "bottom-start",
        });
      },
      onUpdate(props) {
        component?.updateProps({
          items: props.items,
          command: (item: WikilinkItem) =>
            props.command(item as unknown as Record<string, unknown>),
        });
        if (!props.clientRect) return;
        popup[0]?.setProps({
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
        });
      },
      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown({ event: props.event }) ?? false;
      },
      onExit() {
        popup[0]?.destroy();
        component?.destroy();
        component = null;
        popup = [];
      },
    };
  },
};

export const WikilinkSuggestion = Extension.create({
  name: "wikilinkSuggestion",
  addOptions() {
    return { suggestion: wikilinkSuggestion };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
