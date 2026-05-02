import { MoreHorizontal } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { ContextMenuPortal } from "@/components/ui/context-menu-portal";
import { cn } from "@/lib/cn";
import { getContextMenuSurfaceStyle } from "@/lib/context-menu-position";

type Translate = (key: string) => string;

export function ContextMenuSurface({
  x,
  y,
  minWidth = 180,
  estimatedHeight,
  children,
}: {
  x: number;
  y: number;
  minWidth?: number;
  estimatedHeight?: number;
  children: ReactNode;
}) {
  return (
    <ContextMenuPortal>
      <div
        role="menu"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "munix-context-menu fixed z-50 rounded-md border p-1 shadow-lg",
          "border-[var(--color-border-primary)] bg-[var(--color-context-menu-bg)]",
        )}
        style={getContextMenuSurfaceStyle({
          x,
          y,
          minWidth,
          estimatedHeight,
        })}
      >
        {children}
      </div>
    </ContextMenuPortal>
  );
}

export function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-[var(--color-border-secondary)]" />;
}

export function ContextMenuItem({
  label,
  shortcut,
  onClick,
  disabled = false,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "munix-context-menu-item flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left",
        disabled
          ? "cursor-default text-[var(--color-context-menu-disabled)]"
          : "text-[var(--color-context-menu-text)] hover:bg-[var(--color-bg-hover)]",
      )}
    >
      <span>{label}</span>
      {shortcut ? (
        <span className="munix-context-menu-shortcut text-[var(--color-context-menu-muted)]">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}

export function PaneActionsButton({
  label,
  onClick,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      data-pane-menu="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={cn(
        "ml-1 flex h-6 w-6 items-center justify-center rounded",
        "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]",
      )}
      aria-label={label}
      title={label}
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </button>
  );
}

export function PaneActionsMenu({
  x,
  y,
  t,
  onSplitRight,
  onSplitDown,
  onClosePane,
}: {
  x: number;
  y: number;
  t: Translate;
  onSplitRight: () => void;
  onSplitDown: () => void;
  onClosePane: () => void;
}) {
  return (
    <ContextMenuSurface x={x} y={y} minWidth={112} estimatedHeight={112}>
      <ContextMenuItem
        label={t("tabs:contextMenu.splitRight")}
        onClick={onSplitRight}
      />
      <ContextMenuItem
        label={t("tabs:contextMenu.splitDown")}
        onClick={onSplitDown}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("tabs:paneMenu.closePane")}
        onClick={onClosePane}
      />
    </ContextMenuSurface>
  );
}

export function TabActionsMenu({
  x,
  y,
  t,
  onSplitRight,
  onSplitDown,
  onClose,
  onCloseOthers,
  onCloseTabsAfter,
  onTogglePinned,
  onCopyLink,
  onCopyPath,
  onCopyRelativePath,
  onRevealInFileTree,
  onRevealInSystem,
  onCloseAll,
  hasPath,
  pinned,
}: {
  x: number;
  y: number;
  t: Translate;
  onSplitRight: () => void;
  onSplitDown: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseTabsAfter: () => void;
  onTogglePinned: () => void;
  onCopyLink: () => void;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onRevealInFileTree: () => void;
  onRevealInSystem: () => void;
  onCloseAll: () => void;
  hasPath: boolean;
  pinned: boolean;
}) {
  return (
    <ContextMenuSurface x={x} y={y} estimatedHeight={380}>
      <ContextMenuItem label={t("tabs:contextMenu.close")} onClick={onClose} />
      <ContextMenuItem
        label={t("tabs:contextMenu.closeOthers")}
        onClick={onCloseOthers}
      />
      <ContextMenuItem
        label={t("tabs:contextMenu.closeTabsAfter")}
        onClick={onCloseTabsAfter}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label={t(pinned ? "tabs:contextMenu.unpin" : "tabs:contextMenu.pin")}
        onClick={onTogglePinned}
      />
      <ContextMenuItem
        label={t("tabs:contextMenu.copyLink")}
        disabled={!hasPath}
        onClick={onCopyLink}
      />
      <ContextMenuSeparator />
      <ContextMenuItem label={t("tabs:contextMenu.moveToNewWindow")} disabled />
      <ContextMenuSeparator />
      {hasPath ? (
        <>
          <ContextMenuItem
            label={t("tabs:contextMenu.copyPath")}
            onClick={onCopyPath}
          />
          <ContextMenuItem
            label={t("tabs:contextMenu.copyRelativePath")}
            onClick={onCopyRelativePath}
          />
          <ContextMenuItem
            label={t("tabs:contextMenu.revealInFileTree")}
            onClick={onRevealInFileTree}
          />
          <ContextMenuItem
            label={t("tabs:contextMenu.revealInSystem")}
            onClick={onRevealInSystem}
          />
          <ContextMenuSeparator />
        </>
      ) : null}
      <ContextMenuItem
        label={t("tabs:contextMenu.splitRight")}
        onClick={onSplitRight}
      />
      <ContextMenuItem
        label={t("tabs:contextMenu.splitDown")}
        onClick={onSplitDown}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("tabs:contextMenu.closeAll")}
        onClick={onCloseAll}
      />
    </ContextMenuSurface>
  );
}
