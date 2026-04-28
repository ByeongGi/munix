import type { Tab } from "./tab-slice";
import { isTerminalTab } from "./tab-slice";

export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return (i < 0 ? path : path.slice(i + 1)).replace(/\.md$/i, "");
}

export function withTitleDraft(tab: Tab, draft: string | null): Tab {
  if (draft !== null) return { ...tab, titleDraft: draft };
  const { titleDraft: _titleDraft, ...rest } = tab;
  return rest;
}

export function promoteEmptyTab(
  tabs: Tab[],
  activeId: string | null,
  path: string,
): { tabs: Tab[]; tab: Tab } | null {
  if (!activeId) return null;
  const active = tabs.find((tab) => tab.id === activeId);
  if (!active || isTerminalTab(active) || active.path !== "") return null;

  const promoted: Tab = { ...active, path, title: basename(path) };
  return {
    tabs: tabs.map((tab) => (tab.id === activeId ? promoted : tab)),
    tab: promoted,
  };
}

export function closeTabInList(
  tabs: Tab[],
  activeId: string | null,
  tabId: string,
): { tabs: Tab[]; activeId: string | null; activeChanged: boolean } | null {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) return null;
  const nextTabs = tabs.filter((tab) => tab.id !== tabId);
  const nextActiveId =
    activeId === tabId
      ? (nextTabs[index] ?? nextTabs[index - 1] ?? null)?.id ?? null
      : activeId;
  return {
    tabs: nextTabs,
    activeId: nextActiveId,
    activeChanged: nextActiveId !== activeId,
  };
}

export function closeOtherTabsInList(
  tabs: Tab[],
  tabId: string,
): { tabs: Tab[]; activeId: string } | null {
  const target = tabs.find((tab) => tab.id === tabId);
  if (!target) return null;
  return {
    tabs: tabs.filter((tab) => tab.id === tabId || tab.pinned),
    activeId: target.id,
  };
}

export function closeTabsAfterInList(
  tabs: Tab[],
  activeId: string | null,
  tabId: string,
): { tabs: Tab[]; activeId: string | null; activeChanged: boolean } | null {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) return null;
  const nextTabs = tabs.filter((tab, i) => i <= index || tab.pinned);
  const activeStillOpen = nextTabs.some((tab) => tab.id === activeId);
  return {
    tabs: nextTabs,
    activeId: activeStillOpen ? activeId : tabId,
    activeChanged: !activeStillOpen,
  };
}

export function closeUnpinnedTabsInList(
  tabs: Tab[],
  activeId: string | null,
): { tabs: Tab[]; activeId: string | null } {
  const nextTabs = tabs.filter((tab) => tab.pinned);
  const nextActiveId =
    nextTabs.find((tab) => tab.id === activeId)?.id ??
    nextTabs[0]?.id ??
    null;
  return { tabs: nextTabs, activeId: nextActiveId };
}

export function togglePinnedInList(tabs: Tab[], tabId: string): Tab[] {
  return tabs.map((tab) =>
    tab.id === tabId ? { ...tab, pinned: !tab.pinned } : tab,
  );
}

export function renamePathInTabs(
  tabs: Tab[],
  oldPath: string,
  newPath: string,
): Tab[] {
  return tabs.map((tab) => {
    if (!tab.path || isTerminalTab(tab)) return tab;
    if (tab.path === oldPath) {
      return {
        ...tab,
        path: newPath,
        title: basename(newPath),
        titleDraft: undefined,
      };
    }
    if (tab.path.startsWith(`${oldPath}/`)) {
      const path = `${newPath}${tab.path.slice(oldPath.length)}`;
      return {
        ...tab,
        path,
        title: basename(path),
        titleDraft: undefined,
      };
    }
    return tab;
  });
}

export function removePathFromTabs(
  tabs: Tab[],
  activeId: string | null,
  path: string,
): { tabs: Tab[]; activeId: string | null } | null {
  const matchesPath = (tabPath: string) =>
    tabPath !== "" && (tabPath === path || tabPath.startsWith(`${path}/`));
  const removed = tabs.filter((tab) => matchesPath(tab.path));
  if (removed.length === 0) return null;

  const nextTabs = tabs.filter((tab) => !matchesPath(tab.path));
  const removedActive = removed.some((tab) => tab.id === activeId);
  if (!removedActive) return { tabs: nextTabs, activeId };

  const firstRemovedIndex = tabs.findIndex((tab) => tab.id === removed[0]?.id);
  const neighbor =
    nextTabs[firstRemovedIndex] ?? nextTabs[firstRemovedIndex - 1] ?? null;
  return { tabs: nextTabs, activeId: neighbor?.id ?? null };
}

export function reorderTabs(
  tabs: Tab[],
  fromIndex: number,
  toIndex: number,
): Tab[] | null {
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= tabs.length) {
    return null;
  }
  const nextTabs = tabs.slice();
  const [moved] = nextTabs.splice(fromIndex, 1);
  if (!moved) return null;
  const target = Math.max(0, Math.min(nextTabs.length, toIndex));
  nextTabs.splice(target, 0, moved);
  return nextTabs;
}
