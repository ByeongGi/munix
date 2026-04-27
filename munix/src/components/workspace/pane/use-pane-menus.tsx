import { useEffect, useState, type MouseEvent } from "react";
import type { TFunction } from "i18next";

import { ipc } from "@/lib/ipc";
import { makeTabId } from "@/store/slices/tab-slice";
import type { PaneNode } from "@/store/workspace-types";
import {
  PaneActionsMenu,
  TabActionsMenu,
} from "./pane-context-menu";

type SplitPane = (
  targetPaneId: string | null,
  zone: "right" | "bottom",
  initialTab?: PaneNode["tabs"][number],
) => void;

interface PaneMenuState {
  x: number;
  y: number;
}

interface TabMenuState {
  x: number;
  y: number;
  tabId: string;
}

interface UsePaneMenusParams {
  closeAllPaneTabs: (paneId: string) => void;
  closeOtherPaneTabs: (paneId: string, tabId: string) => void;
  closePane: (paneId: string) => void;
  closePaneTab: (paneId: string, tabId: string) => void;
  closePaneTabsAfter: (paneId: string, tabId: string) => void;
  pane: PaneNode;
  splitPane: SplitPane;
  t: TFunction<["app", "tabs"]>;
  togglePaneTabPinned: (paneId: string, tabId: string) => void;
}

function cloneTabForSplit(tab: PaneNode["tabs"][number] | undefined) {
  return tab
    ? {
        ...tab,
        id: makeTabId(),
      }
    : undefined;
}

export function usePaneMenus({
  closeAllPaneTabs,
  closeOtherPaneTabs,
  closePane,
  closePaneTab,
  closePaneTabsAfter,
  pane,
  splitPane,
  t,
  togglePaneTabPinned,
}: UsePaneMenusParams) {
  const [paneMenu, setPaneMenu] = useState<PaneMenuState | null>(null);
  const [tabMenu, setTabMenu] = useState<TabMenuState | null>(null);

  useEffect(() => {
    if (!paneMenu && !tabMenu) return;

    const close = () => {
      setPaneMenu(null);
      setTabMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close, { once: true });

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [paneMenu, tabMenu]);

  const openPaneMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setPaneMenu({ x: rect.left, y: rect.bottom + 4 });
  };

  const splitThisPane = (zone: "right" | "bottom") => {
    splitPane(
      pane.id,
      zone,
      cloneTabForSplit(pane.tabs.find((tab) => tab.id === pane.activeTabId)),
    );
  };

  const splitPaneTab = (tabId: string, zone: "right" | "bottom") => {
    splitPane(
      pane.id,
      zone,
      cloneTabForSplit(pane.tabs.find((tab) => tab.id === tabId)),
    );
  };

  const getMenuTab = (tabId: string) =>
    pane.tabs.find((tab) => tab.id === tabId);

  const copyTabPath = async (tabId: string) => {
    const tab = getMenuTab(tabId);
    if (!tab?.path) return;

    try {
      const abs = await ipc.absPath(tab.path);
      await ipc.copyText(abs);
    } catch (error) {
      console.error("copy pane tab path failed", error);
    }
  };

  const copyTabRelativePath = async (tabId: string) => {
    const tab = getMenuTab(tabId);
    if (!tab?.path) return;

    try {
      await ipc.copyText(tab.path);
    } catch (error) {
      console.error("copy pane tab relative path failed", error);
    }
  };

  const copyTabLink = async (tabId: string) => {
    const tab = getMenuTab(tabId);
    if (!tab?.path) return;

    try {
      await ipc.copyText(`[[${tab.path.replace(/\.md$/i, "")}]]`);
    } catch (error) {
      console.error("copy pane tab link failed", error);
    }
  };

  const revealInFileTree = (tabId: string) => {
    const tab = getMenuTab(tabId);
    if (!tab?.path) return;
    window.dispatchEvent(
      new CustomEvent("munix:reveal-file-tree", {
        detail: { path: tab.path },
      }),
    );
  };

  const revealTab = async (tabId: string) => {
    const tab = getMenuTab(tabId);
    if (!tab?.path) return;

    try {
      await ipc.revealInSystem(tab.path);
    } catch (error) {
      console.error("reveal pane tab failed", error);
    }
  };

  const closeMenus = () => {
    setPaneMenu(null);
    setTabMenu(null);
  };

  const paneMenuElement = paneMenu ? (
    <PaneActionsMenu
      x={paneMenu.x}
      y={paneMenu.y}
      t={t}
      onSplitRight={() => {
        splitThisPane("right");
        closeMenus();
      }}
      onSplitDown={() => {
        splitThisPane("bottom");
        closeMenus();
      }}
      onClosePane={() => {
        closePane(pane.id);
        closeMenus();
      }}
    />
  ) : null;

  const tabMenuTab =
    tabMenu === null ? null : (getMenuTab(tabMenu.tabId) ?? null);

  const tabMenuElement = tabMenu ? (
    <TabActionsMenu
      x={tabMenu.x}
      y={tabMenu.y}
      t={t}
      onSplitRight={() => {
        splitPaneTab(tabMenu.tabId, "right");
        closeMenus();
      }}
      onSplitDown={() => {
        splitPaneTab(tabMenu.tabId, "bottom");
        closeMenus();
      }}
      onClose={() => {
        closePaneTab(pane.id, tabMenu.tabId);
        closeMenus();
      }}
      onCloseOthers={() => {
        closeOtherPaneTabs(pane.id, tabMenu.tabId);
        closeMenus();
      }}
      onCloseTabsAfter={() => {
        closePaneTabsAfter(pane.id, tabMenu.tabId);
        closeMenus();
      }}
      onTogglePinned={() => {
        togglePaneTabPinned(pane.id, tabMenu.tabId);
        closeMenus();
      }}
      onCopyLink={() => {
        void copyTabLink(tabMenu.tabId);
        closeMenus();
      }}
      onCopyPath={() => {
        void copyTabPath(tabMenu.tabId);
        closeMenus();
      }}
      onCopyRelativePath={() => {
        void copyTabRelativePath(tabMenu.tabId);
        closeMenus();
      }}
      onRevealInFileTree={() => {
        revealInFileTree(tabMenu.tabId);
        closeMenus();
      }}
      onRevealInSystem={() => {
        void revealTab(tabMenu.tabId);
        closeMenus();
      }}
      onCloseAll={() => {
        closeAllPaneTabs(pane.id);
        closeMenus();
      }}
      hasPath={Boolean(tabMenuTab?.path)}
      pinned={tabMenuTab?.pinned === true}
    />
  ) : null;

  return {
    menus: (
      <>
        {paneMenuElement}
        {tabMenuElement}
      </>
    ),
    openPaneMenu,
    openTabMenu: setTabMenu,
  };
}
