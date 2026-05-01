import { useCallback } from "react";

import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { ipc } from "@/lib/ipc";
import { useBacklinkStore } from "@/store/backlink-store";
import { useSearchStore } from "@/store/search-store";
import { useTagStore } from "@/store/tag-store";
import {
  basenameWithoutMd,
  isValidMarkdownBasename,
} from "./inactive-pane-editor-utils";

interface UseInactivePaneRenameParams {
  path: string;
  waitForIdleSave: () => Promise<void>;
}

export function useInactivePaneRename({
  path,
  waitForIdleSave,
}: UseInactivePaneRenameParams) {
  const ws = useActiveWorkspaceStore();

  return useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!isValidMarkdownBasename(trimmed)) return false;

      const currentBase = basenameWithoutMd(path);
      if (trimmed === currentBase) return true;

      await waitForIdleSave();
      const lastSlash = path.lastIndexOf("/");
      const dir = lastSlash >= 0 ? path.substring(0, lastSlash) : "";
      const newPath = dir ? `${dir}/${trimmed}.md` : `${trimmed}.md`;

      try {
        await ipc.renameEntry(path, newPath);
        useSearchStore.getState().renamePath?.(path, newPath);
        useTagStore.getState().renamePath?.(path, newPath);
        useBacklinkStore.getState().renamePath?.(path, newPath);

        const state = ws.getState();
        state.updatePathInAllPanes(path, newPath);
        if (state.currentPath === path) {
          await state.openFile(newPath, state.currentTabId);
        }

        const { useVaultStore } = await import("@/store/vault-store");
        void useVaultStore.getState().refresh();
        return true;
      } catch (error) {
        console.error("inactive pane rename failed", error);
        return false;
      }
    },
    [path, waitForIdleSave, ws],
  );
}
