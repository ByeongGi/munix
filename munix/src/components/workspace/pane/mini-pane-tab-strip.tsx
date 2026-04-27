import { useState } from "react";
import { Pin, Plus, X } from "lucide-react";

import { cn } from "@/lib/cn";
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
import type { PaneNode } from "@/store/workspace-types";

interface MiniPaneTabStripProps {
  pane: PaneNode;
  vaultId: string | null;
  emptyTabTitle: string;
  newTabLabel: string;
  newTabTooltip: string;
  onActivateTab: (paneId: string, tabId: string) => void;
  onCloseTab: (paneId: string, tabId: string) => void;
  onCreateTab: (paneId: string, path: string) => void;
  onReorderTab: (paneId: string, from: number, to: number) => void;
  onOpenTabMenu: (state: { x: number; y: number; tabId: string }) => void;
}

export function MiniPaneTabStrip({
  pane,
  vaultId,
  emptyTabTitle,
  newTabLabel,
  newTabTooltip,
  onActivateTab,
  onCloseTab,
  onCreateTab,
  onReorderTab,
  onOpenTabMenu,
}: MiniPaneTabStripProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverSide, setHoverSide] = useState<TabHoverSide>("left");

  const resetDragState = () => {
    setDragIndex(null);
    setHoverIndex(null);
  };

  return (
    <div className="flex min-w-0 flex-1 items-end gap-px overflow-x-auto">
      {pane.tabs.map((tab, index) => {
        const isPaneActive = tab.id === pane.activeTabId;
        const isHovered = dragIndex !== null && hoverIndex === index;
        const showLeftIndicator = shouldShowLeftDropIndicator({
          isHovered,
          hoverSide,
          dragIndex,
          index,
        });
        const showRightIndicator = shouldShowRightDropIndicator({
          isHovered,
          hoverSide,
          dragIndex,
          index,
        });

        return (
          <div
            key={tab.id}
            draggable
            data-pane-tab={tab.id}
            onDragStart={(event) => {
              setTabDragData({
                dataTransfer: event.dataTransfer,
                index,
                vaultId,
                tabId: tab.id,
                fromPaneId: pane.id,
                path: tab.path,
              });
              setDragIndex(index);
            }}
            onDragOver={(event) => {
              const { types } = event.dataTransfer;
              if (
                !types.includes(LEGACY_TAB_DND_MIME) &&
                !types.includes(TAB_DND_MIME)
              ) {
                return;
              }

              const payload = types.includes(TAB_DND_MIME)
                ? parseTabPayload(event.dataTransfer.getData(TAB_DND_MIME))
                : null;
              const isFromSamePane =
                payload?.fromPaneId === pane.id ||
                (!payload && types.includes(LEGACY_TAB_DND_MIME));
              if (!isFromSamePane) return;

              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "move";

              const rect = event.currentTarget.getBoundingClientRect();
              const nextHoverSide = getTabHoverSide(rect, event.clientX);
              if (hoverIndex !== index) setHoverIndex(index);
              if (hoverSide !== nextHoverSide) setHoverSide(nextHoverSide);
            }}
            onDragLeave={() => {
              if (hoverIndex === index) setHoverIndex(null);
            }}
            onDrop={(event) => {
              const { types } = event.dataTransfer;
              let from = -1;

              if (types.includes(TAB_DND_MIME)) {
                const payload = parseTabPayload(
                  event.dataTransfer.getData(TAB_DND_MIME),
                );
                if (!payload || payload.fromPaneId !== pane.id) {
                  return;
                }
                from = pane.tabs.findIndex((item) => item.id === payload.tabId);
              } else if (types.includes(LEGACY_TAB_DND_MIME)) {
                from = parseInt(
                  event.dataTransfer.getData(LEGACY_TAB_DND_MIME),
                  10,
                );
              }

              if (from < 0 || Number.isNaN(from)) return;
              event.preventDefault();
              event.stopPropagation();

              const targetIndex = getTabDropTargetIndex(index, hoverSide);
              const adjustedIndex = getReorderIndex(from, targetIndex);
              if (adjustedIndex !== from) {
                onReorderTab(pane.id, from, adjustedIndex);
              }
              resetDragState();
            }}
            onDragEnd={resetDragState}
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              onActivateTab(pane.id, tab.id);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenTabMenu({
                x: event.clientX,
                y: event.clientY,
                tabId: tab.id,
              });
            }}
            className={cn(
              "group relative flex h-8 min-w-24 max-w-44 flex-[1_1_9rem] cursor-default select-none items-center gap-1.5 rounded-t-md border border-b-0 px-2 text-xs",
              "border-[var(--color-border-primary)]",
              isPaneActive
                ? "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
              dragIndex === index && "opacity-40",
            )}
            title={tab.path}
          >
            {showLeftIndicator ? (
              <span className="absolute -left-px top-0 h-full w-[2px] bg-[var(--color-accent)]" />
            ) : null}
            {showRightIndicator ? (
              <span className="absolute -right-px top-0 h-full w-[2px] bg-[var(--color-accent)]" />
            ) : null}
            <span className="min-w-0 flex-1 truncate">
              {tab.pinned ? (
                <Pin className="mr-1 inline h-3 w-3 text-[var(--color-accent)]" />
              ) : null}
              {tab.path ? (tab.titleDraft ?? tab.title) : emptyTabTitle}
            </span>
            {isPaneActive ? (
              <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-md bg-[var(--color-accent)]" />
            ) : null}
            <button
              type="button"
              data-pane-tab-close={tab.id}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(pane.id, tab.id);
              }}
              className="flex h-4 w-4 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              aria-label="close tab"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        data-pane-tab-new="true"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onCreateTab(pane.id, "");
        }}
        className={cn(
          "ml-1 flex h-6 w-6 items-center justify-center rounded",
          "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]",
        )}
        aria-label={newTabLabel}
        title={newTabTooltip}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
