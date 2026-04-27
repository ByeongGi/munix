import { useState, type DragEvent } from "react";

import {
  getReorderIndex,
  getTabDropTargetIndex,
  getTabHoverSide,
  setTabDragData,
  shouldShowLeftDropIndicator,
  shouldShowRightDropIndicator,
  type TabHoverSide,
} from "@/components/tab/tab-dnd";
import {
  LEGACY_TAB_DND_MIME,
  TAB_DND_MIME,
  parseTabPayload,
} from "@/lib/dnd-mime";
import type { Tab } from "@/store/tab-store";
import type { VaultId } from "@/store/vault-types";

type MovePaneTab = (
  sourcePaneId: string,
  tabId: string,
  destPaneId: string,
  destIndex?: number,
) => void;

interface UseTabDndHandlersParams {
  activePaneId: string | null;
  movePaneTab: MovePaneTab;
  reorder: (fromIndex: number, toIndex: number) => void;
  vaultId: VaultId | null;
}

export interface TabDndItemProps {
  dragging: boolean;
  showLeftIndicator: boolean;
  showRightIndicator: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export function useTabDndHandlers({
  activePaneId,
  movePaneTab,
  reorder,
  vaultId,
}: UseTabDndHandlersParams) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverSide, setHoverSide] = useState<TabHoverSide>("left");

  const resetDragState = () => {
    setDragIndex(null);
    setHoverIndex(null);
  };

  const getTabDndProps = (tab: Tab, index: number): TabDndItemProps => {
    const isHovered = dragIndex !== null && hoverIndex === index;

    return {
      dragging: dragIndex === index,
      showLeftIndicator: shouldShowLeftDropIndicator({
        isHovered,
        hoverSide,
        dragIndex,
        index,
      }),
      showRightIndicator: shouldShowRightDropIndicator({
        isHovered,
        hoverSide,
        dragIndex,
        index,
      }),
      onDragStart: (event: DragEvent<HTMLDivElement>) => {
        setTabDragData({
          dataTransfer: event.dataTransfer,
          index,
          vaultId,
          tabId: tab.id,
          fromPaneId: activePaneId,
          path: tab.path,
        });
        setDragIndex(index);
      },
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        const types = event.dataTransfer.types;
        if (
          !types.includes(LEGACY_TAB_DND_MIME) &&
          !types.includes(TAB_DND_MIME)
        ) {
          return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";

        const rect = event.currentTarget.getBoundingClientRect();
        const side = getTabHoverSide(rect, event.clientX);
        if (hoverIndex !== index) setHoverIndex(index);
        if (hoverSide !== side) setHoverSide(side);
      },
      onDragLeave: () => {
        if (hoverIndex === index) setHoverIndex(null);
      },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        const types = event.dataTransfer.types;

        if (types.includes(TAB_DND_MIME)) {
          const payload = parseTabPayload(
            event.dataTransfer.getData(TAB_DND_MIME),
          );
          if (
            payload &&
            activePaneId &&
            payload.fromPaneId &&
            payload.fromPaneId !== activePaneId
          ) {
            event.preventDefault();
            movePaneTab(
              payload.fromPaneId,
              payload.tabId,
              activePaneId,
              getTabDropTargetIndex(index, hoverSide),
            );
            resetDragState();
            return;
          }
        }

        if (!types.includes(LEGACY_TAB_DND_MIME)) return;

        event.preventDefault();
        const from = parseInt(
          event.dataTransfer.getData(LEGACY_TAB_DND_MIME),
          10,
        );

        if (!Number.isNaN(from)) {
          const targetIndex = getTabDropTargetIndex(index, hoverSide);
          const nextIndex = getReorderIndex(from, targetIndex);
          if (nextIndex !== from) reorder(from, nextIndex);
        }

        resetDragState();
      },
      onDragEnd: resetDragState,
    };
  };

  return { getTabDndProps };
}
