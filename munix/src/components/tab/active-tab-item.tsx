import type { DragEvent, MouseEvent } from "react";
import { Pin, TerminalIcon, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { isTerminalTab } from "@/store/slices/tab-slice";
import type { Tab } from "@/store/tab-store";

interface ActiveTabItemProps {
  tab: Tab;
  active: boolean;
  dirty: boolean;
  dragging: boolean;
  emptyTitle: string;
  closeLabel: string;
  showLeftIndicator: boolean;
  showRightIndicator: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onAuxClick: (event: MouseEvent<HTMLDivElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onClose: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function ActiveTabItem({
  tab,
  active,
  dirty,
  dragging,
  emptyTitle,
  closeLabel,
  showLeftIndicator,
  showRightIndicator,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onClick,
  onAuxClick,
  onContextMenu,
  onClose,
}: ActiveTabItemProps) {
  const tabTitle = tab.path ? (tab.titleDraft ?? tab.title) : tab.title;
  const displayTitle = tabTitle || emptyTitle;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onAuxClick={onAuxClick}
      onContextMenu={onContextMenu}
      className={cn(
        "group relative flex h-8 min-w-24 max-w-44 flex-[1_1_9rem] cursor-default select-none items-center gap-1.5 rounded-t-md border border-b-0 px-2 text-xs",
        "border-[var(--color-border-primary)]",
        active
          ? "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
          : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
        dragging && "opacity-40",
      )}
      title={tab.path || displayTitle}
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
        {isTerminalTab(tab) ? (
          <TerminalIcon className="mr-1 inline h-3 w-3 align-[-2px] text-[var(--color-text-tertiary)]" />
        ) : null}
        {isTerminalTab(tab) ? tab.title : displayTitle}
      </span>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded",
          "hover:bg-[var(--color-bg-hover)]",
        )}
        aria-label={closeLabel}
      >
        {dirty ? (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-primary)] group-hover:hidden" />
        ) : null}
        <X className={cn("h-3 w-3", dirty ? "hidden group-hover:block" : "")} />
      </button>
      {active ? (
        <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-md bg-[var(--color-accent)]" />
      ) : null}
    </div>
  );
}
