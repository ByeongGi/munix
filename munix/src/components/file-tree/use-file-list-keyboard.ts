import { useCallback, type KeyboardEvent } from "react";
import type { FileNode } from "@/types/ipc";
import type { FlatNode } from "./flatten";
import type { Action } from "./types";

interface UseFileListKeyboardOptions {
  flat: FlatNode[];
  focusedPath: string | null;
  setFocusedPath: (path: string | null) => void;
  selectedPaths: Set<string>;
  setSelectedPaths: (paths: Set<string>) => void;
  setSelectionAnchor: (path: string | null) => void;
  selectedNodes: FileNode[];
  expanded: Set<string>;
  toggleFolder: (path: string) => void;
  renaming: string | null;
  onSelect: (path: string) => void;
  onAction: (action: Action, node: FileNode) => void;
  onDeleteMany: (nodes: FileNode[]) => void;
}

export function useFileListKeyboard({
  flat,
  focusedPath,
  setFocusedPath,
  selectedPaths,
  setSelectedPaths,
  setSelectionAnchor,
  selectedNodes,
  expanded,
  toggleFolder,
  renaming,
  onSelect,
  onAction,
  onDeleteMany,
}: UseFileListKeyboardOptions) {
  const moveFocus = useCallback(
    (delta: number) => {
      if (flat.length === 0) return;
      const curIdx = Math.max(
        0,
        flat.findIndex((f) => f.node.path === focusedPath),
      );
      const nextIdx = Math.min(flat.length - 1, Math.max(0, curIdx + delta));
      const next = flat[nextIdx];
      if (next) setFocusedPath(next.node.path);
    },
    [flat, focusedPath, setFocusedPath],
  );

  return useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (renaming) return;
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
              if (next && next.parentPath === node.path) {
                setFocusedPath(next.node.path);
              }
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
          else if (/\.md$/i.test(node.name)) onSelect(node.path);
          return;
        case "F2":
          e.preventDefault();
          if (selectedPaths.size <= 1) onAction("rename", node);
          return;
        case "Escape":
          e.preventDefault();
          setSelectedPaths(new Set(node ? [node.path] : []));
          setSelectionAnchor(node?.path ?? null);
          return;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          if (selectedNodes.length > 1) onDeleteMany(selectedNodes);
          else onAction("delete", node);
          return;
        default:
          return;
      }
    },
    [
      expanded,
      flat,
      focusedPath,
      moveFocus,
      onAction,
      onDeleteMany,
      onSelect,
      renaming,
      selectedNodes,
      selectedPaths.size,
      setFocusedPath,
      setSelectedPaths,
      setSelectionAnchor,
      toggleFolder,
    ],
  );
}
