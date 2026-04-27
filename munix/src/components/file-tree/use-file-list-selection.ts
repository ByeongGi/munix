import { useCallback, useEffect, useMemo, useState } from "react";
import type { FileNode } from "@/types/ipc";
import type { FlatNode } from "./flatten";

interface UseFileListSelectionOptions {
  flat: FlatNode[];
  revealPath: string | null;
}

export function useFileListSelection({
  flat,
  revealPath,
}: UseFileListSelectionOptions) {
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);

  useEffect(() => {
    if (!revealPath) return;
    setSelectedPaths(new Set([revealPath]));
    setFocusedPath(revealPath);
    setSelectionAnchor(revealPath);
  }, [revealPath]);

  const selectedNodes = useMemo(() => {
    const selected = new Set(selectedPaths);
    const nodes: FileNode[] = [];
    for (const item of flat) {
      if (selected.has(item.node.path)) nodes.push(item.node);
    }
    return nodes;
  }, [flat, selectedPaths]);

  useEffect(() => {
    if (!focusedPath) return;
    if (!flat.some((f) => f.node.path === focusedPath)) {
      setFocusedPath(flat[0]?.node.path ?? null);
    }
  }, [flat, focusedPath]);

  const selectRange = useCallback(
    (fromPath: string, toPath: string) => {
      const from = flat.findIndex((f) => f.node.path === fromPath);
      const to = flat.findIndex((f) => f.node.path === toPath);
      if (from < 0 || to < 0) {
        setSelectedPaths(new Set([toPath]));
        return;
      }
      const [start, end] = from < to ? [from, to] : [to, from];
      setSelectedPaths(
        new Set(flat.slice(start, end + 1).map((f) => f.node.path)),
      );
    },
    [flat],
  );

  const handleRowClick = useCallback(
    (e: React.MouseEvent, node: FileNode) => {
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
    },
    [focusedPath, selectRange, selectionAnchor],
  );

  return {
    focusedPath,
    setFocusedPath,
    selectedPaths,
    setSelectedPaths,
    selectionAnchor,
    setSelectionAnchor,
    selectedNodes,
    handleRowClick,
  };
}
