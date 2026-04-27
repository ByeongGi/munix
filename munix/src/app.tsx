import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVaultStore } from "@/store/vault-store";
import { useEditorStore } from "@/store/editor-store";
import { useTabStore } from "@/store/tab-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { useSearchStore } from "@/store/search-store";
import { useVaultWatcher } from "@/hooks/use-vault-watcher";
import { VaultPicker } from "@/components/vault-picker";
import { TabBar } from "@/components/tab-bar";
import { StatusBar } from "@/components/status-bar";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { QuickOpen } from "@/components/palette/quick-open";
import { VaultSwitcher } from "@/components/palette/vault-switcher";
import { CommandPalette } from "@/components/palette/command-palette";
import { EditorView } from "@/components/editor/editor-view";
import { WorkspaceRoot } from "@/components/workspace/workspace-root";
import { EmptyPanePlaceholder } from "@/components/workspace/pane/empty-pane-placeholder";
import { AppTitleBar } from "@/components/app-shell/window-title-bar";
import { WorkspaceHeader } from "@/components/app-shell/workspace-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import type { SidebarTab } from "@/components/app-shell/types";
import { ConflictDialog } from "@/components/editor/conflict-dialog";
import { cn } from "@/lib/cn";
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
import { titleFromPath } from "@/lib/app-path-utils";

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
      <AppTitleBar
        variant="workspace"
        sidebarCollapsed={sidebarCollapsed}
        sidebarWidth={sidebarWidth}
        title={titleFromPath(currentPath)}
        subtitle={info.name}
        onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
      />
      <div
        className={cn(
          "flex overflow-hidden",
          !sidebarCollapsed && "munix-sidebar-surface bg-sidebar",
          sidebarCollapsed ? "min-h-0 flex-1" : "h-full",
        )}
      >
        {sidebarCollapsed ? null : (
          <AppSidebar
            width={sidebarWidth}
            sidebarTab={sidebarTab}
            sidebarTitle={sidebarTitle}
            files={files}
            currentPath={currentPath}
            renaming={renaming}
            revealPath={revealPath}
            onWidthChange={setSidebarWidth}
            onOpenVaultSwitcher={() => setVaultSwitcherOpen(true)}
            onSwitchTab={setSidebarTab}
            onCreateFile={() => void handleCreateFileAt("")}
            onCreateFolder={() => void handleCreateFolderAt("")}
            onSelectFile={openTab}
            onFileAction={handleAction}
            onMove={(from, to) => void handleMove(from, to)}
            onMoveMany={(from, to) => void handleMoveMany(from, to)}
            onDeleteMany={handleDeleteMany}
            onRenameSubmit={(node, name) => void handleRenameSubmit(node, name)}
            onRenameCancel={() => setRenaming(null)}
            onSearchSelect={(hit, query) => {
              useEditorStore.getState().setPendingSearchQuery(query);
              if (hit.matchedLine > 0) {
                useEditorStore.getState().setPendingJumpLine(hit.matchedLine);
              }
              openTab(hit.path);
            }}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}

        <section
          className={cn(
            "flex flex-1 flex-col overflow-hidden bg-workspace",
            !sidebarCollapsed &&
              "-ml-px rounded-l-xl border-l border-border shadow-[inset_1px_0_0_rgb(255_255_255_/_0.04)]",
          )}
        >
          {!sidebarCollapsed && (
            <WorkspaceHeader
              title={titleFromPath(currentPath)}
              subtitle={info.name}
              onQuickOpen={() => setQuickOpen(true)}
              onNewFile={() => void handleCreateFileAt("")}
            />
          )}
          <WorkspaceRoot
            onNewFile={() => void handleCreateFileAt("")}
            onQuickOpen={() => setQuickOpen(true)}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <TabBar onNewFile={() => createEmptyTab()} />
              {currentPath ? (
                <EditorView className="flex-1" />
              ) : (
                <EmptyPanePlaceholder
                  onNewFile={() => void handleCreateFileAt("")}
                  onQuickOpen={() => setQuickOpen(true)}
                  onClose={closeAllTabs}
                />
              )}
            </div>
          </WorkspaceRoot>
          <StatusBar />
        </section>
      </div>

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
