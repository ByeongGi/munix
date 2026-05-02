import type { TFunction } from "i18next";

import type { Tab } from "@/store/tab-store";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSurface,
} from "@/components/workspace/pane/pane-context-menu";

interface TabContextMenuProps {
  x: number;
  y: number;
  tab: Tab;
  t: TFunction<["tabs", "common"]>;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseTabsAfter: () => void;
  onTogglePinned: () => void;
  onCopyLink: () => void;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onRevealInFileTree: () => void;
  onRevealInSystem: () => void;
  onSplitRight: () => void;
  onSplitDown: () => void;
  onCloseAll: () => void;
}

const EMPTY_TAB_ID = "__empty-tab__";

export function TabContextMenu({
  x,
  y,
  tab,
  t,
  onClose,
  onCloseOthers,
  onCloseTabsAfter,
  onTogglePinned,
  onCopyLink,
  onCopyPath,
  onCopyRelativePath,
  onRevealInFileTree,
  onRevealInSystem,
  onSplitRight,
  onSplitDown,
  onCloseAll,
}: TabContextMenuProps) {
  const isEmptyTab = tab.id === EMPTY_TAB_ID;

  return (
    <ContextMenuSurface x={x} y={y} estimatedHeight={420}>
      <ContextMenuItem
        label={t("tabs:contextMenu.close")}
        shortcut="⌘W"
        onClick={onClose}
      />
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
        label={t(
          tab.pinned ? "tabs:contextMenu.unpin" : "tabs:contextMenu.pin",
        )}
        disabled={isEmptyTab}
        onClick={onTogglePinned}
      />
      <ContextMenuItem
        label={t("tabs:contextMenu.copyLink")}
        disabled={!tab.path}
        onClick={onCopyLink}
      />
      <ContextMenuSeparator />
      <ContextMenuItem label={t("tabs:contextMenu.moveToNewWindow")} disabled />
      <ContextMenuSeparator />
      {tab.path ? (
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
      {!isEmptyTab ? (
        <>
          <ContextMenuItem
            label={t("tabs:contextMenu.splitRight")}
            shortcut="⌘\\"
            onClick={onSplitRight}
          />
          <ContextMenuItem
            label={t("tabs:contextMenu.splitDown")}
            shortcut="⌘⇧\\"
            onClick={onSplitDown}
          />
          <ContextMenuSeparator />
        </>
      ) : null}
      <ContextMenuItem
        label={t("tabs:contextMenu.closeAll")}
        onClick={onCloseAll}
      />
    </ContextMenuSurface>
  );
}
