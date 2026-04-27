import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import {
  dedupeNestedPaths,
  findNodeByPath,
  getMoveTarget,
  isMoveIntoOwnDescendant,
} from "@/lib/app-path-utils";
import { ipc } from "@/lib/ipc";
import type { FileNode } from "@/types/ipc";

interface UseFileMoveActionsParams {
  files: FileNode[];
  refreshFiles: () => Promise<void>;
  removeByPath: (path: string) => void;
  updatePath: (oldPath: string, newPath: string) => void;
}

export function useFileMoveActions({
  files,
  refreshFiles,
  removeByPath,
  updatePath,
}: UseFileMoveActionsParams) {
  const { t } = useTranslation("app");

  const deleteExistingMoveTarget = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        await ipc.deleteEntry(path);
        removeByPath(path);
        return true;
      } catch (error) {
        window.alert(
          t("move.errorAlert", {
            reason:
              error instanceof Error ? error.message : JSON.stringify(error),
          }),
        );
        return false;
      }
    },
    [t, removeByPath],
  );

  const renameMoveTarget = useCallback(
    async (fromPath: string, newRel: string): Promise<boolean> => {
      try {
        await ipc.renameEntry(fromPath, newRel);
        updatePath(fromPath, newRel);
        return true;
      } catch (error) {
        window.alert(
          t("move.errorAlert", {
            reason:
              error instanceof Error ? error.message : JSON.stringify(error),
          }),
        );
        return false;
      }
    },
    [t, updatePath],
  );

  const handleMove = useCallback(
    async (fromPath: string, toFolderPath: string) => {
      const { name, newRel } = getMoveTarget(fromPath, toFolderPath);
      if (newRel === fromPath) return;
      if (isMoveIntoOwnDescendant(fromPath, toFolderPath)) {
        window.alert(t("move.invalidTarget"));
        return;
      }

      const existing = findNodeByPath(files, newRel);
      if (existing) {
        const ok = window.confirm(
          t("move.replacePrompt", { name: existing.name || name }),
        );
        if (!ok) return;
        const deleted = await deleteExistingMoveTarget(newRel);
        if (!deleted) return;
      }

      const moved = await renameMoveTarget(fromPath, newRel);
      if (moved) await refreshFiles();
    },
    [t, files, refreshFiles, deleteExistingMoveTarget, renameMoveTarget],
  );

  const handleMoveMany = useCallback(
    async (fromPaths: string[], toFolderPath: string) => {
      const paths = dedupeNestedPaths(fromPaths);
      if (paths.length === 0) return;

      if (
        paths.some((fromPath) =>
          isMoveIntoOwnDescendant(fromPath, toFolderPath),
        )
      ) {
        window.alert(t("move.invalidTarget"));
        return;
      }

      const plans = paths.map((fromPath) => {
        const { name, newRel } = getMoveTarget(fromPath, toFolderPath);
        return {
          fromPath,
          name,
          newRel,
          existing: findNodeByPath(files, newRel),
        };
      });

      const duplicateTargets = plans
        .map((plan) => plan.newRel)
        .filter((value, index, self) => self.indexOf(value) !== index);
      if (duplicateTargets.length > 0) {
        window.alert(t("move.duplicateTarget"));
        return;
      }

      const conflicts = plans.filter(
        (item) => item.newRel !== item.fromPath && item.existing,
      );
      if (conflicts.length > 0) {
        const ok = window.confirm(
          t("move.replaceManyPrompt", { count: conflicts.length }),
        );
        if (!ok) return;

        for (const conflict of conflicts) {
          const deleted = await deleteExistingMoveTarget(conflict.newRel);
          if (!deleted) return;
        }
      }

      for (const plan of plans) {
        if (plan.newRel === plan.fromPath) continue;
        const moved = await renameMoveTarget(plan.fromPath, plan.newRel);
        if (!moved) return;
      }
      await refreshFiles();
    },
    [t, files, refreshFiles, deleteExistingMoveTarget, renameMoveTarget],
  );

  return {
    handleMove,
    handleMoveMany,
  };
}
