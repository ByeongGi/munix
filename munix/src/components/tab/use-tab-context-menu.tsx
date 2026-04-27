import { useEffect, useState, type MouseEvent } from "react";
import type { TFunction } from "i18next";

import {
  copyTabLink,
  copyTabPath,
  copyTabRelativePath,
  revealTabInFileTree,
  revealTabInSystem,
} from "@/components/tab/tab-actions";
import { TabContextMenu } from "@/components/tab/tab-context-menu";
import type { Tab } from "@/store/tab-store";

const EMPTY_TAB_ID = "__empty-tab__";
const EMPTY_TAB: Tab = { id: EMPTY_TAB_ID, path: "", title: "" };

interface TabContextMenuState {
  x: number;
  y: number;
  tab: Tab;
}

interface UseTabContextMenuParams {
  t: TFunction<["tabs", "common"]>;
  closeAll: () => void;
  closeOthers: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  closeTabsAfter: (tabId: string) => void;
  splitTab: (tab: Tab, zone: "right" | "bottom") => void;
  togglePinned: (tabId: string) => void;
}

export function useTabContextMenu({
  t,
  closeAll,
  closeOthers,
  closeTab,
  closeTabsAfter,
  splitTab,
  togglePinned,
}: UseTabContextMenuParams) {
  const [menu, setMenu] = useState<TabContextMenuState | null>(null);

  useEffect(() => {
    if (!menu) return;

    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close, { once: true });

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu]);

  const closeMenu = () => setMenu(null);

  const openMenu = (event: MouseEvent<HTMLElement>, tab: Tab) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, tab });
  };

  const contextMenu = menu ? (
    <TabContextMenu
      x={menu.x}
      y={menu.y}
      tab={menu.tab}
      t={t}
      onClose={() => {
        if (menu.tab.id === EMPTY_TAB_ID) closeAll();
        else closeTab(menu.tab.id);
        closeMenu();
      }}
      onCloseOthers={() => {
        closeOthers(menu.tab.id);
        closeMenu();
      }}
      onCloseTabsAfter={() => {
        closeTabsAfter(menu.tab.id);
        closeMenu();
      }}
      onTogglePinned={() => {
        togglePinned(menu.tab.id);
        closeMenu();
      }}
      onCopyLink={() => {
        void copyTabLink(menu.tab);
        closeMenu();
      }}
      onCopyPath={() => {
        void copyTabPath(menu.tab);
        closeMenu();
      }}
      onCopyRelativePath={() => {
        void copyTabRelativePath(menu.tab);
        closeMenu();
      }}
      onRevealInFileTree={() => {
        revealTabInFileTree(menu.tab);
        closeMenu();
      }}
      onRevealInSystem={() => {
        void revealTabInSystem(menu.tab);
        closeMenu();
      }}
      onSplitRight={() => {
        splitTab(menu.tab, "right");
        closeMenu();
      }}
      onSplitDown={() => {
        splitTab(menu.tab, "bottom");
        closeMenu();
      }}
      onCloseAll={() => {
        closeAll();
        closeMenu();
      }}
    />
  ) : null;

  return {
    contextMenu,
    openEmptyTabMenu: (event: MouseEvent<HTMLElement>) =>
      openMenu(event, EMPTY_TAB),
    openTabMenu: openMenu,
  };
}
