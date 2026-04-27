import type { ComponentProps, Dispatch, SetStateAction } from "react";

import { EditorView } from "@/components/editor/editor-view";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import type { SidebarTab } from "@/components/app-shell/types";
import { AppTitleBar } from "@/components/app-shell/window-title-bar";
import { WorkspaceHeader } from "@/components/app-shell/workspace-header";
import { EmptyPanePlaceholder } from "@/components/workspace/pane/empty-pane-placeholder";
import { WorkspaceRoot } from "@/components/workspace/root/workspace-root";
import { StatusBar } from "@/components/status-bar";
import { TabBar } from "@/components/tab/tab-bar";
import { cn } from "@/lib/cn";
import { titleFromPath } from "@/lib/app-path-utils";
import type { FileNode, VaultInfo } from "@/types/ipc";

interface AppWorkspaceViewProps {
  info: VaultInfo;
  files: FileNode[];
  currentPath: string | null;
  renaming: string | null;
  revealPath: string | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  sidebarTab: SidebarTab;
  sidebarTitle: string;
  setSidebarTab: Dispatch<SetStateAction<SidebarTab>>;
  openTab: (path: string) => void;
  createEmptyTab: () => void;
  closeAllTabs: () => void;
  handleCreateFileAt: (parent: string) => Promise<void>;
  handleCreateFolderAt: (parent: string) => Promise<void>;
  handleAction: ComponentProps<typeof AppSidebar>["onFileAction"];
  handleMove: (fromPath: string, toFolderPath: string) => Promise<void>;
  handleMoveMany: (
    fromPaths: string[],
    toFolderPath: string,
  ) => Promise<void>;
  handleDeleteMany: ComponentProps<typeof AppSidebar>["onDeleteMany"];
  handleRenameSubmit: ComponentProps<typeof AppSidebar>["onRenameSubmit"];
  onRenameCancel: () => void;
  onOpenVaultSwitcher: () => void;
  onQuickOpen: () => void;
  onOpenSettings: () => void;
  onSearchSelect: ComponentProps<typeof AppSidebar>["onSearchSelect"];
}

export function AppWorkspaceView({
  info,
  files,
  currentPath,
  renaming,
  revealPath,
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarWidth,
  setSidebarWidth,
  sidebarTab,
  sidebarTitle,
  setSidebarTab,
  openTab,
  createEmptyTab,
  closeAllTabs,
  handleCreateFileAt,
  handleCreateFolderAt,
  handleAction,
  handleMove,
  handleMoveMany,
  handleDeleteMany,
  handleRenameSubmit,
  onRenameCancel,
  onOpenVaultSwitcher,
  onQuickOpen,
  onOpenSettings,
  onSearchSelect,
}: AppWorkspaceViewProps) {
  return (
    <>
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
            onOpenVaultSwitcher={onOpenVaultSwitcher}
            onSwitchTab={setSidebarTab}
            onCreateFile={() => void handleCreateFileAt("")}
            onCreateFolder={() => void handleCreateFolderAt("")}
            onSelectFile={openTab}
            onFileAction={handleAction}
            onMove={(from, to) => void handleMove(from, to)}
            onMoveMany={(from, to) => void handleMoveMany(from, to)}
            onDeleteMany={handleDeleteMany}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={onRenameCancel}
            onSearchSelect={onSearchSelect}
            onOpenSettings={onOpenSettings}
          />
        )}

        <section
          className={cn(
            "flex flex-1 flex-col overflow-hidden bg-workspace",
            !sidebarCollapsed &&
              "-ml-px rounded-l-xl border-l border-border shadow-[inset_1px_0_0_rgb(255_255_255_/_0.04)]",
          )}
        >
          {!sidebarCollapsed ? (
            <WorkspaceHeader
              title={titleFromPath(currentPath)}
              subtitle={info.name}
              onQuickOpen={onQuickOpen}
              onNewFile={() => void handleCreateFileAt("")}
            />
          ) : null}
          <WorkspaceRoot
            onNewFile={() => void handleCreateFileAt("")}
            onQuickOpen={onQuickOpen}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <TabBar onNewFile={() => createEmptyTab()} />
              {currentPath ? (
                <EditorView className="flex-1" />
              ) : (
                <EmptyPanePlaceholder
                  onNewFile={() => void handleCreateFileAt("")}
                  onQuickOpen={onQuickOpen}
                  onClose={closeAllTabs}
                />
              )}
            </div>
          </WorkspaceRoot>
          <StatusBar />
        </section>
      </div>
    </>
  );
}
