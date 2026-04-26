import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import i18next from "i18next";
import type { FileNode } from "@/types/ipc";
import { useVaultStore } from "@/store/vault-store";
import { openPathInActivePane, openPathInSplit } from "@/lib/workspace-commands";

function findFileByTitle(nodes: FileNode[], title: string): string | null {
  for (const n of nodes) {
    if (n.kind === "file" && /\.md$/i.test(n.name)) {
      const base = n.name.replace(/\.md$/i, "");
      if (base === title) return n.path;
      if (n.path.replace(/\.md$/i, "") === title) return n.path;
    }
    if (n.children) {
      const found = findFileByTitle(n.children, title);
      if (found) return found;
    }
  }
  return null;
}

/** wikilink 클릭 시 대상 파일을 탭으로 연다. 없으면 토스트/alert. */
export const WikilinkClick = Extension.create({
  name: "wikilinkClick",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("wikilinkClick"),
        props: {
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement | null;
            if (!target) return false;
            const el = target.closest<HTMLElement>(".munix-wikilink");
            if (!el) return false;
            const targetAttr = el.getAttribute("data-wikilink-target");
            if (!targetAttr) return false;
            event.preventDefault();
            const files = useVaultStore.getState().files;
            const path = findFileByTitle(files, targetAttr);
            if (path) {
              const mod = event.metaKey || event.ctrlKey;
              if (mod && event.altKey && !event.shiftKey) {
                openPathInSplit(path, "right");
              } else if (mod && !event.altKey && !event.shiftKey) {
                openPathInActivePane(path);
              } else {
                openPathInActivePane(path);
              }
            } else {
              console.warn(
                i18next.t("wikilink.notFound", {
                  ns: "editor",
                  target: targetAttr,
                }),
              );
            }
            return true;
          },
        },
      }),
    ];
  },
});
