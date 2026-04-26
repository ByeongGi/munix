import { type MouseEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Plus,
  FolderPlus,
  Files,
  Search,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  List,
  Hash,
  MoreHorizontal,
} from "lucide-react";
import { useVaultStore } from "@/store/vault-store";
import { useEditorStore } from "@/store/editor-store";
import { useTabStore } from "@/store/tab-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { VaultDock } from "@/components/vault-dock";
import { useRecentStore } from "@/store/recent-store";
import { useSearchStore } from "@/store/search-store";
import { useVaultWatcher } from "@/hooks/use-vault-watcher";
import type { FileNode } from "@/types/ipc";
import { FileList } from "@/components/file-tree";
import { VaultPicker } from "@/components/vault-picker";
import { SearchPanel } from "@/components/search-panel";
import { OutlinePanel } from "@/components/outline-panel";
import { TagPanel } from "@/components/tag-panel";
import { TabBar } from "@/components/tab-bar";
import { StatusBar } from "@/components/status-bar";
import { SidebarResizer } from "@/components/sidebar-resizer";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { QuickOpen } from "@/components/palette/quick-open";
import { VaultSwitcher } from "@/components/palette/vault-switcher";
import { CommandPalette } from "@/components/palette/command-palette";
import { EditorView } from "@/components/editor/editor-view";
import { WorkspaceRoot } from "@/components/workspace/workspace-root";
import { EmptyPanePlaceholder } from "@/components/workspace/empty-pane-placeholder";
import { closeActivePane, splitActivePane } from "@/lib/workspace-commands";
import { ConflictDialog } from "@/components/editor/conflict-dialog";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/cn";
import { iconButton } from "@/lib/ui-variants";
import { useKeymapMatcher } from "@/hooks/use-keymap";
import { usePropertyTypesStore } from "@/store/property-types-store";

type SidebarTab = "files" | "search" | "outline" | "tags";

function startWindowDrag(e: MouseEvent<HTMLElement>): void {
  if (e.button !== 0) return;
  e.preventDefault();
  void getCurrentWindow().startDragging().catch(() => undefined);
}

