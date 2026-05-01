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
import { isTerminalTab, makeTabId, type Tab } from "./tab-slice";

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

export function makeRootPane(tabs: Tab[], activeTabId: string | null): PaneNode {
  return {
    type: "pane",
    id: makePaneId(),
    tabs,
    activeTabId,
  };
}

export function makeWorkspaceTab(path = ""): Tab {
  return {
    id: makeTabId(),
    kind: "document",
    path,
    title: basenameWithoutMarkdownExtension(path),
  };
}

export interface WorkspaceTreeTransition {
  tree: WorkspaceNode | null;
  activePaneId: string | null;
}

export function splitSinglePaneWorkspace(
  tabs: Tab[],
  activeTabId: string | null,
  zone: EdgeZone,
  initialTab?: Tab,
): WorkspaceTreeTransition {
  const rootPane = makeRootPane(tabs, activeTabId);
  const fresh = makeFreshPane(initialTab);
  return {
    tree: buildSplit(zone, rootPane, fresh),
    activePaneId: fresh.id,
  };
}

export function splitPaneInWorkspace(
  tree: WorkspaceNode,
  targetPaneId: string,
  zone: EdgeZone,
  initialTab?: Tab,
): WorkspaceTreeTransition | null {
  const target = collectPanes(tree).find((pane) => pane.id === targetPaneId);
  if (!target) return null;

  const fresh = makeFreshPane(initialTab);
  const split = buildSplit(zone, target, fresh);
  return {
    tree: replaceNode(tree, target.id, split),
    activePaneId: fresh.id,
  };
}

export function closePaneInWorkspace(
  tree: WorkspaceNode,
  paneId: string,
  activePaneId: string | null,
): WorkspaceTreeTransition {
  const nextTree = removePane(tree, paneId);
  if (!nextTree) return { tree: null, activePaneId: null };
  if (isPaneNode(nextTree)) return { tree: nextTree, activePaneId: null };

  const nextActivePaneId =
    activePaneId === paneId || activePaneId === null
      ? (collectPanes(nextTree)[0]?.id ?? null)
      : activePaneId;

  return {
    tree: nextTree,
    activePaneId: nextActivePaneId,
  };
}

export function splitMoveFromSinglePaneWorkspace(
  tabs: Tab[],
  activeTabId: string | null,
  tabId: string,
  zone: EdgeZone,
): WorkspaceTreeTransition | null {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return null;

  const rootSourcePane = makeRootPane(tabs, activeTabId);
  const sourcePatch = removeTabFromPane(rootSourcePane, tabId);
  if (!sourcePatch) return null;

  const sourceWithFallback = ensurePaneTabsPatchHasPlaceholder(sourcePatch);
  const rootPane = makeRootPane(
    sourceWithFallback.tabs,
    sourceWithFallback.activeTabId,
  );
  const fresh = makeFreshPane(tab);
  return {
    tree: buildSplit(zone, rootPane, fresh),
    activePaneId: fresh.id,
  };
}

