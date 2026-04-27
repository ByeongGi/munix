import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { useTabStore, type Tab } from "@/store/tab-store";
import { makeTabId } from "@/store/slices/tab-slice";
import { useEditorStore } from "@/store/editor-store";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { useVaultDockStore } from "@/store/vault-dock-store";
import {
  copyTabLink,
  copyTabPath,
  copyTabRelativePath,
  revealTabInFileTree,
  revealTabInSystem,
} from "@/components/tab/tab-actions";
import {
  PaneActionsButton,
  PaneActionsMenu,
} from "@/components/workspace/pane/pane-context-menu";
import { TabBarShell } from "@/components/tab/tab-bar-shell";
import { TabContextMenu } from "@/components/tab/tab-context-menu";
import { TabSoftLimitBadge } from "@/components/tab/tab-soft-limit-badge";
import { ActiveTabItem } from "@/components/tab/active-tab-item";
import { EmptyTabItem } from "@/components/tab/empty-tab-item";
import { NewTabButton } from "@/components/tab/new-tab-button";
import { useTabDndHandlers } from "@/components/tab/use-tab-dnd-handlers";

interface TabBarProps {
  onNewFile: () => void;
}

interface TabContextMenuState {
  x: number;
  y: number;
  tab: Tab;
}

interface PaneMenuState {
  x: number;
  y: number;
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

  const [menu, setMenu] = useState<TabContextMenuState | null>(null);
  const [paneMenu, setPaneMenu] = useState<PaneMenuState | null>(null);
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

  useEffect(() => {
    if (!menu && !paneMenu) return;
    const close = () => {
      setMenu(null);
      setPaneMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close, { once: true });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu, paneMenu]);

  if (tabs.length === 0) {
    return (
      <TabBarShell>
        <EmptyTabItem
          title={t("tabs:emptyTab.title")}
          closeLabel={t("tabs:aria.closeTab")}
          onClose={closeAll}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({
              x: e.clientX,
              y: e.clientY,
              tab: { id: "__empty-tab__", path: "", title: "" },
            });
          }}
        />
        <NewTabButton
          label={t("tabs:aria.newTab")}
          tooltip={t("tabs:tooltip.newTab")}
          onClick={onNewFile}
        />
        <PaneActionsButton
          label={t("tabs:paneMenu.label")}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setPaneMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
        />
        {paneMenu && (
          <PaneActionsMenu
            x={paneMenu.x}
            y={paneMenu.y}
            t={t}
            onSplitRight={() => {
              splitCurrentTab("right");
              setPaneMenu(null);
            }}
            onSplitDown={() => {
              splitCurrentTab("bottom");
              setPaneMenu(null);
            }}
            onClosePane={() => {
              if (activePaneId) closePane(activePaneId);
              else closeAll();
              setPaneMenu(null);
            }}
          />
        )}
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
        <div className="flex min-w-0 flex-1 items-end gap-px overflow-x-auto">
          {tabs.map((tab, index) => {
            const active = tab.id === activeId;
            const dirty = isDirty(tab);
            const dndProps = getTabDndProps(tab, index);
            return (
              <ActiveTabItem
                key={tab.id}
                tab={tab}
                active={active}
                dirty={dirty}
                emptyTitle={t("tabs:emptyTab.title")}
                closeLabel={t("tabs:aria.closeTab")}
                {...dndProps}
                onClick={() => activate(tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu({ x: e.clientX, y: e.clientY, tab });
                }}
                onClose={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
              />
            );
          })}
        </div>
        <TabSoftLimitBadge count={tabs.length} t={t} />
        <NewTabButton
          label={t("tabs:aria.newTab")}
          tooltip={t("tabs:tooltip.newTab")}
          onClick={onNewFile}
        />
        <PaneActionsButton
          label={t("tabs:paneMenu.label")}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setPaneMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
        />
      </TabBarShell>

      {menu && (
        <TabContextMenu
          x={menu.x}
          y={menu.y}
          tab={menu.tab}
          t={t}
          onClose={() => {
            if (menu.tab.id === "__empty-tab__") closeAll();
            else closeTab(menu.tab.id);
            setMenu(null);
          }}
          onCloseOthers={() => {
            closeOthers(menu.tab.id);
            setMenu(null);
          }}
          onCloseTabsAfter={() => {
            closeTabsAfter(menu.tab.id);
            setMenu(null);
          }}
          onTogglePinned={() => {
            togglePinned(menu.tab.id);
            setMenu(null);
          }}
          onCopyLink={() => {
            void copyTabLink(menu.tab);
            setMenu(null);
          }}
          onCopyPath={() => {
            void copyTabPath(menu.tab);
            setMenu(null);
          }}
          onCopyRelativePath={() => {
            void copyTabRelativePath(menu.tab);
            setMenu(null);
          }}
          onRevealInFileTree={() => {
            revealTabInFileTree(menu.tab);
            setMenu(null);
          }}
          onRevealInSystem={() => {
            void revealTabInSystem(menu.tab);
            setMenu(null);
          }}
          onSplitRight={() => {
            splitTab(menu.tab, "right");
            setMenu(null);
          }}
          onSplitDown={() => {
            splitTab(menu.tab, "bottom");
            setMenu(null);
          }}
          onCloseAll={() => {
            closeAll();
            setMenu(null);
          }}
        />
      )}
      {paneMenu && (
        <PaneActionsMenu
          x={paneMenu.x}
          y={paneMenu.y}
          t={t}
          onSplitRight={() => {
            splitCurrentTab("right");
            setPaneMenu(null);
          }}
          onSplitDown={() => {
            splitCurrentTab("bottom");
            setPaneMenu(null);
          }}
          onClosePane={() => {
            if (activePaneId) closePane(activePaneId);
            else closeAll();
            setPaneMenu(null);
          }}
        />
      )}
    </>
  );
}
