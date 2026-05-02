/**
 * TabSlice — vault 안의 열린 탭 목록을 workspace store 안에 묶는다.
 * (ADR-031 Phase B-γ part 2: tab-store 마이그레이션)
 *
 * 각 vault 의 workspace 가 자기 탭 묶음을 따로 보유 → vault 전환 시
 * 메모리에서 swap 만으로 탭 상태 유지 (multi-vault-spec §6.6.3).
 */

import type { StateCreator } from "zustand";

import { useRecentStore } from "@/store/recent-store";
import { closeTerminalSessionsForTabs } from "@/lib/terminal-session-registry";
import {
  collectPanes,
  findPane,
  patchPaneInTree,
  type WorkspaceNode,
} from "@/store/workspace-types";
import type { WorkspaceTreeSlice } from "./workspace-tree-slice";
import {
  basename,
  closeOtherTabsInList,
  closeTabInList,
  closeTabsAfterInList,
  closeUnpinnedTabsInList,
  promoteEmptyTab,
  removePathFromTabs,
  renamePathInTabs,
  reorderTabs,
  togglePinnedInList,
  withTitleDraft,
} from "./tab-helpers";
import type { DocumentRuntimeSlice } from "./document-runtime-slice";
import type { EditorSlice } from "./editor-slice";

/** 탭 soft limit — 초과 시 경고 표시. 강제 차단은 아님. */
export const TAB_SOFT_LIMIT = 10;

export type TabKind = "document" | "terminal";

export interface Tab {
  id: string;
  kind?: TabKind;
  path: string;
  title: string;
  titleDraft?: string;
  pinned?: boolean;
}

export interface TabSlice {
  tabs: Tab[];
  activeId: string | null;

