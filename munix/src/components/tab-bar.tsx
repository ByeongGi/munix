import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { useTabStore, type Tab } from "@/store/tab-store";
import { makeTabId } from "@/store/slices/tab-slice";
import { useEditorStore } from "@/store/editor-store";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { TabBarShell } from "@/components/tab/tab-bar-shell";
import { TabSoftLimitBadge } from "@/components/tab/tab-soft-limit-badge";
import { EmptyTabItem } from "@/components/tab/empty-tab-item";
import { NewTabButton } from "@/components/tab/new-tab-button";
import { useTabDndHandlers } from "@/components/tab/use-tab-dnd-handlers";
import { TabPaneActions } from "@/components/tab/tab-pane-actions";
import { ActiveTabList } from "@/components/tab/active-tab-list";
import { useTabContextMenu } from "@/components/tab/use-tab-context-menu";

interface TabBarProps {
  onNewFile: () => void;
}

export function TabBar({ onNewFile }: TabBarProps) {
  const tabs = useTabStore((s) => s.tabs);
  const activeId = useTabStore((s) => s.activeId);
  const activate = useTabStore((s) => s.activate);
  const closeTab = useTabStore((s) => s.closeTab);
  const closeOthers = useTabStore((s) => s.closeOthers);
  const closeTabsAfter = useTabStore((s) => s.closeTabsAfter);
  const closeAll = useTabStore((s) => s.closeAll);
  const togglePinned = useTabStore((s) => s.togglePinned);
  const reorder = useTabStore((s) => s.reorder);
  const status = useEditorStore((s) => s.status);
  const currentPath = useEditorStore((s) => s.currentPath);
  const ws = useActiveWorkspaceStore();
  const activePaneId = useStore(ws, (s) => s.activePaneId);
  const splitPane = useStore(ws, (s) => s.splitPane);
  const closePane = useStore(ws, (s) => s.closePane);
  const movePaneTab = useStore(ws, (s) => s.movePaneTab);
  const vaultId = useVaultDockStore((s) => s.activeVaultId);
  const { t } = useTranslation(["tabs", "common"]);

  const { getTabDndProps } = useTabDndHandlers({
    activePaneId,
    movePaneTab,
    reorder,
    vaultId: vaultId ?? null,
  });

  const splitTab = (tab: Tab, zone: "right" | "bottom") => {
    splitPane(activePaneId, zone, {
      ...tab,
      id: makeTabId(),
    });
  };

  const splitCurrentTab = (zone: "right" | "bottom") => {
    const tab = tabs.find((t) => t.id === activeId);
    splitPane(
      activePaneId,
      zone,
      tab
        ? {
            ...tab,
            id: makeTabId(),
          }
        : undefined,
    );
  };

  const closeActivePane = () => {
    if (activePaneId) closePane(activePaneId);
    else closeAll();
  };

  const { contextMenu, openEmptyTabMenu, openTabMenu } = useTabContextMenu({
    t,
    closeAll,
    closeOthers,
    closeTab,
    closeTabsAfter,
    splitTab,
    togglePinned,
  });

  if (tabs.length === 0) {
    return (
      <TabBarShell>
        <EmptyTabItem
          title={t("tabs:emptyTab.title")}
          closeLabel={t("tabs:aria.closeTab")}
          onClose={closeAll}
          onContextMenu={openEmptyTabMenu}
        />
        <NewTabButton
          label={t("tabs:aria.newTab")}
          tooltip={t("tabs:tooltip.newTab")}
          onClick={onNewFile}
        />
        <TabPaneActions
          label={t("tabs:paneMenu.label")}
          t={t}
          onSplitRight={() => splitCurrentTab("right")}
          onSplitDown={() => splitCurrentTab("bottom")}
          onClosePane={closeActivePane}
        />
      </TabBarShell>
    );
  }

  const isDirty = (tab: Tab): boolean => {
    if (tab.path !== currentPath) return false;
    return (
      status.kind === "dirty" ||
      status.kind === "saving" ||
      status.kind === "conflict"
    );
  };

  return (
    <>
      <TabBarShell>
        <ActiveTabList
          tabs={tabs}
          activeId={activeId}
          emptyTitle={t("tabs:emptyTab.title")}
          closeLabel={t("tabs:aria.closeTab")}
          isDirty={isDirty}
          getTabDndProps={getTabDndProps}
          onActivate={activate}
          onClose={closeTab}
          onContextMenu={openTabMenu}
        />
        <TabSoftLimitBadge count={tabs.length} t={t} />
        <NewTabButton
          label={t("tabs:aria.newTab")}
          tooltip={t("tabs:tooltip.newTab")}
          onClick={onNewFile}
        />
        <TabPaneActions
          label={t("tabs:paneMenu.label")}
          t={t}
          onSplitRight={() => splitCurrentTab("right")}
          onSplitDown={() => splitCurrentTab("bottom")}
          onClosePane={closeActivePane}
        />
      </TabBarShell>

      {contextMenu}
    </>
  );
}
