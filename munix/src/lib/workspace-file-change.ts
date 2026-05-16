import { ipc } from "@/lib/ipc";
import { getWorkspaceStore } from "@/store/workspace-registry";
import type { VaultId } from "@/store/vault-types";

export type WorkspaceFileChangeKind = "modified" | "created" | "deleted";

interface ApplyWorkspaceFileChangeOptions {
  reloadCurrentEditor?: boolean;
}

export function applyWorkspaceFileChange(
  vaultId: VaultId,
  kind: WorkspaceFileChangeKind,
  path: string,
  options: ApplyWorkspaceFileChangeOptions = {},
): void {
  const store = getWorkspaceStore(vaultId);
  const workspace = store.getState();

  if (kind === "deleted") {
    const search = workspace.search;
    if (search.status === "ready") {
      search.index.removeDoc(path);
      if (search.query) search.setQuery(search.query);
    }
    workspace.removeByPath(path);
    workspace.backlinks.removePath(path);
    workspace.tags.removePath(path);
    return;
  }

  workspace.invalidateDocumentRuntimesForPath(path);

  if (/\.md$/i.test(path)) {
    updateMarkdownIndexes(vaultId, path);
    if (options.reloadCurrentEditor !== false) {
      reloadCurrentEditorIfSafe(vaultId, path);
    }
  }
}

function updateMarkdownIndexes(vaultId: VaultId, path: string): void {
  const store = getWorkspaceStore(vaultId);
  const search = store.getState().search;

  if (search.status === "ready") {
    void (async () => {
      try {
        const content = await ipc.readMarkdownFile(path, vaultId);
        const currentSearch = store.getState().search;
        if (currentSearch.status !== "ready") return;
        currentSearch.index.updateDoc(path, content.body);
        if (currentSearch.query) currentSearch.setQuery(currentSearch.query);
      } catch {
        // External editors often save via rename/delete/create bursts.
        // A read can legitimately race with the next event.
      }
    })();
  }

  void store.getState().backlinks.updatePath(path);
  void store.getState().tags.updatePath(path);
}

function reloadCurrentEditorIfSafe(vaultId: VaultId, path: string): void {
  const workspace = getWorkspaceStore(vaultId).getState();
  if (workspace.currentPath !== path) return;

  const status = workspace.status.kind;
  if (status === "idle" || status === "saved") {
    void workspace.reloadFromDisk();
    return;
  }

  if (status === "dirty" || status === "saving") {
    workspace.setStatus({ kind: "conflict" });
  }
}
