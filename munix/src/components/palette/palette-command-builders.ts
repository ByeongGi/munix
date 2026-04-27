import type { TFunction } from "i18next";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Command,
  FilePlus,
  Files,
  FolderOpen,
  FolderPlus,
  Monitor,
  Moon,
  PanelLeftClose,
  RotateCcw,
  Rows2,
  Save,
  Search,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  X,
} from "lucide-react";

import { ipc } from "@/lib/ipc";
import { closeActivePane, splitActivePane } from "@/lib/workspace-commands";
import { useEditorStore } from "@/store/editor-store";
import { useTabStore } from "@/store/tab-store";
import { useThemeStore } from "@/store/theme-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import type { PaletteCommand } from "./palette-command-types";

interface PaletteCommandBuilderContext {
  t: TFunction<["palette", "common"]>;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onPickVault: () => void;
  onSwitchSidebar: (tab: "files" | "search") => void;
  onShowShortcuts: () => void;
  onOpenSettings: () => void;
}

export function createPaletteCommands({
  t,
  onClose,
  onNewFile,
  onNewFolder,
  onPickVault,
  onSwitchSidebar,
  onShowShortcuts,
  onOpenSettings,
}: PaletteCommandBuilderContext): PaletteCommand[] {
  return [
    {
      id: "new-file",
      title: t("palette:commands.newFile.title"),
      icon: FilePlus,
      shortcut: "⌘T",
      keywords: ["new", "file", "note"],
      run: () => {
        onClose();
        onNewFile();
      },
    },
    {
      id: "new-folder",
      title: t("palette:commands.newFolder.title"),
      icon: FolderPlus,
      keywords: ["new", "folder", "directory"],
      run: () => {
        onClose();
        onNewFolder();
      },
    },
    {
      id: "save",
      title: t("palette:commands.save.title"),
      icon: Save,
      shortcut: "⌘S",
      keywords: ["save"],
      run: () => {
        onClose();
        const flush = useEditorStore.getState().flushSave;
        if (flush) void flush();
      },
    },
    {
      id: "close-tab",
      title: t("palette:commands.closeTab.title"),
      icon: X,
      shortcut: "⌘W",
      keywords: ["close", "tab"],
      run: () => {
        onClose();
        const { activeId, closeTab } = useTabStore.getState();
        if (activeId) closeTab(activeId);
      },
    },
    {
      id: "close-all-tabs",
      title: t("palette:commands.closeAllTabs.title"),
      icon: X,
      shortcut: "⌘⇧W",
      keywords: ["close", "all", "tab"],
      run: () => {
        onClose();
        useTabStore.getState().closeAll();
      },
    },
    {
      id: "next-tab",
      title: t("palette:commands.nextTab.title"),
      icon: ChevronRight,
      shortcut: "⌘⇧]",
      keywords: ["next", "tab"],
      run: () => {
        onClose();
        useTabStore.getState().activateNext();
      },
    },
    {
      id: "prev-tab",
      title: t("palette:commands.prevTab.title"),
      icon: ChevronLeft,
      shortcut: "⌘⇧[",
      keywords: ["prev", "tab"],
      run: () => {
        onClose();
        useTabStore.getState().activatePrev();
      },
    },
    {
      id: "sidebar-files",
      title: t("palette:commands.sidebarFiles.title"),
      icon: Files,
      keywords: ["sidebar", "tree", "file"],
      run: () => {
        onClose();
        onSwitchSidebar("files");
      },
    },
    {
      id: "sidebar-search",
      title: t("palette:commands.sidebarSearch.title"),
      icon: Search,
      shortcut: "⌘⇧F",
      keywords: ["sidebar", "search"],
      run: () => {
        onClose();
        onSwitchSidebar("search");
      },
    },
    {
      id: "pick-vault",
      title: t("palette:commands.pickVault.title"),
      icon: FolderOpen,
      keywords: ["vault", "open", "folder"],
      run: () => {
        onClose();
        onPickVault();
      },
    },
    {
      id: "theme-system",
      title: t("palette:commands.themeSystem.title"),
      icon: Monitor,
      keywords: ["theme", "system", "auto"],
      run: () => {
        onClose();
        useThemeStore.getState().set("system");
      },
    },
    {
      id: "theme-light",
      title: t("palette:commands.themeLight.title"),
      icon: Sun,
      keywords: ["theme", "light"],
      run: () => {
        onClose();
        useThemeStore.getState().set("light");
      },
    },
    {
      id: "theme-dark",
      title: t("palette:commands.themeDark.title"),
      icon: Moon,
      keywords: ["theme", "dark"],
      run: () => {
        onClose();
        useThemeStore.getState().set("dark");
      },
    },
    {
      id: "shortcuts",
      title: t("palette:commands.shortcuts.title"),
      icon: Command,
      shortcut: "⌘/",
      keywords: ["help", "shortcut", "keyboard"],
      run: () => {
        onClose();
        onShowShortcuts();
      },
    },
    {
      id: "settings",
      title: t("palette:commands.settings.title"),
      icon: SettingsIcon,
      shortcut: "⌘,",
      keywords: ["settings", "preferences"],
      run: () => {
        onClose();
        onOpenSettings();
      },
    },
    {
      id: "workspace-split-right",
      title: t("palette:commands.workspaceSplitRight.title"),
      icon: Columns2,
      shortcut: "⌘\\",
      keywords: ["split", "right", "pane", "분할", "오른쪽"],
      run: () => {
        onClose();
        splitActivePane("right");
      },
    },
    {
      id: "workspace-split-down",
      title: t("palette:commands.workspaceSplitDown.title"),
      icon: Rows2,
      shortcut: "⌘⇧\\",
      keywords: ["split", "down", "pane", "분할", "아래"],
      run: () => {
        onClose();
        splitActivePane("bottom");
      },
    },
    {
      id: "workspace-close-pane",
      title: t("palette:commands.workspaceClosePane.title"),
      icon: PanelLeftClose,
      shortcut: "⌘⌥⇧W",
      keywords: ["close", "pane", "패널", "닫기"],
      run: () => {
        onClose();
        closeActivePane();
      },
    },
    {
      id: "vault-reset-history",
      title: t("palette:commands.vaultResetHistory.title"),
      icon: Trash2,
      keywords: ["vault", "history", "clear", "reset", "닫힌"],
      run: () => {
        onClose();
        void ipc.vaultRegistryClearClosed();
      },
    },
    {
      id: "vault-reset-all",
      title: t("palette:commands.vaultResetAll.title"),
      icon: RotateCcw,
      keywords: ["vault", "reset", "registry", "all", "초기화"],
      run: () => {
        onClose();
        void (async () => {
          const ok = window.confirm(
            t("palette:commands.vaultResetAll.confirm"),
          );
          if (!ok) return;

          const dock = useVaultDockStore.getState();
          const ids = dock.vaults.map((vault) => vault.id);
          for (const id of ids) {
            try {
              await dock.closeVault(id);
            } catch {
              // ignore
            }
          }
          await ipc.vaultRegistryClear();
        })();
      },
    },
  ];
}
