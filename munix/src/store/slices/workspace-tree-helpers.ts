import {
  collectPanes,
  isPaneNode,
  isSplitNode,
  makePaneId,
  makeSplitId,
  patchPaneInTree,
  type DropZone,
  type PaneNode,
  type SplitDirection,
  type SplitNode,
  type WorkspaceNode,
} from "../workspace-types";
import { makeTabId, type Tab } from "./tab-slice";

export type EdgeZone = Exclude<DropZone, "center">;

function zoneToDirection(zone: EdgeZone): SplitDirection {
  return zone === "left" || zone === "right" ? "row" : "column";
}

function isNewPaneFirst(zone: EdgeZone): boolean {
  return zone === "left" || zone === "top";
}

export function buildSplit(
  zone: EdgeZone,
  existing: WorkspaceNode,
  fresh: WorkspaceNode,
): SplitNode {
  const direction = zoneToDirection(zone);
  return {
    type: "split",
    id: makeSplitId(),
    direction,
    ratio: 0.5,
    first: isNewPaneFirst(zone) ? fresh : existing,
    second: isNewPaneFirst(zone) ? existing : fresh,
  };
}

export function replaceNode(
  node: WorkspaceNode,
  targetId: string,
  replacement: WorkspaceNode,
): WorkspaceNode {
  if (node.id === targetId) return replacement;
  if (isSplitNode(node)) {
    const first = replaceNode(node.first, targetId, replacement);
    const second = replaceNode(node.second, targetId, replacement);
    if (first === node.first && second === node.second) return node;
    return { ...node, first, second };
  }
  return node;
}

export function removePane(
  node: WorkspaceNode,
  paneId: string,
): WorkspaceNode | null {
  if (isPaneNode(node)) {
    return node.id === paneId ? null : node;
  }
  const first = removePane(node.first, paneId);
  const second = removePane(node.second, paneId);
  if (first === null && second === null) return null;
  if (first === null) return second;
  if (second === null) return first;
  if (first === node.first && second === node.second) return node;
  return { ...node, first, second };
}

export function makeFreshPane(initialTab?: Tab): PaneNode {
  return {
    type: "pane",
    id: makePaneId(),
    tabs: initialTab ? [initialTab] : [],
    activeTabId: initialTab?.id ?? null,
  };
}

export function makeWorkspaceTab(path = ""): Tab {
  return {
    id: makeTabId(),
    path,
    title: basenameWithoutMarkdownExtension(path),
  };
}

export function pruneEmptyPanes(
  node: WorkspaceNode | null,
): WorkspaceNode | null {
  if (!node) return null;
  const panes = collectPanes(node);
  if (panes.length <= 1) return node;

  const prune = (current: WorkspaceNode): WorkspaceNode | null => {
    if (isPaneNode(current)) {
      return current.tabs.length === 0 ? null : current;
    }
    const first = prune(current.first);
    const second = prune(current.second);
    if (first === null && second === null) return null;
    if (first === null) return second;
    if (second === null) return first;
    if (first === current.first && second === current.second) return current;
    return { ...current, first, second };
  };

  return prune(node) ?? panes[0] ?? null;
}

export function captureGlobalIntoActivePane(
  tree: WorkspaceNode,
  activePaneId: string | null,
  tabs: Tab[],
  activeTabId: string | null,
): WorkspaceNode {
  if (!activePaneId) return tree;
  return patchPaneInTree(tree, activePaneId, {
    tabs,
    activeTabId,
  });
}

export function getNeighborTabIdAfterRemoval(
  tabsBeforeRemoval: Tab[],
  tabsAfterRemoval: Tab[],
  removedTabId: string,
): string | null {
  const removedIdx = tabsBeforeRemoval.findIndex((t) => t.id === removedTabId);
  const neighbor =
    tabsAfterRemoval[removedIdx] ?? tabsAfterRemoval[removedIdx - 1] ?? null;
  return neighbor?.id ?? null;
}

export interface PaneTabsPatch {
  tabs: Tab[];
  activeTabId: string | null;
}

export function removeTabFromPane(
  pane: PaneNode,
  tabId: string,
): PaneTabsPatch | null {
  if (!pane.tabs.some((t) => t.id === tabId)) return null;
  const tabs = pane.tabs.filter((t) => t.id !== tabId);
  const activeTabId =
    pane.activeTabId === tabId
      ? getNeighborTabIdAfterRemoval(pane.tabs, tabs, tabId)
      : pane.activeTabId;
  return { tabs, activeTabId };
}

export function closeOtherTabsInPane(
  pane: PaneNode,
  tabId: string,
): PaneTabsPatch | null {
  const target = pane.tabs.find((t) => t.id === tabId);
  if (!target) return null;
  return {
    tabs: pane.tabs.filter((t) => t.id === tabId || t.pinned),
    activeTabId: target.id,
  };
}

export function closeTabsAfterInPane(
  pane: PaneNode,
  tabId: string,
): PaneTabsPatch | null {
  const idx = pane.tabs.findIndex((t) => t.id === tabId);
  if (idx < 0) return null;
  const tabs = pane.tabs.filter((t, i) => i <= idx || t.pinned);
  const activeStillOpen = tabs.some((t) => t.id === pane.activeTabId);
  return {
    tabs,
    activeTabId: activeStillOpen ? pane.activeTabId : tabId,
  };
}

export function closeUnpinnedTabsInPane(pane: PaneNode): PaneTabsPatch | null {
  if (pane.tabs.length === 0) return null;
  const tabs = pane.tabs.filter((t) => t.pinned);
  const activeTabId =
    tabs.find((t) => t.id === pane.activeTabId)?.id ?? tabs[0]?.id ?? null;
  return { tabs, activeTabId };
}

export function togglePaneTabPinnedState(
  pane: PaneNode,
  tabId: string,
): Tab[] | null {
  if (!pane.tabs.some((t) => t.id === tabId)) return null;
  return pane.tabs.map((t) =>
    t.id === tabId ? { ...t, pinned: !t.pinned } : t,
  );
}

export function basenameWithoutMarkdownExtension(path: string): string {
  const i = path.lastIndexOf("/");
  return (i < 0 ? path : path.slice(i + 1)).replace(/\.md$/i, "");
}
