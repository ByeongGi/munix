import { useCallback } from "react";
import { buildDragPreview } from "./drag-preview";
import { readFileDragPaths } from "./dnd";
import { DND_MIME } from "./types";

interface UseFlatTreeRowDndOptions {
  nodePath: string;
  isDir: boolean;
  isOpen: boolean;
  selectedPaths: Set<string>;
  dragOverPath: string | null;
  setDragOverPath: (path: string | null) => void;
  setDragOverRoot: (value: boolean) => void;
  expandTimerRef: React.MutableRefObject<{ path: string; id: number } | null>;
  expandFolder: (path: string) => void;
  onMove: (fromPath: string, toFolderPath: string) => void;
  onMoveMany: (fromPaths: string[], toFolderPath: string) => void;
}

export function useFlatTreeRowDnd({
  nodePath,
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
}: UseFlatTreeRowDndOptions) {
  const targetFolderForDrop = isDir
    ? nodePath
    : nodePath.includes("/")
      ? nodePath.substring(0, nodePath.lastIndexOf("/"))
      : "";

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      const paths =
        selectedPaths.has(nodePath) && selectedPaths.size > 1
          ? [...selectedPaths]
          : [nodePath];
      e.dataTransfer.setData(DND_MIME, JSON.stringify({ paths }));
      e.dataTransfer.setData("text/plain", paths[0] ?? nodePath);
      e.dataTransfer.effectAllowed = "move";
      const preview = buildDragPreview(paths);
      if (preview) {
        e.dataTransfer.setDragImage(preview, 12, 12);
        window.requestAnimationFrame(() => preview.remove());
      }
    },
    [nodePath, selectedPaths],
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      if (e.dataTransfer.dropEffect === "none") setDragOverRoot(false);
    },
    [setDragOverRoot],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (targetFolderForDrop === "") {
        if (dragOverPath !== null) setDragOverPath(null);
        setDragOverRoot(true);
      } else {
        if (dragOverPath !== targetFolderForDrop) {
          setDragOverPath(targetFolderForDrop);
        }
        setDragOverRoot(false);
      }
      if (isDir && !isOpen) {
        if (expandTimerRef.current?.path !== nodePath) {
          if (expandTimerRef.current) {
            window.clearTimeout(expandTimerRef.current.id);
          }
          expandTimerRef.current = {
            path: nodePath,
            id: window.setTimeout(() => {
              expandFolder(nodePath);
              expandTimerRef.current = null;
            }, 700),
          };
        }
      } else if (expandTimerRef.current) {
        window.clearTimeout(expandTimerRef.current.id);
        expandTimerRef.current = null;
      }
    },
    [
      dragOverPath,
      expandFolder,
      expandTimerRef,
      isDir,
      isOpen,
      nodePath,
      setDragOverPath,
      setDragOverRoot,
      targetFolderForDrop,
    ],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
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
    },
    [dragOverPath, expandTimerRef, setDragOverPath, targetFolderForDrop],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
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
          src !== nodePath && target !== src && !target.startsWith(`${src}/`),
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
    },
    [
      expandTimerRef,
      nodePath,
      onMove,
      onMoveMany,
      setDragOverPath,
      setDragOverRoot,
      targetFolderForDrop,
    ],
  );

  return {
    targetFolderForDrop,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
