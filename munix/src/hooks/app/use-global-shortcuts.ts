import { useEffect, type Dispatch, type SetStateAction } from "react";

import type { SidebarTab } from "@/components/app-shell/types";
import { useKeymapMatcher } from "@/hooks/use-keymap";
import { closeActivePane, splitActivePane } from "@/lib/workspace-commands";
import { useEditorStore } from "@/store/editor-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { useVaultStore } from "@/store/vault-store";

interface UseGlobalShortcutsParams {
  handleCreateFileAt: (parent: string) => Promise<void>;
  handlePickFolder: () => Promise<void>;
  closeActive: () => void;
  closeAllTabs: () => void;
  activateIndex: (index: number) => void;
  activateNext: () => void;
  activatePrev: () => void;
  setSidebarTab: Dispatch<SetStateAction<SidebarTab>>;
  setQuickOpen: Dispatch<SetStateAction<boolean>>;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setVaultSwitcherOpen: Dispatch<SetStateAction<boolean>>;
}

export function useGlobalShortcuts({
  handleCreateFileAt,
  handlePickFolder,
  closeActive,
  closeAllTabs,
  activateIndex,
  activateNext,
  activatePrev,
  setSidebarTab,
  setQuickOpen,
  setPaletteOpen,
  setShortcutsOpen,
  setSettingsOpen,
  setVaultSwitcherOpen,
}: UseGlobalShortcutsParams) {
  const matchGlobal = useKeymapMatcher("global");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const id = matchGlobal(event);
      if (id) {
        event.preventDefault();
        switch (id) {
          case "global.save": {
            const flush = useEditorStore.getState().flushSave;
            if (flush) void flush();
            return;
          }
          case "global.searchInVault":
            setSidebarTab("search");
            return;
          case "global.quickOpen":
            setQuickOpen(true);
            return;
          case "global.commandPalette":
            setPaletteOpen(true);
            return;
          case "global.shortcuts":
            setShortcutsOpen(true);
            return;
          case "global.settings":
            setSettingsOpen(true);
            return;
          case "global.newFile":
            void handleCreateFileAt("");
            return;
          case "global.closeTab":
            closeActive();
            return;
          case "global.closeAllTabs":
            closeAllTabs();
            return;
          case "global.nextTab":
            activateNext();
            return;
          case "global.prevTab":
            activatePrev();
            return;
          case "global.openVault":
            void handlePickFolder();
            return;
          case "global.closeVault": {
            const dock = useVaultDockStore.getState();
            const vaultId = dock.activeVaultId;
            if (!vaultId) return;
            if (dock.vaults.length <= 1) {
              void useVaultStore.getState().close();
            } else {
              void dock.closeVault(vaultId);
            }
            return;
          }
          case "global.nextVault": {
            const dock = useVaultDockStore.getState();
            if (dock.vaults.length === 0) return;
            const index = dock.vaults.findIndex(
              (vault) => vault.id === dock.activeVaultId,
            );
            const nextIndex =
              index < 0 ? 0 : (index + 1) % dock.vaults.length;
            const target = dock.vaults[nextIndex];
            if (target) void dock.setActive(target.id);
            return;
          }
          case "global.prevVault": {
            const dock = useVaultDockStore.getState();
            if (dock.vaults.length === 0) return;
            const index = dock.vaults.findIndex(
              (vault) => vault.id === dock.activeVaultId,
            );
            const prevIndex =
              index < 0
                ? 0
                : (index - 1 + dock.vaults.length) % dock.vaults.length;
            const target = dock.vaults[prevIndex];
            if (target) void dock.setActive(target.id);
            return;
          }
          case "global.toggleVaultDock":
            useVaultDockStore.getState().toggleVisible();
            return;
          case "global.vaultSwitcher":
            setVaultSwitcherOpen(true);
            return;
          case "workspace.splitRight":
            splitActivePane("right");
            return;
          case "workspace.splitDown":
            splitActivePane("bottom");
            return;
          case "workspace.closePane":
            closeActivePane();
            return;
          case "workspace.moveTabRight":
          case "workspace.moveTabLeft":
            return;
        }
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.shiftKey && !event.altKey && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        activateIndex(parseInt(event.key, 10) - 1);
        return;
      }
      if (mod && event.altKey && !event.shiftKey && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const dock = useVaultDockStore.getState();
        const target = dock.vaults[parseInt(event.key, 10) - 1];
        if (target) void dock.setActive(target.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    matchGlobal,
    handleCreateFileAt,
    handlePickFolder,
    closeActive,
    closeAllTabs,
    activateIndex,
    activateNext,
    activatePrev,
    setSidebarTab,
    setQuickOpen,
    setPaletteOpen,
    setShortcutsOpen,
    setSettingsOpen,
    setVaultSwitcherOpen,
  ]);
}
