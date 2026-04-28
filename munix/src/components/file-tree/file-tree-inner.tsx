import {
  ChevronDown,
  ChevronRight,
  FileText,
  File as FileIcon,
  Folder,
  Image as ImageIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { FileNode } from "@/types/ipc";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { cn } from "@/lib/cn";
import { isImagePath, isMarkdownPath, isOpenablePath } from "@/lib/file-kind";
import { collectPanes } from "@/store/workspace-types";
import { RenameInput } from "./rename-input";
import type { FlatNode } from "./flatten";
import { useFlatTreeRowDnd } from "./use-flat-tree-row-dnd";

export interface FlatTreeRowProps {
  item: FlatNode;
  currentPath: string | null;
  onSelect: (path: string) => void;
  onRowClick: (e: React.MouseEvent, node: FileNode) => void;
  onMove: (fromPath: string, toFolderPath: string) => void;
  onMoveMany: (fromPaths: string[], toFolderPath: string) => void;
  renaming: string | null;
  onRenameSubmit: (node: FileNode, newName: string) => void;
  onRenameCancel: () => void;
  expanded: Set<string>;
  toggleFolder: (path: string) => void;
  expandTimerRef: React.MutableRefObject<{ path: string; id: number } | null>;
  expandFolder: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  focusedPath: string | null;
  setFocusedPath: (p: string | null) => void;
  selectedPaths: Set<string>;
  dragOverPath: string | null;
  setDragOverPath: (p: string | null) => void;
  setDragOverRoot: (v: boolean) => void;
}

export function FlatTreeRow({
  item,
  currentPath,
  onSelect,
  onRowClick,
  onMove,
  onMoveMany,
  renaming,
  onRenameSubmit,
  onRenameCancel,
  expanded,
  toggleFolder,
  expandTimerRef,
  expandFolder,
  onContextMenu,
  focusedPath,
  setFocusedPath,
  selectedPaths,
  dragOverPath,
  setDragOverPath,
  setDragOverRoot,
}: FlatTreeRowProps) {
  const { t } = useTranslation("tree");
  const ws = useActiveWorkspaceStore();
  const { node, depth } = item;

  const isActive = node.kind === "file" && node.path === currentPath;
  const isSelected = selectedPaths.has(node.path);
  const isFocused = node.path === focusedPath;
  const isRenaming = renaming === node.path;
  const isDir = node.kind === "directory";
  const isOpen = isDir && expanded.has(node.path);
  const isMd = !isDir && isMarkdownPath(node.name);
  const isImage = !isDir && isImagePath(node.name);
  const isOpenable = !isDir && isOpenablePath(node.name);
  const titleDraft = useStore(ws, (s) => {
    if (!isMd) return undefined;
    const activeDraft = s.tabs.find(
      (tab) => tab.path === node.path,
    )?.titleDraft;
    if (activeDraft !== undefined) return activeDraft;
    for (const pane of collectPanes(s.workspaceTree)) {
      const draft = pane.tabs.find((tab) => tab.path === node.path)?.titleDraft;
      if (draft !== undefined) return draft;
    }
    return undefined;
  });
  const displayName =
    isMd && titleDraft !== undefined ? `${titleDraft}.md` : node.name;
  const isDisabledFile = !isDir && !isOpenable;
  const isDragTarget = isDir && dragOverPath === node.path;

  const {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFlatTreeRowDnd({
    nodePath: node.path,
    isDir,
    isOpen,
    selectedPaths,
    dragOverPath,
    setDragOverPath,
    setDragOverRoot,
    expandTimerRef,
    expandFolder,
    onMove,
    onMoveMany,
  });

  const handleRowClick = (e: React.MouseEvent) => {
    if (isRenaming) return;
    onRowClick(e, node);
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;
    if (isDir) toggleFolder(node.path);
    else if (isOpenable) onSelect(node.path);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => onContextMenu(e, node)}
      onMouseDown={() => setFocusedPath(node.path)}
      onClick={handleRowClick}
      role="button"
      aria-label={displayName}
      className={cn(
        "group mx-1 flex h-8 items-center gap-1.5 rounded-md px-2 text-[15px] select-none",
        "text-sidebar-tree-text hover:bg-sidebar-item-hovered hover:text-sidebar-text",
        (isDir || isOpenable) && !isRenaming && "cursor-pointer",
        isDisabledFile && "cursor-default",
        (isActive || isSelected) &&
          "bg-sidebar-item-selected text-sidebar-text [&_svg]:text-sidebar-text",
        isDisabledFile && "text-sidebar-text-subtle",
        isFocused && "ring-1 ring-inset ring-[var(--color-accent)]",
        isDragTarget &&
          "bg-[var(--color-accent-selection)] ring-2 ring-inset ring-[var(--color-accent)]",
      )}
      style={{
        paddingLeft: `${8 + depth * 12}px`,
      }}
    >
      {isDir ? (
        <span
          aria-hidden
          className="flex h-5 w-5 shrink-0 items-center justify-center text-sidebar-tree-icon"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      ) : (
        <span className="h-5 w-5 shrink-0" />
      )}

      {isDir ? (
        <Folder className="h-4 w-4 shrink-0 text-sidebar-tree-icon transition-colors group-hover:text-sidebar-text" />
      ) : isMd ? (
        <FileText className="h-4 w-4 shrink-0 text-sidebar-tree-icon transition-colors group-hover:text-sidebar-text" />
      ) : isImage ? (
        <ImageIcon className="h-4 w-4 shrink-0 text-sidebar-tree-icon transition-colors group-hover:text-sidebar-text" />
      ) : (
        <FileIcon className="h-4 w-4 shrink-0 opacity-60" />
      )}

      {isRenaming ? (
        <RenameInput
          initial={node.name}
          onSubmit={(name) => onRenameSubmit(node, name)}
          onCancel={onRenameCancel}
        />
      ) : (
        <span
          className={cn("flex-1 truncate text-left pointer-events-none")}
          title={isDisabledFile ? t("unsupportedFileType") : undefined}
        >
          {displayName}
        </span>
      )}
    </div>
  );
}
