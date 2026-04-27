/**
 * TabSlice — vault 안의 열린 탭 목록을 workspace store 안에 묶는다.
 * (ADR-031 Phase B-γ part 2: tab-store 마이그레이션)
 *
 * 각 vault 의 workspace 가 자기 탭 묶음을 따로 보유 → vault 전환 시
 * 메모리에서 swap 만으로 탭 상태 유지 (multi-vault-spec §6.6.3).
 */

import type { StateCreator } from "zustand";

import { useEditorStore } from "@/store/editor-store";
import { useRecentStore } from "@/store/recent-store";
import {
  collectPanes,
  findPane,
  patchPaneInTree,
  type WorkspaceNode,
} from "@/store/workspace-types";
import type { WorkspaceTreeSlice } from "./workspace-tree-slice";

/** 탭 soft limit — 초과 시 경고 표시. 강제 차단은 아님. */
export const TAB_SOFT_LIMIT = 10;

export interface Tab {
  id: string;
  path: string;
  title: string;
  titleDraft?: string;
  pinned?: boolean;
}

export interface TabSlice {
  tabs: Tab[];
  activeId: string | null;

  openTab: (path: string) => void;
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

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return (i < 0 ? path : path.slice(i + 1)).replace(/\.md$/i, "");
}

function withTitleDraft(tab: Tab, draft: string | null): Tab {
  if (draft !== null) return { ...tab, titleDraft: draft };
  const { titleDraft: _titleDraft, ...rest } = tab;
  return rest;
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

async function openFileInEditor(path: string): Promise<void> {
  if (!path) {
    await closeEditorFile();
    return;
  }
  const editor = useEditorStore.getState();
  await editor.flushSave?.();
  await useEditorStore.getState().openFile(path);
  useRecentStore.getState().push(path);
}

async function closeEditorFile(): Promise<void> {
  const editor = useEditorStore.getState();
  await editor.flushSave?.();
  useEditorStore.getState().closeFile();
}

export function defaultTabSlice(): TabSlice {
  return {
    tabs: [],
    activeId: null,
    openTab: () => {},
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

type TabFullSlice = TabSlice & WorkspaceTreeSlice;

export const createTabSlice: StateCreator<TabFullSlice, [], [], TabSlice> = (
  set,
  get,
) => ({
  tabs: [],
  activeId: null,

  openTab: (path) => {
    const existing = get().tabs.find((t) => t.path === path);
    if (existing) {
      set({ activeId: existing.id });
      void openFileInEditor(existing.path);
      return;
    }
    const tab: Tab = { id: makeTabId(), path, title: basename(path) };
    set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id }));
    void openFileInEditor(path);
  },

  createEmptyTab: () => {
    const tab: Tab = { id: makeTabId(), path: "", title: "" };
    const { workspaceTree, activePaneId, tabs } = get();
    if (workspaceTree && activePaneId) {
      const pane = findPane(workspaceTree, activePaneId);
      if (pane) {
        const nextTabs = [...tabs, tab];
        set({
          tabs: nextTabs,
          activeId: tab.id,
          workspaceTree: patchPaneInTree(workspaceTree, activePaneId, {
            tabs: nextTabs,
            activeTabId: tab.id,
          }),
        });
        void closeEditorFile();
        return;
      }
    }
    set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.id }));
    void closeEditorFile();
  },

  promoteActiveEmptyTab: (path) => {
    const { tabs, activeId, workspaceTree, activePaneId } = get();
    if (!activeId) return false;
    const active = tabs.find((t) => t.id === activeId);
    if (!active || active.path !== "") return false;

    const promoted: Tab = { ...active, path, title: basename(path) };
    const nextTabs = tabs.map((t) => (t.id === activeId ? promoted : t));

    if (workspaceTree && activePaneId) {
      const pane = findPane(workspaceTree, activePaneId);
      if (pane) {
        const paneTabs = pane.tabs.map((t) =>
          t.id === activeId ? promoted : t,
        );
        const nextTree = patchPaneInTree(workspaceTree, activePaneId, {
          tabs: paneTabs,
          activeTabId: activeId,
        });
        set({ tabs: nextTabs, workspaceTree: nextTree });
      } else {
        set({ tabs: nextTabs });
      }
    } else {
      set({ tabs: nextTabs });
    }

    void openFileInEditor(path);
    return true;
  },

  closeTab: (id) => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().closePaneTab(activePaneId, id);
      return;
    }

    const { tabs, activeId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const next = tabs.filter((t) => t.id !== id);
    let nextActive = activeId;
    if (activeId === id) {
      const neighbor = next[idx] ?? next[idx - 1] ?? null;
      nextActive = neighbor?.id ?? null;
    }
    set({ tabs: next, activeId: nextActive });
    if (nextActive === null) {
      void closeEditorFile();
    } else if (nextActive !== activeId) {
      const t = next.find((x) => x.id === nextActive);
      if (t) void openFileInEditor(t.path);
    }
  },

  closeOthers: (id) => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().closeOtherPaneTabs(activePaneId, id);
      return;
    }

    const target = get().tabs.find((t) => t.id === id);
    if (!target) return;
    const next = get().tabs.filter((t) => t.id === id || t.pinned);
    set({ tabs: next, activeId: target.id });
    void openFileInEditor(target.path);
  },

  closeAll: () => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().closeAllPaneTabs(activePaneId);
      return;
    }

    const { tabs, activeId } = get();
    const next = tabs.filter((t) => t.pinned);
    const nextActive =
      next.find((t) => t.id === activeId)?.id ?? next[0]?.id ?? null;
    set({ tabs: next, activeId: nextActive });
    if (nextActive === null) {
      void closeEditorFile();
    } else {
      const tab = next.find((t) => t.id === nextActive);
      if (tab) void openFileInEditor(tab.path);
    }
  },

  closeTabsAfter: (id) => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().closePaneTabsAfter(activePaneId, id);
      return;
    }

    const { tabs, activeId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const next = tabs.filter((t, i) => i <= idx || t.pinned);
    const activeStillOpen = next.some((t) => t.id === activeId);
    const nextActive = activeStillOpen ? activeId : id;
    set({ tabs: next, activeId: nextActive });
    if (!activeStillOpen) {
      const t = next.find((x) => x.id === nextActive);
      if (t) void openFileInEditor(t.path);
    }
  },

  togglePinned: (id) => {
    const { workspaceTree, activePaneId } = get();
    if (workspaceTree && activePaneId) {
      get().togglePaneTabPinned(activePaneId, id);
      return;
    }

    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, pinned: !t.pinned } : t,
      ),
    }));
  },

  activate: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    set({ activeId: id });
    void openFileInEditor(tab.path);
  },

  activateIndex: (i) => {
    const tab = get().tabs[i];
    if (!tab) return;
    set({ activeId: tab.id });
    void openFileInEditor(tab.path);
  },

  activateNext: () => {
    const { tabs, activeId } = get();
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeId);
    const nextIdx = idx < 0 ? 0 : (idx + 1) % tabs.length;
    const tab = tabs[nextIdx];
    if (!tab) return;
    set({ activeId: tab.id });
    void openFileInEditor(tab.path);
  },

  activatePrev: () => {
    const { tabs, activeId } = get();
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeId);
    const prevIdx = idx < 0 ? 0 : (idx - 1 + tabs.length) % tabs.length;
    const tab = tabs[prevIdx];
    if (!tab) return;
    set({ activeId: tab.id });
    void openFileInEditor(tab.path);
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
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === oldPath
          ? { ...t, path: newPath, title: basename(newPath), titleDraft: undefined }
          : t.path.startsWith(`${oldPath}/`)
            ? {
                ...t,
                path: `${newPath}${t.path.slice(oldPath.length)}`,
                title: basename(`${newPath}${t.path.slice(oldPath.length)}`),
                titleDraft: undefined,
              }
            : t,
      ),
    }));
    // Phase D — tree 모드면 모든 pane 의 해당 path 도 갱신.
    if (get().workspaceTree) {
      get().updatePathInAllPanes(oldPath, newPath);
    }
  },

  removeByPath: (path) => {
    const { tabs, activeId } = get();
    const removed = tabs.filter(
      (t) => t.path === path || t.path.startsWith(`${path}/`),
    );
    if (removed.length === 0) return;
    const next = tabs.filter(
      (t) => !(t.path === path || t.path.startsWith(`${path}/`)),
    );
    let nextActive = activeId;
    if (removed.some((r) => r.id === activeId)) {
      const firstRemovedIdx = tabs.findIndex((t) => t.id === removed[0]!.id);
      const neighbor =
        next[firstRemovedIdx] ?? next[firstRemovedIdx - 1] ?? null;
      nextActive = neighbor?.id ?? null;
    }
    set({ tabs: next, activeId: nextActive });
    // Phase D — tree 모드면 모든 pane 의 해당 path 도 정리.
    if (get().workspaceTree) {
      get().removeFromAllPanes(path);
    }
    if (nextActive === null) {
      void closeEditorFile();
    } else {
      const t = next.find((x) => x.id === nextActive);
      if (t) void openFileInEditor(t.path);
    }
  },

  reorder: (from, to) => {
    const { tabs } = get();
    if (from === to || from < 0 || from >= tabs.length) return;
    const next = tabs.slice();
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    const target = Math.max(0, Math.min(next.length, to));
    next.splice(target, 0, moved);
    set({ tabs: next });
  },

  resetTabs: () => set({ tabs: [], activeId: null }),
});
