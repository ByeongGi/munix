import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { joinPath, parentDir } from "@/lib/app-path-utils";
import { ipc } from "@/lib/ipc";
import type { FileNode } from "@/types/ipc";

interface UseFileRenameActionParams {
  refreshFiles: () => Promise<void>;
  updatePath: (oldPath: string, newPath: string) => void;
  setRenaming: (path: string | null) => void;
}

export function useFileRenameAction({
  refreshFiles,
  updatePath,
  setRenaming,
}: UseFileRenameActionParams) {
  const { t } = useTranslation("app");

  return useCallback(
    async (node: FileNode, rawName: string) => {
      setRenaming(null);
      const parent = parentDir(node.path);
      let newName = rawName.trim();
      if (!newName || newName === node.name) return;
      if (node.kind === "file" && !/\.md$/i.test(newName)) {
        newName = `${newName}.md`;
      }
      const newRel = joinPath(parent, newName);
      try {
        await ipc.renameEntry(node.path, newRel);
      } catch (error) {
        window.alert(
          t("rename.errorAlert", {
            reason: error instanceof Error ? error.message : String(error),
          }),
        );
        return;
      }
      updatePath(node.path, newRel);
      await refreshFiles();
    },
    [t, refreshFiles, setRenaming, updatePath],
  );
}