export function splitMoveInWorkspace(
  tree: WorkspaceNode,
  sourcePaneId: string,
  tabId: string,
  targetPaneId: string,
  zone: EdgeZone,
): WorkspaceTreeTransition | null {
  const source = collectPanes(tree).find((pane) => pane.id === sourcePaneId);
  const target = collectPanes(tree).find((pane) => pane.id === targetPaneId);
  if (!source || !target) return null;

  const tab = source.tabs.find((t) => t.id === tabId);
  if (!tab) return null;

  const sourcePatch = removeTabFromPane(source, tabId);
  if (!sourcePatch) return null;
  const sourceWithFallback = ensurePaneTabsPatchHasPlaceholder(sourcePatch);

  const treeAfterRemove = patchPaneInTree(tree, sourcePaneId, {
    tabs: sourceWithFallback.tabs,
    activeTabId: sourceWithFallback.activeTabId,
  });
  const refreshedTarget = collectPanes(treeAfterRemove).find(
    (pane) => pane.id === targetPaneId,
  );
  if (!refreshedTarget) return null;

  const fresh = makeFreshPane(tab);
  const split = buildSplit(zone, refreshedTarget, fresh);
  const nextTree = pruneEmptyPanes(
    replaceNode(treeAfterRemove, targetPaneId, split),
  );

  return {
    tree: nextTree,
    activePaneId: fresh.id,
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

function ensurePaneTabsPatchHasPlaceholder(patch: PaneTabsPatch): PaneTabsPatch {
  if (patch.tabs.length > 0) return patch;
  const tab = makeWorkspaceTab("");
  return {
    tabs: [tab],
    activeTabId: tab.id,
  };
}

export function reorderTabsInPane(
  pane: PaneNode,
  tabId: string,
  toIndex?: number,
): Tab[] | null {
  const fromIndex = pane.tabs.findIndex((t) => t.id === tabId);
  const targetIndex = toIndex ?? pane.tabs.length - 1;
  if (fromIndex < 0 || fromIndex === targetIndex) return null;

  const tabs = pane.tabs.slice();
  const [moved] = tabs.splice(fromIndex, 1);
  if (!moved) return null;
  const insertAt = Math.max(0, Math.min(tabs.length, targetIndex));
  tabs.splice(insertAt, 0, moved);
  return tabs;
}

export interface PaneTabTransfer {
  sourcePatch: PaneTabsPatch;
  destinationPatch: PaneTabsPatch;
  movedTab: Tab;
}

export function moveTabBetweenPanes(
  source: PaneNode,
  destination: PaneNode,
  tabId: string,
  destinationIndex?: number,
): PaneTabTransfer | null {
  const movedTab = source.tabs.find((t) => t.id === tabId);
  if (!movedTab) return null;
  const sourcePatch = removeTabFromPane(source, tabId);
  if (!sourcePatch) return null;

  const insertAt =
    destinationIndex !== undefined
      ? Math.max(0, Math.min(destination.tabs.length, destinationIndex))
      : destination.tabs.length;
  const destinationTabs = destination.tabs.slice();
  destinationTabs.splice(insertAt, 0, movedTab);

  return {
    sourcePatch: ensurePaneTabsPatchHasPlaceholder(sourcePatch),
    destinationPatch: {
      tabs: destinationTabs,
      activeTabId: movedTab.id,
    },
    movedTab,
  };
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

export function removePathTabsFromPane(
  pane: PaneNode,
  path: string,
): PaneTabsPatch | null {
  const matchPath = (tabPath: string) =>
    tabPath !== "" && (tabPath === path || tabPath.startsWith(`${path}/`));
  if (!pane.tabs.some((tab) => matchPath(tab.path))) return null;

  const removedIds = pane.tabs
    .filter((tab) => matchPath(tab.path))
    .map((tab) => tab.id);
  const tabs = pane.tabs.filter((tab) => !matchPath(tab.path));
  const activeTabId =
    pane.activeTabId && removedIds.includes(pane.activeTabId)
      ? getNeighborTabIdAfterRemoval(pane.tabs, tabs, pane.activeTabId)
      : pane.activeTabId;

  return { tabs, activeTabId };
}

export function renamePathTabsInPane(
  pane: PaneNode,
  oldPath: string,
  newPath: string,
): Tab[] | null {
  let mutated = false;
  const tabs = pane.tabs.map((tab) => {
    if (!tab.path || isTerminalTab(tab)) return tab;
    if (tab.path === oldPath) {
      mutated = true;
      return makeRenamedTab(tab, newPath);
    }
    if (tab.path.startsWith(`${oldPath}/`)) {
      mutated = true;
      return makeRenamedTab(tab, `${newPath}${tab.path.slice(oldPath.length)}`);
    }
    return tab;
  });

  return mutated ? tabs : null;
}

function makeRenamedTab(tab: Tab, path: string): Tab {
  return {
    ...tab,
    path,
    title: basenameWithoutMarkdownExtension(path),
    titleDraft: undefined,
  };
}

export function basenameWithoutMarkdownExtension(path: string): string {
  const i = path.lastIndexOf("/");
  return (i < 0 ? path : path.slice(i + 1)).replace(/\.md$/i, "");
}
