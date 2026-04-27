import { useCallback } from "react";

import { ipc } from "@/lib/ipc";
import { joinPath, uniqueName } from "@/lib/app-path-utils";
import type { FileNode, VaultInfo } from "@/types/ipc";

interface UseFileCreateActionsParams {
  info: VaultInfo | null;
  files: FileNode[];
  refreshFiles: () => Promise<void>;
  openTab: (path: string) => void;
  promoteActiveEmptyTab: (path: string) => boolean;
  setRenaming: (path: string | null) => void;
}

export function useFileCreateActions({
  info,
  files,
  refreshFiles,
  openTab,
  promoteActiveEmptyTab,
  setRenaming,
}: UseFileCreateActionsParams) {
  const handleCreateFileAt = useCallback(
    async (parent: string) => {
      if (!info) return;
      const name = uniqueName(files, parent, "Untitled", ".md");
      const rel = joinPath(parent, name);
      await ipc.createFile(rel, "");
      await refreshFiles();
      if (!promoteActiveEmptyTab(rel)) {
        openTab(rel);
      }
      setRenaming(rel);
    },
    [info, files, refreshFiles, openTab, promoteActiveEmptyTab, setRenaming],
  );

  const handleCreateFolderAt = useCallback(
    async (parent: string) => {
      if (!info) return;
      const name = uniqueName(files, parent, "새 폴더", "");
      const rel = joinPath(parent, name);
      await ipc.createFolder(rel);
      await refreshFiles();
      setRenaming(rel);
    },
    [info, files, refreshFiles, setRenaming],
  );

  return {
    handleCreateFileAt,
    handleCreateFolderAt,
  };
}
