import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVaultStore } from "@/store/vault-store";
import { useEditorStore } from "@/store/editor-store";
import { useTabStore } from "@/store/tab-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { useSearchStore } from "@/store/search-store";
import { useVaultWatcher } from "@/hooks/use-vault-watcher";
import { VaultPicker } from "@/components/vault-picker";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { QuickOpen } from "@/components/palette/quick-open";
import { VaultSwitcher } from "@/components/palette/vault-switcher";
import { CommandPalette } from "@/components/palette/command-palette";
import { AppWorkspaceView } from "@/components/app-shell/app-workspace-view";
import { AppTitleBar } from "@/components/app-shell/window-title-bar";
import type { SidebarTab } from "@/components/app-shell/types";
import { ConflictDialog } from "@/components/editor/conflict-dialog";
import { useActiveVaultEffects } from "@/hooks/app/use-active-vault-effects";
import { useAppOverlays } from "@/hooks/app/use-app-overlays";
import { useFileCreateActions } from "@/hooks/app/use-file-create-actions";
import { useFileDeleteActions } from "@/hooks/app/use-file-delete-actions";
import { useFileMoveActions } from "@/hooks/app/use-file-move-actions";
import { useFileRenameAction } from "@/hooks/app/use-file-rename-action";
import { useFileSystemActions } from "@/hooks/app/use-file-system-actions";
import { useFileTreeActionDispatcher } from "@/hooks/app/use-file-tree-action-dispatcher";
import { useFileTreeReveal } from "@/hooks/app/use-file-tree-reveal";
import { useGlobalShortcuts } from "@/hooks/app/use-global-shortcuts";
import { usePersistentSidebarState } from "@/hooks/app/use-persistent-sidebar-state";
import { useVaultPickerAction } from "@/hooks/app/use-vault-picker-action";

function App() {
  const { t } = useTranslation("app");
  const info = useVaultStore((s) => s.info);
  const files = useVaultStore((s) => s.files);
  const openVault = useVaultStore((s) => s.open);
  const refreshFiles = useVaultStore((s) => s.refresh);
  const activeVaultId = useVaultDockStore((s) => s.activeVaultId);

  const currentPath = useEditorStore((s) => s.currentPath);

  const openTab = useTabStore((s) => s.openTab);
  const createEmptyTab = useTabStore((s) => s.createEmptyTab);
  const promoteActiveEmptyTab = useTabStore((s) => s.promoteActiveEmptyTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const activateIndex = useTabStore((s) => s.activateIndex);
  const activateNext = useTabStore((s) => s.activateNext);
  const activatePrev = useTabStore((s) => s.activatePrev);
  const updatePath = useTabStore((s) => s.updatePath);
  const removeByPath = useTabStore((s) => s.removeByPath);
  const resetTabs = useTabStore((s) => s.resetTabs);

  const closeActive = useCallback(() => {
    const id = useTabStore.getState().activeId;
    if (id) closeTab(id);
  }, [closeTab]);

  const closeAllTabs = useTabStore((s) => s.closeAll);

  const [renaming, setRenaming] = useState<string | null>(null);
  const handlePickFolder = useVaultPickerAction(openVault);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
  } = usePersistentSidebarState();
  const {
    quickOpen,
    setQuickOpen,
    vaultSwitcherOpen,
    setVaultSwitcherOpen,
    paletteOpen,
    setPaletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    settingsOpen,
    setSettingsOpen,
  } = useAppOverlays();
  const revealPath = useFileTreeReveal({
    setSidebarCollapsed,
    setSidebarTab,
  });

  useVaultWatcher();

  // 최초 마운트 시 자동 reopen 은 main.tsx 의 bootstrapVaultRegistry 가 담당
  // (ADR-032). 여기선 별도 처리 안 함.

  useActiveVaultEffects({
    activeVaultId,
    info,
    resetTabs,
  });

  const { handleCreateFileAt, handleCreateFolderAt } = useFileCreateActions({
    info,
    files,
    refreshFiles,
    openTab,
    promoteActiveEmptyTab,
    setRenaming,
  });
  const handleRenameSubmit = useFileRenameAction({
    refreshFiles,
    updatePath,
    setRenaming,
  });
  const { handleDelete, handleDeleteMany } = useFileDeleteActions({
    refreshFiles,
    removeByPath,
  });
  const { copyPath, reveal } = useFileSystemActions();
  const { handleMove, handleMoveMany } = useFileMoveActions({
    files,
    refreshFiles,
    removeByPath,
    updatePath,
  });

  useGlobalShortcuts({
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
  });

  const handleAction = useFileTreeActionDispatcher({
    setRenaming,
    handleCreateFileAt,
    handleCreateFolderAt,
    handleDelete,
    copyPath,
    reveal,
  });

  if (!info) {
    return (
      <div className="munix-window-shell relative flex h-full flex-col">
        <AppTitleBar variant="full" />
        <div className="min-h-0 flex-1 overflow-hidden pt-9">
          <VaultPicker onPick={handlePickFolder} />
        </div>
      </div>
    );
  }

  const sidebarTitle =
    sidebarTab === "files"
      ? t("sidebar.files")
      : sidebarTab === "search"
        ? t("sidebar.search")
        : sidebarTab === "outline"
          ? t("sidebar.outline")
          : t("sidebar.tags");

  return (
    <div className="munix-window-shell relative flex h-full flex-col">
      <AppWorkspaceView
        info={info}
        files={files}
        currentPath={currentPath}
        renaming={renaming}
        revealPath={revealPath}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
        sidebarTab={sidebarTab}
        sidebarTitle={sidebarTitle}
        setSidebarTab={setSidebarTab}
        openTab={openTab}
        createEmptyTab={createEmptyTab}
        closeAllTabs={closeAllTabs}
        handleCreateFileAt={handleCreateFileAt}
        handleCreateFolderAt={handleCreateFolderAt}
        handleAction={handleAction}
        handleMove={handleMove}
        handleMoveMany={handleMoveMany}
        handleDeleteMany={handleDeleteMany}
        handleRenameSubmit={handleRenameSubmit}
        onRenameCancel={() => setRenaming(null)}
        onOpenVaultSwitcher={() => setVaultSwitcherOpen(true)}
        onQuickOpen={() => setQuickOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSearchSelect={(hit, query) => {
          useEditorStore.getState().setPendingSearchQuery(query);
          if (hit.matchedLine > 0) {
            useEditorStore.getState().setPendingJumpLine(hit.matchedLine);
          }
          openTab(hit.path);
        }}
      />

      <ConflictDialog />
      <QuickOpen open={quickOpen} onClose={() => setQuickOpen(false)} />
      <VaultSwitcher
        open={vaultSwitcherOpen}
        onClose={() => setVaultSwitcherOpen(false)}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNewFile={() => void handleCreateFileAt("")}
        onNewFolder={() => void handleCreateFolderAt("")}
        onPickVault={handlePickFolder}
        onSwitchSidebar={(tab) => setSidebarTab(tab)}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSearchTag={(tag) => {
          setSidebarTab("search");
          useSearchStore.getState().setQuery(`#${tag}`);
        }}
      />
    </div>
  );
}

export default App;