  openTab: (path: string) => void;
  openTerminalTab: () => void;
  createEmptyTab: () => void;
  promoteActiveEmptyTab: (path: string) => boolean;
  closeTab: (id: string) => void;
  closeOthers: (id: string) => void;
  closeTabsAfter: (id: string) => void;
  closeAll: () => void;
  togglePinned: (id: string) => void;
  activate: (id: string) => void;
  activateIndex: (i: number) => void;
  activateNext: () => void;
  activatePrev: () => void;
  setTitleDraft: (path: string, draft: string | null) => void;
  updatePath: (oldPath: string, newPath: string) => void;
  removeByPath: (path: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  resetTabs: () => void;
}

/** Client-side tab IDs are ephemeral workspace identifiers, not persisted file IDs. */
export function makeTabId(): string {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTerminalTab(
  tab: Tab | null | undefined,
): tab is Tab & { kind: "terminal" } {
  return tab?.kind === "terminal";
}

export function makeTerminalTab(): Tab {
  return {
    id: makeTabId(),
    kind: "terminal",
    path: "",
    title: "Terminal",
  };
}

function patchTitleDraftInTree(
  tree: WorkspaceNode,
  path: string,
  draft: string | null,
): WorkspaceNode {
  let nextTree = tree;
  for (const pane of collectPanes(tree)) {
    const nextTabs = pane.tabs.map((tab) =>
      tab.path === path ? withTitleDraft(tab, draft) : tab,
    );
    if (nextTabs.some((tab, index) => tab !== pane.tabs[index])) {
      nextTree = patchPaneInTree(nextTree, pane.id, { tabs: nextTabs });
    }
  }
  return nextTree;
}

type TabFullSlice = TabSlice &
  WorkspaceTreeSlice &
  EditorSlice &
  Partial<DocumentRuntimeSlice>;

function isActiveDocumentTarget(
  state: TabFullSlice,
  path: string,
  tabId: string | null,
): boolean {
  if (!tabId || state.activeId !== tabId) return false;
  const tab = state.tabs.find((item) => item.id === tabId);
  return !!tab && !isTerminalTab(tab) && tab.path === path;
}

async function openFileInEditor(
  getState: () => TabFullSlice,
  path: string,
  tabId: string | null,
): Promise<void> {
  if (!path) {
    await closeEditorFile(getState, tabId);
    return;
  }
  const state = getState();
  state.captureActiveDocumentRuntime?.();
  await state.flushSave?.();
  const latest = getState();
  if (!isActiveDocumentTarget(latest, path, tabId)) return;
  await latest.openFile(path, tabId);
  useRecentStore.getState().push(path);
}

async function closeEditorFile(
  getState: () => TabFullSlice,
  expectedActiveId?: string | null,
): Promise<void> {
  const state = getState();
  state.captureActiveDocumentRuntime?.();
  await state.flushSave?.();
  const latest = getState();
  if (
    expectedActiveId !== undefined &&
    latest.activeId !== expectedActiveId
  ) {
    return;
  }
  const activeTab = latest.activeId
    ? latest.tabs.find((item) => item.id === latest.activeId)
    : null;
  if (activeTab && !isTerminalTab(activeTab) && activeTab.path) return;
  latest.closeFile();
}

function syncEditorToActiveTab(
  getState: () => TabFullSlice,
  tabs: Tab[],
  activeId: string | null,
): void {
  if (activeId === null) {
    void closeEditorFile(getState, null);
    return;
  }
  const tab = tabs.find((item) => item.id === activeId);
  if (!tab || isTerminalTab(tab)) {
    void closeEditorFile(getState, activeId);
    return;
  }
  void openFileInEditor(getState, tab.path, tab.id);
}

export function defaultTabSlice(): TabSlice {
  return {
    tabs: [],
    activeId: null,
    openTab: () => {},
    openTerminalTab: () => {},
    createEmptyTab: () => {},
    promoteActiveEmptyTab: () => false,
    closeTab: () => {},
    closeOthers: () => {},
    closeTabsAfter: () => {},
    closeAll: () => {},
    togglePinned: () => {},
    activate: () => {},
    activateIndex: () => {},
    activateNext: () => {},
    activatePrev: () => {},
    setTitleDraft: () => {},
    updatePath: () => {},
    removeByPath: () => {},
    reorder: () => {},
    resetTabs: () => {},
  };
}

function patchActivePaneTabs(
  tree: WorkspaceNode,
  activePaneId: string | null,
  tabs: Tab[],
  activeTabId: string | null,
): WorkspaceNode | null {
  if (!activePaneId) return null;
  const pane = findPane(tree, activePaneId);
  if (!pane) return null;
  return patchPaneInTree(tree, activePaneId, {
    tabs,
    activeTabId,
  });
}

export const createTabSlice: StateCreator<TabFullSlice, [], [], TabSlice> = (
  set,
  get,
) => ({
  tabs: [],
  activeId: null,

  openTab: (path) => {
    const { workspaceTree, activePaneId, tabs } = get();
    const existing = tabs.find((t) => !isTerminalTab(t) && t.path === path);
    if (existing) {
      const nextTree = workspaceTree
        ? patchActivePaneTabs(workspaceTree, activePaneId, tabs, existing.id)
        : null;
      if (nextTree) {
        set({ activeId: existing.id, workspaceTree: nextTree });
      } else {
        set({ activeId: existing.id });
      }
      void openFileInEditor(get, existing.path, existing.id);
      return;
    }
    const tab: Tab = { id: makeTabId(), path, title: basename(path) };
    const nextTabs = [...tabs, tab];
    const nextTree = workspaceTree
      ? patchActivePaneTabs(workspaceTree, activePaneId, nextTabs, tab.id)
      : null;
    if (nextTree) {
      set({ tabs: nextTabs, activeId: tab.id, workspaceTree: nextTree });
    } else {
      set({ tabs: nextTabs, activeId: tab.id });
    }
    void openFileInEditor(get, path, tab.id);
  },

  openTerminalTab: () => {
    const tab = makeTerminalTab();
    const { workspaceTree, activePaneId, tabs } = get();
    const nextTabs = [...tabs, tab];
    const nextTree = workspaceTree
      ? patchActivePaneTabs(workspaceTree, activePaneId, nextTabs, tab.id)
      : null;
    if (nextTree) {
      set({ tabs: nextTabs, activeId: tab.id, workspaceTree: nextTree });
    } else {
      set({ tabs: nextTabs, activeId: tab.id });
    }
    void closeEditorFile(get, tab.id);
  },

  createEmptyTab: () => {
    const tab: Tab = { id: makeTabId(), path: "", title: "" };
    const { workspaceTree, activePaneId, tabs } = get();
    const nextTabs = [...tabs, tab];
    const nextTree = workspaceTree
      ? patchActivePaneTabs(workspaceTree, activePaneId, nextTabs, tab.id)
      : null;
    if (nextTree) {
      set({
        tabs: nextTabs,
        activeId: tab.id,
        workspaceTree: nextTree,
      });
      void closeEditorFile(get, tab.id);
      return;
    }
    set({ tabs: nextTabs, activeId: tab.id });
    void closeEditorFile(get, tab.id);
  },

  promoteActiveEmptyTab: (path) => {
    const { tabs, activeId, workspaceTree, activePaneId } = get();
    const promotion = promoteEmptyTab(tabs, activeId, path);
    if (!promotion) return false;

    if (workspaceTree && activePaneId) {
      const paneTabs = findPane(workspaceTree, activePaneId)?.tabs.map((t) =>
        t.id === activeId ? promotion.tab : t,
      );
      if (paneTabs) {
        const nextTree = patchActivePaneTabs(
          workspaceTree,
          activePaneId,
          paneTabs,
          activeId,
        );
        if (!nextTree) return false;
        set({ tabs: promotion.tabs, workspaceTree: nextTree });
      } else {
        set({ tabs: promotion.tabs });
      }
    } else {
      set({ tabs: promotion.tabs });
    }

    void openFileInEditor(get, path, activeId);
    return true;
  },

  closeTab: (id) => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().closePaneTab(activePaneId, id);
      return;
    }

    const { tabs, activeId } = get();
    closeTerminalSessionsForTabs(tabs.filter((tab) => tab.id === id));
    const next = closeTabInList(tabs, activeId, id);
    if (!next) return;
    set({ tabs: next.tabs, activeId: next.activeId });
    if (next.activeChanged) {
      syncEditorToActiveTab(get, next.tabs, next.activeId);
    }
    get().removeDocumentRuntime?.(id);
  },

  closeOthers: (id) => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().closeOtherPaneTabs(activePaneId, id);
      return;
    }

