import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { dedupeNestedPaths } from "@/lib/app-path-utils";
import { ipc } from "@/lib/ipc";
import type { FileNode } from "@/types/ipc";

interface UseFileDeleteActionsParams {
  refreshFiles: () => Promise<void>;
  removeByPath: (path: string) => void;
}

export function useFileDeleteActions({
  refreshFiles,
  removeByPath,
}: UseFileDeleteActionsParams) {
  const { t } = useTranslation("app");

  const deletePath = useCallback(
    async (path: string) => {
      await ipc.deleteEntry(path);
      removeByPath(path);
    },
    [removeByPath],
  );

  const handleDelete = useCallback(
    (node: FileNode) => {
      const ok = window.confirm(
        t("delete.confirmPrompt", { name: node.name }),
      );
      if (!ok) return;

      void (async () => {
        try {
          await deletePath(node.path);
          await refreshFiles();
        } catch (error) {
          console.error("delete failed", error);
          window.alert(
            t("delete.errorAlert", {
              reason:
                error instanceof Error ? error.message : JSON.stringify(error),
            }),
          );
        }
      })();
    },
    [t, deletePath, refreshFiles],
  );

  const handleDeleteMany = useCallback(
    (nodes: FileNode[]) => {
      const paths = dedupeNestedPaths(nodes.map((node) => node.path));
      const ok = window.confirm(
        t("delete.confirmManyPrompt", { count: paths.length }),
      );
      if (!ok) return;

      void (async () => {
        for (const path of paths) {
          try {
            await deletePath(path);
          } catch (error) {
            console.error("delete many failed", error);
            window.alert(
              t("delete.errorAlert", {
                reason:
                  error instanceof Error
                    ? error.message
                    : JSON.stringify(error),
              }),
            );
            return;
          }
        }
        await refreshFiles();
      })();
    },
    [t, deletePath, refreshFiles],
  );

  return {
    handleDelete,
    handleDeleteMany,
  };
}
