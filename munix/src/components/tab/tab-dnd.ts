import {
  LEGACY_TAB_DND_MIME,
  TAB_DND_MIME,
  serializeTabPayload,
} from "@/lib/dnd-mime";
import type { VaultId } from "@/store/vault-types";

export type TabHoverSide = "left" | "right";

interface SetTabDragDataParams {
  dataTransfer: DataTransfer;
  index: number;
  vaultId: VaultId | null;
  tabId: string;
  fromPaneId: string | null;
  path: string;
}

export function setTabDragData({
  dataTransfer,
  index,
  vaultId,
  tabId,
  fromPaneId,
  path,
}: SetTabDragDataParams) {
  dataTransfer.setData(LEGACY_TAB_DND_MIME, String(index));
  dataTransfer.setData(
    TAB_DND_MIME,
    serializeTabPayload({
      type: "munix/tab",
      vaultId,
      tabId,
      fromPaneId,
      path,
    }),
  );
  dataTransfer.effectAllowed = "move";
}

export function getTabHoverSide(rect: DOMRect, clientX: number): TabHoverSide {
  return clientX - rect.left < rect.width / 2 ? "left" : "right";
}

export function getTabDropTargetIndex(
  targetIndex: number,
  hoverSide: TabHoverSide,
): number {
  return hoverSide === "left" ? targetIndex : targetIndex + 1;
}

export function getReorderIndex(
  fromIndex: number,
  targetIndex: number,
): number {
  return fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
}

export function shouldShowLeftDropIndicator({
  isHovered,
  hoverSide,
  dragIndex,
  index,
}: {
  isHovered: boolean;
  hoverSide: TabHoverSide;
  dragIndex: number | null;
  index: number;
}): boolean {
  return (
    isHovered &&
    hoverSide === "left" &&
    dragIndex !== index &&
    dragIndex !== index - 1
  );
}

export function shouldShowRightDropIndicator({
  isHovered,
  hoverSide,
  dragIndex,
  index,
}: {
  isHovered: boolean;
  hoverSide: TabHoverSide;
  dragIndex: number | null;
  index: number;
}): boolean {
  return (
    isHovered &&
    hoverSide === "right" &&
    dragIndex !== index &&
    dragIndex !== index + 1
  );
}
