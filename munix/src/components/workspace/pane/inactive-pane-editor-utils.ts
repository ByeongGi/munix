import { useBacklinkStore } from "@/store/backlink-store";
import { useSearchStore } from "@/store/search-store";
import { useTagStore } from "@/store/tag-store";
import type { InactiveEditorStatus } from "./inactive-pane-editor-types";

export function canRequestInactiveEditorSave(
  status: InactiveEditorStatus,
): boolean {
  return (
    status !== "conflict" && status !== "loading" && status !== "loadError"
  );
}

export function updateIndexesAfterInactiveSave(path: string, body: string) {
  void useTagStore.getState().updatePath(path);
  void useBacklinkStore.getState().updatePath(path);
  const search = useSearchStore.getState();
  if (search.status === "ready") {
    search.index.updateDoc(path, body);
    if (search.query) search.setQuery(search.query);
  }
}

export function basenameWithoutMd(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

export function isValidMarkdownBasename(name: string): boolean {
  return Boolean(name) && !/[/\\:*?"<>|]/.test(name) && !name.startsWith(".");
}