function CustomTitleBar({
  sidebarCollapsed,
  sidebarWidth,
  title,
  subtitle,
  onToggleSidebar,
}: {
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
  title?: string;
  subtitle?: string;
  onToggleSidebar?: () => void;
}) {
  const { t } = useTranslation("app");
  const win = getCurrentWindow();
  const sidebarToggleLabel = sidebarCollapsed
    ? t("sidebar.expand")
    : t("sidebar.collapse");
  const isFullWidth = sidebarCollapsed || !onToggleSidebar;

  return (
    <div
      className={cn(
        "z-30 flex h-9 shrink-0 items-center",
        isFullWidth
          ? "border-b border-border bg-bg"
          : "absolute left-0 top-0",
      )}
      style={{
        width: isFullWidth
          ? "100%"
          : sidebarWidth,
      }}
      title={t("window.drag")}
      data-tauri-drag-region
      onMouseDown={startWindowDrag}
      onDoubleClick={() => void win.toggleMaximize()}
    >
      <div
        className="flex w-[84px] shrink-0 items-center gap-2 px-3.5"
        data-tauri-drag-region
      >
        <WindowControl
          label={t("window.close")}
          className="bg-[var(--color-window-close)]"
          onClick={() => void win.close()}
        />
        <WindowControl
          label={t("window.minimize")}
          className="bg-[var(--color-window-minimize)]"
          onClick={() => void win.minimize()}
        />
        <WindowControl
          label={t("window.maximize")}
          className="bg-[var(--color-window-maximize)]"
          onClick={() => void win.toggleMaximize()}
        />
      </div>
      {onToggleSidebar ? (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onToggleSidebar}
          title={sidebarToggleLabel}
          aria-label={sidebarToggleLabel}
          className={cn(iconButton({ size: "sm" }), "ml-0.5")}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}
      {sidebarCollapsed && title ? (
        <div className="ml-3 flex min-w-0 items-center gap-2 text-xs">
          <span className="max-w-[34vw] truncate font-medium text-text">
            {title}
          </span>
          {subtitle ? (
            <span className="max-w-40 truncate text-text-subtle">
              {subtitle}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className="h-full flex-1"
        data-tauri-drag-region
      />
    </div>
  );
}

function WindowControl({
  label,
  className,
  onClick,
}: {
  label: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={cn(
        "h-3 w-3 rounded-full border border-[var(--color-window-control-border)]",
        "shadow-[inset_0_0_0_0.5px_rgb(255_255_255_/_0.22)]",
        "transition duration-100 brightness-100 hover:brightness-110 active:brightness-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40",
        className,
      )}
    />
  );
}

function parentDir(relPath: string): string {
  const i = relPath.lastIndexOf("/");
  return i < 0 ? "" : relPath.slice(0, i);
}

function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

function titleFromPath(path: string | null): string {
  if (!path) return "Munix";
  const slashIdx = path.lastIndexOf("/");
  const name = slashIdx < 0 ? path : path.slice(slashIdx + 1);
  return name.replace(/\.md$/i, "");
}

function getMoveTarget(
  fromPath: string,
  toFolderPath: string,
): {
  name: string;
  newRel: string;
} {
  const slashIdx = fromPath.lastIndexOf("/");
  const name = slashIdx < 0 ? fromPath : fromPath.slice(slashIdx + 1);
  const newRel = toFolderPath ? `${toFolderPath}/${name}` : name;
  return { name, newRel };
}

function isMoveIntoOwnDescendant(
  fromPath: string,
  toFolderPath: string,
): boolean {
  return toFolderPath === fromPath || toFolderPath.startsWith(`${fromPath}/`);
}

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
  const [revealPath, setRevealPath] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("munix:sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });
  const [quickOpen, setQuickOpen] = useState(false);
  const [vaultSwitcherOpen, setVaultSwitcherOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("munix:sidebarWidth");
      if (saved) {
        const n = Number(saved);
        if (!Number.isNaN(n) && n >= 160 && n <= 600) return n;
      }
    } catch {
      // ignore
    }
    return 256;
  });

  useEffect(() => {
    try {
      localStorage.setItem("munix:sidebarWidth", String(sidebarWidth));
    } catch {
      // ignore
    }
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "munix:sidebarCollapsed",
        sidebarCollapsed ? "true" : "false",
      );
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useVaultWatcher();

  // 최초 마운트 시 자동 reopen 은 main.tsx 의 bootstrapVaultRegistry 가 담당
  // (ADR-032). 여기선 별도 처리 안 함.

  // vault 변경 시 최근 파일 로드 + 속성 타입 로드.
  // 부팅 bootstrap 중에는 workspace hydrate 가 먼저 끝나고 legacy vault-store
  // info 가 뒤늦게 채워질 수 있다. 이 사이의 info=null 상태에서 resetTabs 를
  // 호출하면 `.munix/workspace.json` 에서 복원한 탭을 지워버린다.
  useEffect(() => {
    if (!info) {
      if (!activeVaultId) resetTabs();
      useRecentStore.getState().setVault(null);
    } else {
      useRecentStore.getState().setVault(info.root);
      // property types (.obsidian/types.json) 로드 — 실패해도 조용히
      void usePropertyTypesStore
        .getState()
        .load()
        .catch(() => undefined);
    }
  }, [activeVaultId, info, resetTabs]);

  useEffect(() => {
    const onReveal = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string }>).detail;
      if (!detail?.path) return;
      setSidebarCollapsed(false);
      setSidebarTab("files");
      setRevealPath(detail.path);
    };
    window.addEventListener("munix:reveal-file-tree", onReveal);
    return () => {
      window.removeEventListener("munix:reveal-file-tree", onReveal);
    };
  }, []);

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
    [info, files, refreshFiles, openTab, promoteActiveEmptyTab],
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
    [info, files, refreshFiles],
  );

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
            void (async () => {
              const selected = await open({
                directory: true,
                multiple: false,
              });
              if (typeof selected === "string") await openVault(selected);
            })();
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
    openVault,
  ]);

  const handlePickFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await openVault(selected);
    }
  };

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
        <CustomTitleBar />
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
      <CustomTitleBar
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
        {sidebarCollapsed ? (
          null
        ) : (
          <>
            <aside
              style={{ width: sidebarWidth }}
              className="munix-sidebar-surface flex shrink-0 flex-col gap-6 bg-sidebar px-2 pb-2 pt-11"
            >
              <VaultDock onOpenSwitcher={() => setVaultSwitcherOpen(true)} />
              <div className="grid h-8 grid-cols-[auto_1fr_auto] items-center gap-2">
                <div
                  className="flex h-7 items-center gap-0.5 rounded-lg bg-sidebar-item-bg p-0.5"
                  role="tablist"
                  aria-label={t("sidebar.label", "Sidebar")}
                >
                  <SidebarTabButton
                    icon={Files}
                    label={t("sidebar.files")}
                    active={sidebarTab === "files"}
                    onClick={() => setSidebarTab("files")}
                  />
                  <SidebarTabButton
                    icon={Search}
                    label={t("sidebar.search")}
                    active={sidebarTab === "search"}
                    onClick={() => setSidebarTab("search")}
                  />
                  <SidebarTabButton
                    icon={List}
                    label={t("sidebar.outline")}
                    active={sidebarTab === "outline"}
                    onClick={() => setSidebarTab("outline")}
                  />
                  <SidebarTabButton
                    icon={Hash}
                    label={t("sidebar.tags")}
                    active={sidebarTab === "tags"}
                    onClick={() => setSidebarTab("tags")}
                  />
                </div>
                <h2 className="min-w-0 truncate text-sm font-medium leading-none text-sidebar-text">
                  {sidebarTitle}
                </h2>
                {sidebarTab === "files" && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => void handleCreateFileAt("")}
                      title={t("header.newFile")}
                      aria-label={t("header.newFile")}
                      className={iconButton({ size: "sm" })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCreateFolderAt("")}
                      title={t("header.newFolder")}
                      aria-label={t("header.newFolder")}
                      className={iconButton({ size: "sm" })}
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-sidebar-item-bg/70 py-1">
                {sidebarTab === "files" ? (
                  <nav className="flex min-h-0 flex-1 flex-col">
                    <FileList
                      files={files}
                      currentPath={currentPath}
                      onSelect={(relPath) => openTab(relPath)}
                      onAction={handleAction}
                      onMove={(from, to) => void handleMove(from, to)}
                      onMoveMany={(from, to) => void handleMoveMany(from, to)}
                      onDeleteMany={handleDeleteMany}
                      renaming={renaming}
                      revealPath={revealPath}
                      onRenameSubmit={(node, name) =>
                        void handleRenameSubmit(node, name)
                      }
                      onRenameCancel={() => setRenaming(null)}
                    />
                  </nav>
                ) : sidebarTab === "search" ? (
                  <SearchPanel
                    onSelect={(hit, query) => {
                      useEditorStore.getState().setPendingSearchQuery(query);
                      if (hit.matchedLine > 0) {
                        useEditorStore
                          .getState()
                          .setPendingJumpLine(hit.matchedLine);
                      }
                      openTab(hit.path);
                    }}
                  />
                ) : sidebarTab === "outline" ? (
                  <div className="munix-sidebar-scroll flex-1 overflow-y-auto">
                    <OutlinePanel />
                  </div>
                ) : (
                  <div className="munix-sidebar-scroll flex-1 overflow-y-auto">
                    <TagPanel />
                  </div>
                )}
              </div>
              <div className="flex h-8 shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  title={t("sidebar.settings")}
                  aria-label={t("sidebar.settings")}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[15px] font-medium",
                    "text-sidebar-text-muted transition-colors hover:bg-sidebar-item-hovered hover:text-sidebar-text",
                  )}
                >
                  <Settings className="h-5 w-5 shrink-0" />
                  <span>{t("sidebar.settings")}</span>
                </button>
              </div>
            </aside>

            <SidebarResizer
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
              min={180}
              max={560}
            />
          </>
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

