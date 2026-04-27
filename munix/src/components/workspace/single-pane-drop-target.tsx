import { useCallback, useState } from "react";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";

import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { TAB_DND_MIME, parseTabPayload } from "@/lib/dnd-mime";
import { useVaultDockStore } from "@/store/vault-dock-store";
import {
  classifyDropZone,
  dropZoneLabelKey,
  toEdgeZone,
  type EdgeZone,
} from "./pane/drop-zone";
import { DropZoneOverlay } from "./pane/drop-zone-overlay";

interface SinglePaneDropTargetProps {
  children: React.ReactNode;
}

export function SinglePaneDropTarget({ children }: SinglePaneDropTargetProps) {
  const { t } = useTranslation(["tabs"]);
  const ws = useActiveWorkspaceStore();
  const splitPaneMove = useStore(ws, (s) => s.splitPaneMove);
  const vaultId = useVaultDockStore((s) => s.activeVaultId);
  const [dropZone, setDropZone] = useState<EdgeZone | null>(null);

  const computeZone = useCallback((e: React.DragEvent): EdgeZone | null => {
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest?.("[data-no-edge-drop]")) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    return toEdgeZone(classifyDropZone(rect, e.clientX, e.clientY));
  }, []);

  const updateDropZone = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(TAB_DND_MIME)) return;
      const zone = computeZone(e);
      if (!zone) {
        if (dropZone !== null) setDropZone(null);
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (zone !== dropZone) setDropZone(zone);
    },
    [computeZone, dropZone],
  );

  const isTabDragOverContent = useCallback((e: React.DragEvent): boolean => {
    if (!e.dataTransfer.types.includes(TAB_DND_MIME)) return false;
    const targetEl = e.target as HTMLElement | null;
    return !targetEl?.closest?.("[data-no-edge-drop]");
  }, []);

  const handleDragOverCapture = useCallback(
    (e: React.DragEvent) => {
      if (!isTabDragOverContent(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      updateDropZone(e);
    },
    [isTabDragOverContent, updateDropZone],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDropZone(null);
  }, []);

  const handleDropCapture = useCallback(
    (e: React.DragEvent) => {
      const zone = dropZone ?? computeZone(e);
      setDropZone(null);
      if (!zone || !e.dataTransfer.types.includes(TAB_DND_MIME)) return;
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest?.("[data-no-edge-drop]")) return;
      const payload = parseTabPayload(e.dataTransfer.getData(TAB_DND_MIME));
      if (!payload) return;
      if (payload.vaultId && vaultId && payload.vaultId !== vaultId) return;

      e.preventDefault();
      e.stopPropagation();
      splitPaneMove(payload.fromPaneId, payload.tabId, null, zone);
    },
    [computeZone, dropZone, splitPaneMove, vaultId],
  );

  const overlayStyle: React.CSSProperties | undefined = (() => {
    if (dropZone === null) return undefined;
    if (dropZone === "left") {
      return { top: 0, bottom: 0, left: 0, width: "50%" };
    }
    if (dropZone === "right") {
      return { top: 0, bottom: 0, right: 0, width: "50%" };
    }
    if (dropZone === "top") {
      return { left: 0, right: 0, top: 0, height: "50%" };
    }
    return { left: 0, right: 0, bottom: 0, height: "50%" };
  })();

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1"
      onDragEnterCapture={handleDragOverCapture}
      onDragOverCapture={handleDragOverCapture}
      onDragLeave={handleDragLeave}
      onDropCapture={handleDropCapture}
    >
      {children}
      {dropZone ? (
        <DropZoneOverlay
          style={overlayStyle}
          label={t(dropZoneLabelKey(dropZone))}
        />
      ) : null}
    </div>
  );
}
