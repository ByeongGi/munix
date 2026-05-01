import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  openPathInActivePane,
  openPathInSplit,
} from "@/lib/workspace-commands";

function normalizeMarkdownHref(href: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  if (href.startsWith("#")) return null;
  const [withoutHash] = href.split("#", 1);
  const [path] = (withoutHash ?? "").split("?", 1);
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export const MarkdownLinkClick = Extension.create({
  name: "markdownLinkClick",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownLinkClick"),
        props: {
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement | null;
            const el = target?.closest<HTMLAnchorElement>("a[href]");
            if (!el) return false;
            const path = normalizeMarkdownHref(el.getAttribute("href") ?? "");
            if (!path) return false;
            const mod = event.metaKey || event.ctrlKey;
            if (!mod) return false;

            event.preventDefault();
            if (event.altKey && !event.shiftKey) {
              openPathInSplit(path, "right");
            } else if (!event.altKey && !event.shiftKey) {
              openPathInActivePane(path);
            }
            return true;
          },
        },
      }),
    ];
  },
});
