import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { FileNode } from "@/types/ipc";
import { cn } from "@/lib/cn";
import { ContextMenu } from "./context-menu";
import { readFileDragPaths } from "./dnd";
import { FlatTreeRow } from "./file-tree-inner";
import { flatten } from "./flatten";
import { type Action, type ContextMenuState, type FileListProps } from "./types";

export function FileList(props: FileListProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const expandTimerRef = useRef<{ path: string; id: number } | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

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

  const toggleFolder = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandFolder = useCallback((path: string) => {
    setExpanded((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!props.revealPath) return;
    const ancestors: string[] = [];
    const parts = props.revealPath.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      ancestors.push(parts.slice(0, i).join("/"));
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const path of ancestors) next.add(path);
      return next;
    });
    setSelectedPaths(new Set([props.revealPath]));
    setFocusedPath(props.revealPath);
    setSelectionAnchor(props.revealPath);
  }, [props.revealPath]);

  const flat = useMemo(
    () => flatten(props.files, expanded),
    [props.files, expanded],
  );

  const selectedNodes = useMemo(() => {
    const selected = new Set(selectedPaths);
    const nodes: FileNode[] = [];
    for (const item of flat) {
      if (selected.has(item.node.path)) nodes.push(item.node);
    }
    return nodes;
  }, [flat, selectedPaths]);

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
    [selectedPaths],
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

  // 포커스 경로가 보이지 않게 되면 가까운 조상으로 이동
  useEffect(() => {
    if (!focusedPath) return;
    if (!flat.some((f) => f.node.path === focusedPath)) {
      setFocusedPath(flat[0]?.node.path ?? null);
    }
  }, [flat, focusedPath]);

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

  const moveFocus = (delta: number) => {
    if (flat.length === 0) return;
    const curIdx = Math.max(
      0,
      flat.findIndex((f) => f.node.path === focusedPath),
    );
    const nextIdx = Math.min(flat.length - 1, Math.max(0, curIdx + delta));
    const next = flat[nextIdx];
    if (next) setFocusedPath(next.node.path);
  };

  const selectRange = (fromPath: string, toPath: string) => {
    const from = flat.findIndex((f) => f.node.path === fromPath);
    const to = flat.findIndex((f) => f.node.path === toPath);
    if (from < 0 || to < 0) {
      setSelectedPaths(new Set([toPath]));
      return;
    }
    const [start, end] = from < to ? [from, to] : [to, from];
    setSelectedPaths(new Set(flat.slice(start, end + 1).map((f) => f.node.path)));
  };

  const handleRowClick = (e: React.MouseEvent, node: FileNode) => {
    setFocusedPath(node.path);
    if (e.shiftKey) {
      selectRange(selectionAnchor ?? focusedPath ?? node.path, node.path);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next.size > 0 ? next : new Set([node.path]);
      });
      setSelectionAnchor(node.path);
      return;
    }
    setSelectedPaths(new Set([node.path]));
    setSelectionAnchor(node.path);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (props.renaming) return; // rename 중엔 RenameInput이 키 처리
    if (flat.length === 0) return;

    const focused = flat.find((f) => f.node.path === focusedPath) ?? flat[0];
    if (!focused) return;
    const { node, parentPath } = focused;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!focusedPath) setFocusedPath(flat[0]?.node.path ?? null);
        else moveFocus(1);
        return;
      case "ArrowUp":
        e.preventDefault();
        if (!focusedPath) setFocusedPath(flat[0]?.node.path ?? null);
        else moveFocus(-1);
        return;
      case "ArrowRight":
        e.preventDefault();
        if (node.kind === "directory") {
          if (!expanded.has(node.path)) toggleFolder(node.path);
          else {
            const next =
              flat[flat.findIndex((f) => f.node.path === node.path) + 1];
            if (next && next.parentPath === node.path)
              setFocusedPath(next.node.path);
          }
        }
        return;
      case "ArrowLeft":
        e.preventDefault();
        if (node.kind === "directory" && expanded.has(node.path)) {
          toggleFolder(node.path);
        } else if (parentPath) {
          setFocusedPath(parentPath);
        }
        return;
      case "Enter":
        e.preventDefault();
        if (node.kind === "directory") toggleFolder(node.path);
        else if (/\.md$/i.test(node.name)) props.onSelect(node.path);
        return;
      case "F2":
        e.preventDefault();
        if (selectedPaths.size <= 1) props.onAction("rename", node);
        return;
      case "Escape":
        e.preventDefault();
        setSelectedPaths(new Set(node ? [node.path] : []));
        setSelectionAnchor(node?.path ?? null);
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        if (selectedNodes.length > 1) props.onDeleteMany(selectedNodes);
        else props.onAction("delete", node);
        return;
      default:
        return;
    }
  };

  // root 드롭은 "트리의 빈 영역" 전용. 개별 행이 stopPropagation 하므로 여기 도달하면 빈 영역.
  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragOverRoot) {
      setDragOverRoot(true);
    }
  };
  const handleRootDragLeave = (e: React.DragEvent) => {
    // 컨테이너 밖으로 나갈 때만
    const related = e.relatedTarget as Node | null;
    if (related && containerRef.current?.contains(related)) return;
    setDragOverRoot(false);
  };
  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRoot(false);
    const paths = readFileDragPaths(e.dataTransfer);
    if (paths.length === 0) return;
    const movable = paths.filter((src) => src.includes("/"));
    if (movable.length === 0) return;
    if (movable.length === 1) props.onMove(movable[0]!, "");
    else props.onMoveMany(movable, "");
  };

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

function FileTreeEmptyPlaceholder() {
  const { t } = useTranslation("tree");

  return (
    <div className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
      {t("empty")}
    </div>
  );
}
