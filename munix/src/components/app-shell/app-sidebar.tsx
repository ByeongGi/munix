import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import {
  Files,
  FolderPlus,
  Hash,
  List,
  Plus,
  Search,
  Settings,
} from "lucide-react";

import { FileList } from "@/components/file-tree";
import { OutlinePanel } from "@/components/outline-panel";
import { SearchPanel } from "@/components/search-panel";
import { SidebarResizer } from "@/components/sidebar-resizer";
import { TagPanel } from "@/components/tag-panel";
import { VaultDock } from "@/components/vault-dock";
import { iconButton } from "@/lib/ui-variants";
import type { FileNode } from "@/types/ipc";
import { SidebarTabButton } from "./sidebar-tab-button";
import type { SidebarTab } from "./types";

interface AppSidebarProps {
  width: number;
  sidebarTab: SidebarTab;
  sidebarTitle: string;
  files: FileNode[];
  currentPath: string | null;
  renaming: string | null;
  revealPath: string | null;
  onWidthChange: (width: number) => void;
  onOpenVaultSwitcher: () => void;
  onSwitchTab: (tab: SidebarTab) => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onSelectFile: (relPath: string) => void;
  onFileAction: (
    action:
      | "new-file"
      | "new-folder"
      | "rename"
      | "delete"
      | "copy-path"
      | "reveal",
    node: FileNode,
  ) => void;
  onMove: (fromPath: string, toFolderPath: string) => void;
  onMoveMany: (fromPaths: string[], toFolderPath: string) => void;
  onDeleteMany: (nodes: FileNode[]) => void;
  onRenameSubmit: (node: FileNode, name: string) => void;
  onRenameCancel: () => void;
  onSearchSelect: ComponentProps<typeof SearchPanel>["onSelect"];
  onOpenSettings: () => void;
}

export function AppSidebar({
  width,
  sidebarTab,
  sidebarTitle,
  files,
  currentPath,
  renaming,
  revealPath,
  onWidthChange,
  onOpenVaultSwitcher,
  onSwitchTab,
  onCreateFile,
  onCreateFolder,
  onSelectFile,
  onFileAction,
  onMove,
  onMoveMany,
  onDeleteMany,
  onRenameSubmit,
  onRenameCancel,
  onSearchSelect,
  onOpenSettings,
}: AppSidebarProps) {
  const { t } = useTranslation("app");

  return (
    <>
      <aside
        style={{ width }}
        className="munix-sidebar-surface flex shrink-0 flex-col gap-6 bg-sidebar px-2 pb-2 pt-11"
      >
        <VaultDock onOpenSwitcher={onOpenVaultSwitcher} />
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
              onClick={() => onSwitchTab("files")}
            />
            <SidebarTabButton
              icon={Search}
              label={t("sidebar.search")}
              active={sidebarTab === "search"}
              onClick={() => onSwitchTab("search")}
            />
            <SidebarTabButton
              icon={List}
              label={t("sidebar.outline")}
              active={sidebarTab === "outline"}
              onClick={() => onSwitchTab("outline")}
            />
            <SidebarTabButton
              icon={Hash}
              label={t("sidebar.tags")}
              active={sidebarTab === "tags"}
              onClick={() => onSwitchTab("tags")}
            />
          </div>
          <h2 className="min-w-0 truncate text-sm font-medium leading-none text-sidebar-text">
            {sidebarTitle}
          </h2>
          {sidebarTab === "files" ? (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onCreateFile}
                title={t("header.newFile")}
                aria-label={t("header.newFile")}
                className={iconButton({ size: "sm" })}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onCreateFolder}
                title={t("header.newFolder")}
                aria-label={t("header.newFolder")}
                className={iconButton({ size: "sm" })}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-sidebar-item-bg/70 py-1">
          {sidebarTab === "files" ? (
            <nav className="flex min-h-0 flex-1 flex-col">
              <FileList
                files={files}
                currentPath={currentPath}
                onSelect={onSelectFile}
                onAction={onFileAction}
                onMove={onMove}
                onMoveMany={onMoveMany}
                onDeleteMany={onDeleteMany}
                renaming={renaming}
                revealPath={revealPath}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
              />
            </nav>
          ) : sidebarTab === "search" ? (
            <SearchPanel onSelect={onSearchSelect} />
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
            onClick={onOpenSettings}
            title={t("sidebar.settings")}
            aria-label={t("sidebar.settings")}
            className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[15px] font-medium text-sidebar-text-muted transition-colors hover:bg-sidebar-item-hovered hover:text-sidebar-text"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span>{t("sidebar.settings")}</span>
          </button>
        </div>
      </aside>

      <SidebarResizer
        width={width}
        onWidthChange={onWidthChange}
        min={180}
        max={560}
      />
    </>
  );
}
