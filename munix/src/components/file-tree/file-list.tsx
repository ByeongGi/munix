import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { FileNode } from "@/types/ipc";
import { cn } from "@/lib/cn";
import { ContextMenu } from "./context-menu";
import { FileTreeEmptyPlaceholder } from "./file-list-empty-placeholder";
import { FlatTreeRow } from "./file-tree-inner";
import { flatten } from "./flatten";
import {
  type Action,
  type ContextMenuState,
  type FileListProps,
} from "./types";
import { useFileListExpansion } from "./use-file-list-expansion";
import { useFileListKeyboard } from "./use-file-list-keyboard";
import { useFileListRootDnd } from "./use-file-list-root-dnd";
import { useFileListSelection } from "./use-file-list-selection";

export function FileList(props: FileListProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const expandTimerRef = useRef<{ path: string; id: number } | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const { expanded, setExpanded, toggleFolder, expandFolder } =
    useFileListExpansion(props.revealPath);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close, { once: true });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu]);

  const flat = useMemo(
    () => flatten(props.files, expanded),
    [props.files, expanded],
  );
  const {
    focusedPath,
    setFocusedPath,
    selectedPaths,
    setSelectedPaths,
    setSelectionAnchor,
    selectedNodes,
    handleRowClick,
  } = useFileListSelection({
    flat,
    revealPath: props.revealPath,
  });
  const {
    dragOverRoot,
    setDragOverRoot,
    handleRootDragOver,
    handleRootDragLeave,
    handleRootDrop,
  } = useFileListRootDnd({
    containerRef,
    onMove: props.onMove,
    onMoveMany: props.onMoveMany,
  });

  const openMenu = useCallback(
    (e: React.MouseEvent, node: FileNode) => {
      e.preventDefault();
      e.stopPropagation();
      const isSelected = selectedPaths.has(node.path);
      if (!isSelected) {
        setSelectedPaths(new Set([node.path]));
        setSelectionAnchor(node.path);
      }
      setFocusedPath(node.path);
      setMenu({
        x: e.clientX,
        y: e.clientY,
        node,
        selectedCount: isSelected ? selectedPaths.size : 1,
      });
    },
    [selectedPaths, setFocusedPath, setSelectedPaths, setSelectionAnchor],
  );

  const handleAction = (action: Action) => {
    if (!menu) return;
    const node = menu.node;
    setMenu(null);
    if (action === "new-file" || action === "new-folder") {
      if (node.kind === "directory") {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(node.path);
          return next;
        });
      }
    }
    if (action === "delete" && (menu.selectedCount ?? 0) > 1) {
      props.onDeleteMany(selectedNodes);
      return;
    }
    if (action === "copy-path" && (menu.selectedCount ?? 0) > 1) {
      void props.onAction(action, node);
      return;
    }
    props.onAction(action, node);
  };

  // rename 활성 시 해당 아이템 scrollIntoView
  useEffect(() => {
    if (!props.renaming) return;
    const idx = flat.findIndex((f) => f.node.path === props.renaming);
    if (idx >= 0) {
      virtuosoRef.current?.scrollToIndex({ index: idx, behavior: "smooth" });
    }
  }, [props.renaming, flat]);

  useEffect(() => {
    if (!props.revealPath) return;
    const idx = flat.findIndex((f) => f.node.path === props.revealPath);
    if (idx >= 0) {
      virtuosoRef.current?.scrollToIndex({ index: idx, behavior: "smooth" });
    }
  }, [props.revealPath, flat]);

  const onKeyDown = useFileListKeyboard({
    flat,
    focusedPath,
    setFocusedPath,
    selectedPaths,
    setSelectedPaths,
    setSelectionAnchor,
    selectedNodes,
    expanded,
    toggleFolder,
    renaming: props.renaming,
    onSelect: props.onSelect,
    onAction: props.onAction,
    onDeleteMany: props.onDeleteMany,
  });

  const commonRowProps = {
    currentPath: props.currentPath,
    onSelect: props.onSelect,
    onRowClick: handleRowClick,
    onMove: props.onMove,
    onMoveMany: props.onMoveMany,
    renaming: props.renaming,
    onRenameSubmit: props.onRenameSubmit,
    onRenameCancel: props.onRenameCancel,
    expanded,
    toggleFolder,
    expandTimerRef,
    expandFolder,
    onContextMenu: openMenu,
    focusedPath,
    setFocusedPath,
    selectedPaths,
    dragOverPath,
    setDragOverPath,
    setDragOverRoot,
  };

  return (
    <>
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        className={cn(
          "flex flex-col flex-1 min-h-0 outline-none transition-colors",
          dragOverRoot &&
            "bg-[var(--color-accent-muted)] ring-2 ring-inset ring-[var(--color-accent)]",
        )}
      >
        <Virtuoso
          ref={virtuosoRef}
          style={{ flex: 1, minHeight: 0 }}
          className="munix-sidebar-scroll"
          totalCount={flat.length}
          overscan={20}
          itemContent={(index) => {
            const item = flat[index];
            if (!item) return null;
            return (
              <FlatTreeRow
                key={item.node.path}
                item={item}
                {...commonRowProps}
              />
            );
          }}
          components={{
            EmptyPlaceholder: FileTreeEmptyPlaceholder,
          }}
        />
      </div>
      {menu && <ContextMenu menu={menu} onAction={handleAction} />}
    </>
  );
}
