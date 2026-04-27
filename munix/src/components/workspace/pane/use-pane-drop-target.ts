import { useCallback, useState, type CSSProperties, type DragEvent } from "react";

import { TAB_DND_MIME, parseTabPayload } from "@/lib/dnd-mime";
import type { DropZone } from "@/store/workspace-types";
import type { VaultId } from "@/store/vault-types";
import {
  classifyDropZone,
  dropZoneLabelKey,
  getDropZoneOverlayStyle,
  type EdgeZone,
} from "../dnd/drop-zone";

type MovePaneTab = (
  sourcePaneId: string,
  tabId: string,
  destPaneId: string,
  destIndex?: number,
) => void;

type SplitPaneMove = (
  sourcePaneId: string | null,
  tabId: string,
  targetPaneId: string | null,
  zone: EdgeZone,
) => void;

interface UsePaneDropTargetParams {
  movePaneTab: MovePaneTab;
  paneId: string;
  splitPaneMove: SplitPaneMove;
  t: (key: string) => string;
  vaultId: VaultId | null;
}

interface PaneDropTargetHandlers {
  onDragEnterCapture: (event: DragEvent<HTMLDivElement>) => void;
  onDragOverCapture: (event: DragEvent<HTMLDivElement>) => void;
  onDropCapture: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

interface UsePaneDropTargetResult {
  dropZone: DropZone | null;
  overlayLabel: string | null;
  overlayStyle: CSSProperties | undefined;
  dropTargetHandlers: PaneDropTargetHandlers;
}

export function usePaneDropTarget({
  movePaneTab,
  paneId,
  splitPaneMove,
  t,
  vaultId,
}: UsePaneDropTargetParams): UsePaneDropTargetResult {
  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  const computeZone = useCallback((event: DragEvent<HTMLDivElement>): DropZone => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("[data-no-edge-drop]")) return "center";

    const rect = event.currentTarget.getBoundingClientRect();
    return classifyDropZone(rect, event.clientX, event.clientY);
  }, []);

  const isTabDragOverPaneContent = useCallback(
    (event: DragEvent<HTMLDivElement>): boolean => {
      if (!event.dataTransfer.types.includes(TAB_DND_MIME)) return false;
      const target = event.target as HTMLElement | null;
      return !target?.closest?.("[data-no-edge-drop]");
    },
    [],
  );

  const updateDropZone = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const nextZone = computeZone(event);
      if (nextZone !== dropZone) setDropZone(nextZone);
    },
    [computeZone, dropZone],
  );

  const handleOuterDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const zone = dropZone ?? computeZone(event);
      setDropZone(null);

      if (!event.dataTransfer.types.includes(TAB_DND_MIME)) return;

      const payload = parseTabPayload(event.dataTransfer.getData(TAB_DND_MIME));
      if (!payload) return;
      if (payload.vaultId && vaultId && payload.vaultId !== vaultId) return;
      if (!payload.fromPaneId) return;

      event.preventDefault();
      event.stopPropagation();

      if (zone === "center") {
        if (payload.fromPaneId === paneId) return;
        movePaneTab(payload.fromPaneId, payload.tabId, paneId);
        return;
      }

      splitPaneMove(payload.fromPaneId, payload.tabId, paneId, zone);
    },
    [computeZone, dropZone, movePaneTab, paneId, splitPaneMove, vaultId],
  );

  const handleOuterDragEnterCapture = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isTabDragOverPaneContent(event)) return;
      event.stopPropagation();
      updateDropZone(event);
    },
    [isTabDragOverPaneContent, updateDropZone],
  );

  const handleOuterDragOverCapture = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isTabDragOverPaneContent(event)) return;
      event.stopPropagation();
      updateDropZone(event);
    },
    [isTabDragOverPaneContent, updateDropZone],
  );

  const handleOuterDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes(TAB_DND_MIME)) return;
      updateDropZone(event);
    },
    [updateDropZone],
  );

  const handleOuterDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) return;
      if (dropZone !== null) setDropZone(null);
    },
    [dropZone],
  );

  const handleOuterDropCapture = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isTabDragOverPaneContent(event)) return;
      event.stopPropagation();
      handleOuterDrop(event);
    },
    [handleOuterDrop, isTabDragOverPaneContent],
  );

  return {
    dropZone,
    overlayLabel: dropZone === null ? null : t(dropZoneLabelKey(dropZone)),
    overlayStyle:
      dropZone === null ? undefined : getDropZoneOverlayStyle(dropZone),
    dropTargetHandlers: {
      onDragEnterCapture: handleOuterDragEnterCapture,
      onDragOverCapture: handleOuterDragOverCapture,
      onDropCapture: handleOuterDropCapture,
      onDragOver: handleOuterDragOver,
      onDragLeave: handleOuterDragLeave,
      onDrop: handleOuterDrop,
    },
  };
}
