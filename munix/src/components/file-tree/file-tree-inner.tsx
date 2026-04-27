import {
  ChevronDown,
  ChevronRight,
  FileText,
  File as FileIcon,
  Folder,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { FileNode } from "@/types/ipc";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { cn } from "@/lib/cn";
import { collectPanes } from "@/store/workspace-types";
import { readFileDragPaths } from "./dnd";
import { RenameInput } from "./rename-input";
import { DND_MIME } from "./types";
import type { FlatNode } from "./flatten";

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
  const isMd = !isDir && /\.md$/i.test(node.name);
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
  const isDisabledFile = !isDir && !isMd;
  const isDragTarget = isDir && dragOverPath === node.path;

  // 폴더면 자기 자신, 파일이면 자신의 부모 폴더
  const targetFolderForDrop = isDir
    ? node.path
    : node.path.includes("/")
      ? node.path.substring(0, node.path.lastIndexOf("/"))
      : "";

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    const paths =
      selectedPaths.has(node.path) && selectedPaths.size > 1
        ? [...selectedPaths]
        : [node.path];
    e.dataTransfer.setData(DND_MIME, JSON.stringify({ paths }));
    // text/plain 폴백 — 일부 WebView에서 custom MIME만 있을 때 dragover types 비공개일 가능성 대비
    e.dataTransfer.setData("text/plain", paths[0] ?? node.path);
    e.dataTransfer.effectAllowed = "move";
    const preview = buildDragPreview(paths);
    if (preview) {
      e.dataTransfer.setDragImage(preview, 12, 12);
      window.requestAnimationFrame(() => preview.remove());
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.dataTransfer.dropEffect === "none") setDragOverRoot(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (targetFolderForDrop === "") {
      // root 영역 강조
      if (dragOverPath !== null) setDragOverPath(null);
      setDragOverRoot(true);
    } else {
      if (dragOverPath !== targetFolderForDrop) {
        setDragOverPath(targetFolderForDrop);
      }
      setDragOverRoot(false);
    }
    // 닫힌 폴더 위에 700ms 머무르면 자동 펼침
    if (isDir && !isOpen) {
      if (expandTimerRef.current?.path !== node.path) {
        if (expandTimerRef.current) {
          window.clearTimeout(expandTimerRef.current.id);
        }
        const path = node.path;
        expandTimerRef.current = {
          path,
          id: window.setTimeout(() => {
            expandFolder(path);
            expandTimerRef.current = null;
          }, 700),
        };
      }
    } else if (expandTimerRef.current) {
      window.clearTimeout(expandTimerRef.current.id);
      expandTimerRef.current = null;
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) {
      return;
    }
    if (dragOverPath === targetFolderForDrop) setDragOverPath(null);
    if (expandTimerRef.current) {
      window.clearTimeout(expandTimerRef.current.id);
      expandTimerRef.current = null;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    setDragOverRoot(false);
    if (expandTimerRef.current) {
      window.clearTimeout(expandTimerRef.current.id);
      expandTimerRef.current = null;
    }
    const paths = readFileDragPaths(e.dataTransfer);
    if (paths.length === 0) return;
    const target = targetFolderForDrop;
    const movable = paths.filter(
      (src) =>
        src !== node.path && target !== src && !target.startsWith(`${src}/`),
    );
    if (movable.length === 0) return;
    const changed = movable.filter((src) => {
      const srcParent = src.includes("/")
        ? src.substring(0, src.lastIndexOf("/"))
        : "";
      return srcParent !== target;
    });
    if (changed.length === 0) return;
    if (changed.length === 1) onMove(changed[0]!, target);
    else onMoveMany(changed, target);
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (isRenaming) return;
    onRowClick(e, node);
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;
    if (isDir) toggleFolder(node.path);
    else if (isMd) onSelect(node.path);
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
        (isDir || isMd) && !isRenaming && "cursor-pointer",
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

function buildDragPreview(paths: string[]): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const preview = document.createElement("div");
  preview.setAttribute("aria-hidden", "true");
  preview.className =
    "fixed -left-[9999px] -top-[9999px] flex items-center gap-2 rounded-md border px-3 py-2 shadow-lg";
  preview.style.border = "1px solid var(--color-border-primary)";
  preview.style.background = "var(--color-bg-secondary)";
  preview.style.color = "var(--color-text-primary)";
  preview.style.fontSize = "12px";
  preview.style.lineHeight = "1.2";
  preview.style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.35)";

  const icon = document.createElement("div");
  icon.textContent = "↕";
  icon.style.display = "flex";
  icon.style.alignItems = "center";
  icon.style.justifyContent = "center";
  icon.style.width = "20px";
  icon.style.height = "20px";
  icon.style.borderRadius = "9999px";
  icon.style.background = "var(--color-bg-hover)";
  icon.style.color = "var(--color-accent)";
  icon.style.fontSize = "11px";
  icon.style.flex = "0 0 auto";

  const text = document.createElement("div");
  text.style.display = "flex";
  text.style.flexDirection = "column";
  text.style.gap = "2px";

  const title = document.createElement("div");
  title.textContent = basename(paths[0] ?? "");
  title.style.fontWeight = "600";
  title.style.maxWidth = "240px";
  title.style.whiteSpace = "nowrap";
  title.style.overflow = "hidden";
  title.style.textOverflow = "ellipsis";

  const count = document.createElement("div");
  const lang =
    document.documentElement.lang ||
    (typeof navigator !== "undefined" ? navigator.language : "en");
  const isKo = /^ko\b/i.test(lang);
  count.textContent =
    paths.length === 1
      ? isKo
        ? "이동"
        : "Move"
      : isKo
        ? `${paths.length}개 항목`
        : `${paths.length} items`;
  count.style.color = "var(--color-text-tertiary)";
  count.style.fontSize = "11px";

  text.appendChild(title);
  text.appendChild(count);
  preview.appendChild(icon);
  preview.appendChild(text);
  document.body.appendChild(preview);
  return preview;
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}
