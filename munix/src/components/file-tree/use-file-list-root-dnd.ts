import { useCallback, useState } from "react";
import { readFileDragPaths } from "./dnd";

interface UseFileListRootDndOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onMove: (fromPath: string, toFolderPath: string) => void;
  onMoveMany: (fromPaths: string[], toFolderPath: string) => void;
}

export function useFileListRootDnd({
  containerRef,
  onMove,
  onMoveMany,
}: UseFileListRootDndOptions) {
  const [dragOverRoot, setDragOverRoot] = useState(false);

  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!dragOverRoot) {
        setDragOverRoot(true);
      }
    },
    [dragOverRoot],
  );

  const handleRootDragLeave = useCallback(
    (e: React.DragEvent) => {
      const related = e.relatedTarget as Node | null;
      if (related && containerRef.current?.contains(related)) return;
      setDragOverRoot(false);
    },
    [containerRef],
  );

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverRoot(false);
      const paths = readFileDragPaths(e.dataTransfer);
      if (paths.length === 0) return;
      const movable = paths.filter((src) => src.includes("/"));
      if (movable.length === 0) return;
      if (movable.length === 1) onMove(movable[0]!, "");
      else onMoveMany(movable, "");
    },
    [onMove, onMoveMany],
  );

  return {
    dragOverRoot,
    setDragOverRoot,
    handleRootDragOver,
    handleRootDragLeave,
    handleRootDrop,
  };
}