    const tabs = get().tabs;
    const next = closeOtherTabsInList(tabs, id);
    if (!next) return;
    closeTerminalSessionsForTabs(
      tabs.filter(
        (tab) => !next.tabs.some((remainingTab) => remainingTab.id === tab.id),
      ),
    );
    const target = next.tabs.find((tab) => tab.id === next.activeId);
    const removedTabs = tabs.filter(
      (tab) => !next.tabs.some((remainingTab) => remainingTab.id === tab.id),
    );
    set({ tabs: next.tabs, activeId: next.activeId });
    if (!target) return;
    syncEditorToActiveTab(get, next.tabs, next.activeId);
    for (const tab of removedTabs) get().removeDocumentRuntime?.(tab.id);
  },

  closeAll: () => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().closeAllPaneTabs(activePaneId);
      return;
    }

    const tabs = get().tabs;
    const next = closeUnpinnedTabsInList(tabs, get().activeId);
    closeTerminalSessionsForTabs(
      tabs.filter(
        (tab) => !next.tabs.some((remainingTab) => remainingTab.id === tab.id),
      ),
    );
    const removedTabs = tabs.filter(
      (tab) => !next.tabs.some((remainingTab) => remainingTab.id === tab.id),
    );
    set({ tabs: next.tabs, activeId: next.activeId });
    syncEditorToActiveTab(get, next.tabs, next.activeId);
    for (const tab of removedTabs) get().removeDocumentRuntime?.(tab.id);
  },

  closeTabsAfter: (id) => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().closePaneTabsAfter(activePaneId, id);
      return;
    }

    const tabs = get().tabs;
    const next = closeTabsAfterInList(tabs, get().activeId, id);
    if (!next) return;
    closeTerminalSessionsForTabs(
      tabs.filter(
        (tab) => !next.tabs.some((remainingTab) => remainingTab.id === tab.id),
      ),
    );
    const removedTabs = tabs.filter(
      (tab) => !next.tabs.some((remainingTab) => remainingTab.id === tab.id),
    );
    set({ tabs: next.tabs, activeId: next.activeId });
    if (next.activeChanged) {
      syncEditorToActiveTab(get, next.tabs, next.activeId);
    }
    for (const tab of removedTabs) get().removeDocumentRuntime?.(tab.id);
  },

  togglePinned: (id) => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().togglePaneTabPinned(activePaneId, id);
      return;
    }

    set((s) => ({ tabs: togglePinnedInList(s.tabs, id) }));
  },

  activate: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    set({ activeId: id });
    syncEditorToActiveTab(get, get().tabs, id);
  },

  activateIndex: (i) => {
    const tab = get().tabs[i];
    if (!tab) return;
    set({ activeId: tab.id });
    syncEditorToActiveTab(get, get().tabs, tab.id);
  },

  activateNext: () => {
    const { tabs, activeId } = get();
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeId);
    const nextIdx = idx < 0 ? 0 : (idx + 1) % tabs.length;
    const tab = tabs[nextIdx];
    if (!tab) return;
    set({ activeId: tab.id });
    syncEditorToActiveTab(get, tabs, tab.id);
  },

  activatePrev: () => {
    const { tabs, activeId } = get();
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeId);
    const prevIdx = idx < 0 ? 0 : (idx - 1 + tabs.length) % tabs.length;
    const tab = tabs[prevIdx];
    if (!tab) return;
    set({ activeId: tab.id });
    syncEditorToActiveTab(get, tabs, tab.id);
  },

  setTitleDraft: (path, draft) => {
    if (!path) return;
    const nextTabs = get().tabs.map((tab) =>
      tab.path === path ? withTitleDraft(tab, draft) : tab,
    );
    const next: Partial<TabFullSlice> = { tabs: nextTabs };
    const tree = get().workspaceTree;
    if (tree) {
      next.workspaceTree = patchTitleDraftInTree(tree, path, draft);
    }
    set(next);
  },

  updatePath: (oldPath, newPath) => {
    get().renameDocumentRuntimePath?.(oldPath, newPath);
    set((s) => ({ tabs: renamePathInTabs(s.tabs, oldPath, newPath) }));
    // Phase D — tree 모드면 모든 pane 의 해당 path 도 갱신.
    if (get().workspaceTree) {
      get().updatePathInAllPanes(oldPath, newPath);
    }
  },

  removeByPath: (path) => {
    get().removeDocumentRuntimesForPath?.(path);
    const next = removePathFromTabs(get().tabs, get().activeId, path);
    if (!next) return;
    set({ tabs: next.tabs, activeId: next.activeId });
    // Phase D — tree 모드면 모든 pane 의 해당 path 도 정리.
    if (get().workspaceTree) {
      get().removeFromAllPanes(path);
    }
    syncEditorToActiveTab(get, next.tabs, next.activeId);
  },

  reorder: (from, to) => {
    const next = reorderTabs(get().tabs, from, to);
    if (!next) return;
    set({ tabs: next });
  },

  resetTabs: () => {
    const tabs = get().tabs;
    closeTerminalSessionsForTabs(tabs);
    for (const tab of tabs) get().removeDocumentRuntime?.(tab.id);
    set({ tabs: [], activeId: null });
  },
});
