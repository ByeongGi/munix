import { useCallback } from "react";

import { parentDir } from "@/lib/app-path-utils";
import type { FileNode } from "@/types/ipc";

type FileTreeAction =
  | "new-file"
  | "new-folder"
  | "rename"
  | "delete"
  | "copy-path"
  | "reveal";

interface UseFileTreeActionDispatcherParams {
  setRenaming: (path: string | null) => void;
  handleCreateFileAt: (parent: string) => Promise<void>;
  handleCreateFolderAt: (parent: string) => Promise<void>;
  handleDelete: (node: FileNode) => void;
  copyPath: (node: FileNode) => void;
  reveal: (node: FileNode) => void;
}

export function useFileTreeActionDispatcher({
  setRenaming,
  handleCreateFileAt,
  handleCreateFolderAt,
  handleDelete,
  copyPath,
  reveal,
}: UseFileTreeActionDispatcherParams) {
  return useCallback(
    (action: FileTreeAction, node: FileNode) => {
      if (action === "rename") {
        setRenaming(node.path);
        return;
      }
      if (action === "delete") {
        handleDelete(node);
        return;
      }
      if (action === "copy-path") {
        copyPath(node);
        return;
      }
      if (action === "reveal") {
        reveal(node);
        return;
      }

      const parent =
        node.kind === "directory" ? node.path : parentDir(node.path);
      if (action === "new-file") {
        void handleCreateFileAt(parent);
        return;
      }
      void handleCreateFolderAt(parent);
    },
    [
      copyPath,
      handleCreateFileAt,
      handleCreateFolderAt,
      handleDelete,
      reveal,
      setRenaming,
    ],
  );
}
