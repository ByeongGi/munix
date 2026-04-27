import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVaultStore } from "@/store/vault-store";
import { useEditorStore } from "@/store/editor-store";
import { useTabStore } from "@/store/tab-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { useSearchStore } from "@/store/search-store";
import { useVaultWatcher } from "@/hooks/use-vault-watcher";
import type { FileNode } from "@/types/ipc";
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
import { closeActivePane, splitActivePane } from "@/lib/workspace-commands";
import { ConflictDialog } from "@/components/editor/conflict-dialog";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/cn";
import { useKeymapMatcher } from "@/hooks/use-keymap";
import { useActiveVaultEffects } from "@/hooks/app/use-active-vault-effects";
import { useAppOverlays } from "@/hooks/app/use-app-overlays";
import { useFileCreateActions } from "@/hooks/app/use-file-create-actions";
import { useFileTreeReveal } from "@/hooks/app/use-file-tree-reveal";
import { usePersistentSidebarState } from "@/hooks/app/use-persistent-sidebar-state";
import { useVaultPickerAction } from "@/hooks/app/use-vault-picker-action";
import {
  dedupeNestedPaths,
  findNodeByPath,
  getMoveTarget,
  isMoveIntoOwnDescendant,
  joinPath,
  parentDir,
  titleFromPath,
} from "@/lib/app-path-utils";

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

  const matchGlobal = useKeymapMatcher("global");
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 1. registry 기반 명령부터 디스패치 (사용자 override 적용).
      const id = matchGlobal(e);
      if (id) {
        e.preventDefault();
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

          // ── Vault (ADR-031) ─────────────────────────────────
          case "global.openVault": {
            void handlePickFolder();
            return;
          }
          case "global.closeVault": {
            const dock = useVaultDockStore.getState();
            const id = dock.activeVaultId;
            if (!id) return;
            if (dock.vaults.length <= 1) {
              // 마지막 vault — vault-store.close 가 dock 까지 정리
              void useVaultStore.getState().close();
            } else {
              void dock.closeVault(id);
            }
            return;
          }
          case "global.nextVault": {
            const dock = useVaultDockStore.getState();
            if (dock.vaults.length === 0) return;
            const idx = dock.vaults.findIndex(
              (v) => v.id === dock.activeVaultId,
            );
            const nextIdx = idx < 0 ? 0 : (idx + 1) % dock.vaults.length;
            const target = dock.vaults[nextIdx];
            if (target) void dock.setActive(target.id);
            return;
          }
          case "global.prevVault": {
            const dock = useVaultDockStore.getState();
            if (dock.vaults.length === 0) return;
            const idx = dock.vaults.findIndex(
              (v) => v.id === dock.activeVaultId,
            );
            const prevIdx =
              idx < 0 ? 0 : (idx - 1 + dock.vaults.length) % dock.vaults.length;
            const target = dock.vaults[prevIdx];
            if (target) void dock.setActive(target.id);
            return;
          }
          case "global.toggleVaultDock":
            useVaultDockStore.getState().toggleVisible();
            return;
          case "global.vaultSwitcher":
            setVaultSwitcherOpen(true);
            return;

          // ── Workspace Split (workspace-split-spec §10) ───────
          case "workspace.splitRight":
            splitActivePane("right");
            return;
          case "workspace.splitDown":
            splitActivePane("bottom");
            return;
          case "workspace.closePane":
            closeActivePane();
            return;
          // moveTabRight / moveTabLeft 는 Phase B 에서 구현. 지금은 no-op
          // (단축키 충돌 방지를 위해 등록만 해 둔다).
          case "workspace.moveTabRight":
          case "workspace.moveTabLeft":
            return;
        }
        return;
      }

      // 2. registry 외 동적 단축키.
      const mod = e.metaKey || e.ctrlKey;
      // 2-a. 파일 탭 1~9
      if (mod && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        activateIndex(parseInt(e.key, 10) - 1);
        return;
      }
      // 2-b. Vault 탭 1~9 (mod+alt+N)
      if (mod && e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const dock = useVaultDockStore.getState();
        const target = dock.vaults[parseInt(e.key, 10) - 1];
        if (target) void dock.setActive(target.id);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    matchGlobal,
    handleCreateFileAt,
    closeActive,
    closeAllTabs,
    activateNext,
    activatePrev,
    activateIndex,
    handlePickFolder,
    setPaletteOpen,
    setQuickOpen,
    setSettingsOpen,
    setShortcutsOpen,
    setVaultSwitcherOpen,
  ]);

  const handleAction = useCallback(
    (
      action:
        | "new-file"
        | "new-folder"
        | "rename"
        | "delete"
        | "copy-path"
        | "reveal",
      node: FileNode,
    ) => {
      if (action === "rename") {
        setRenaming(node.path);
        return;
      }
      if (action === "delete") {
        void (async () => {
          const ok = window.confirm(
            t("delete.confirmPrompt", { name: node.name }),
          );
          if (!ok) return;
          try {
            await ipc.deleteEntry(node.path);
          } catch (e) {
            console.error("delete failed", e);
            window.alert(
              t("delete.errorAlert", {
                reason: e instanceof Error ? e.message : JSON.stringify(e),
              }),
            );
            return;
          }
          removeByPath(node.path);
          await refreshFiles();
        })();
        return;
      }
      if (action === "copy-path") {
        void (async () => {
          try {
            const abs = await ipc.absPath(node.path);
            await ipc.copyText(abs);
          } catch (e) {
            console.error("copy-path failed", e);
            window.alert(
              t("copyPath.errorAlert", {
                reason: e instanceof Error ? e.message : JSON.stringify(e),
              }),
            );
          }
        })();
        return;
      }
      if (action === "reveal") {
        void (async () => {
          try {
            await ipc.revealInSystem(node.path);
          } catch (e) {
            if (isVaultErrorType(e, "PermissionRequired")) {
              const ok = window.confirm(t("trust.revealPrompt"));
              if (!ok) return;
              try {
                await ipc.trustCurrentVault();
                await ipc.revealInSystem(node.path);
                return;
              } catch (retryError) {
                console.error("reveal after trust failed", retryError);
                window.alert(
                  t("reveal.errorAlert", {
                    reason:
                      retryError instanceof Error
                        ? retryError.message
                        : JSON.stringify(retryError),
                  }),
                );
                return;
              }
            }
            console.error("reveal failed", e);
            window.alert(
              t("reveal.errorAlert", {
                reason: e instanceof Error ? e.message : JSON.stringify(e),
              }),
            );
          }
        })();
        return;
      }
      const parent =
        node.kind === "directory" ? node.path : parentDir(node.path);
      if (action === "new-file") void handleCreateFileAt(parent);
      else if (action === "new-folder") void handleCreateFolderAt(parent);
    },
    [t, refreshFiles, handleCreateFileAt, handleCreateFolderAt, removeByPath],
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
        try {
          await ipc.deleteEntry(newRel);
          removeByPath(newRel);
        } catch (e) {
          window.alert(
            t("move.errorAlert", {
              reason: e instanceof Error ? e.message : JSON.stringify(e),
            }),
          );
          return;
        }
      }
      try {
        await ipc.renameEntry(fromPath, newRel);
      } catch (e) {
        window.alert(
          t("move.errorAlert", {
            reason: e instanceof Error ? e.message : JSON.stringify(e),
          }),
        );
        return;
      }
      updatePath(fromPath, newRel);
      await refreshFiles();
    },
    [t, files, refreshFiles, removeByPath, updatePath],
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
          try {
            await ipc.deleteEntry(conflict.newRel);
            removeByPath(conflict.newRel);
          } catch (e) {
            window.alert(
              t("move.errorAlert", {
                reason: e instanceof Error ? e.message : JSON.stringify(e),
              }),
            );
            return;
          }
        }
      }

      for (const plan of plans) {
        if (plan.newRel === plan.fromPath) continue;
        try {
          await ipc.renameEntry(plan.fromPath, plan.newRel);
        } catch (e) {
          window.alert(
            t("move.errorAlert", {
              reason: e instanceof Error ? e.message : JSON.stringify(e),
            }),
          );
          return;
        }
        updatePath(plan.fromPath, plan.newRel);
      }
      await refreshFiles();
    },
    [t, files, refreshFiles, removeByPath, updatePath],
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
            await ipc.deleteEntry(path);
            removeByPath(path);
          } catch (e) {
            console.error("delete many failed", e);
            window.alert(
              t("delete.errorAlert", {
                reason: e instanceof Error ? e.message : JSON.stringify(e),
              }),
            );
            return;
          }
        }
        await refreshFiles();
      })();
    },
    [t, refreshFiles, removeByPath],
  );

  const handleRenameSubmit = useCallback(
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
      } catch (e) {
        window.alert(
          t("rename.errorAlert", {
            reason: e instanceof Error ? e.message : String(e),
          }),
        );
        return;
      }
      updatePath(node.path, newRel);
      await refreshFiles();
    },
    [t, refreshFiles, updatePath],
  );

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

function isVaultErrorType(error: unknown, type: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === type
  );
}

export default App;