function dedupeNestedPaths(paths: string[]): string[] {
  const sorted = [...new Set(paths)].sort((a, b) => a.length - b.length);
  const result: string[] = [];
  for (const path of sorted) {
    if (result.some((parent) => path.startsWith(`${parent}/`))) continue;
    result.push(path);
  }
  return result;
}

function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

function uniqueName(
  files: FileNode[],
  parent: string,
  base: string,
  ext: string,
): string {
  const existing = new Set<string>();
  const collect = (nodes: FileNode[]) => {
    for (const n of nodes) {
      if (parentDir(n.path) === parent) existing.add(n.name);
      if (n.children) collect(n.children);
    }
  };
  collect(files);
  let name = `${base}${ext}`;
  let i = 2;
  while (existing.has(name)) {
    name = `${base} ${i}${ext}`;
    i += 1;
  }
  return name;
}

function WorkspaceHeader({
  title,
  subtitle,
  onQuickOpen,
  onNewFile,
}: {
  title: string;
  subtitle: string;
  onQuickOpen: () => void;
  onNewFile: () => void;
}) {
  const { t } = useTranslation("app");

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-workspace px-3"
      data-tauri-drag-region
      onMouseDown={startWindowDrag}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
        <span className="min-w-0 truncate font-medium text-text">{title}</span>
        <span className="shrink-0 text-text-subtle">{subtitle}</span>
      </div>
      <div
        className="flex shrink-0 items-center gap-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onQuickOpen}
          title={t("workspace.quickOpen")}
          aria-label={t("workspace.quickOpen")}
          className={iconButton({ size: "sm" })}
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onNewFile}
          title={t("header.newFile")}
          aria-label={t("header.newFile")}
          className={iconButton({ size: "sm" })}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={t("workspace.more")}
          aria-label={t("workspace.more")}
          className={iconButton({ size: "sm" })}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SidebarTabButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: typeof Files;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-sidebar-item-selected text-sidebar-text shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.08)]"
          : "text-sidebar-text-muted hover:bg-sidebar-item-hovered hover:text-sidebar-text",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export default App;
