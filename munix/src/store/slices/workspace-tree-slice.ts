/**
 * WorkspaceTreeSlice — pane split 트리를 workspace store 안에 묶는다.
 * (workspace-split-spec §13 Phase A/B)
 *
 * 단일 pane 모드 (workspaceTree === null) 일 땐 기존 TabSlice 의
 * `tabs/activeId` 가 그대로 root pane 역할을 한다. split 명령이 처음
 * 실행될 때 tree 가 promotion 된다:
 *   - 기존 tabs/activeId → root PaneNode 로 이전
 *   - 새 PaneNode 생성 후 SplitNode 로 감쌈
 *
 * tree 모드에서 마지막 pane 이 닫히면 다시 단일 pane 모드로 환원
 * (`workspaceTree = null`). 이 때 남은 pane 의 tabs/activeTabId 는
 * 기존 TabSlice 슬롯으로 mirror 되어 회귀 없이 동작한다.
 *
 * **Phase B mirror 정책 (active pane swap):**
 * - tree 모드에서 글로벌 `tabs/activeId` 는 항상 active pane 의
 *   `tabs/activeTabId` 와 동기. 즉 active pane = 글로벌 mirror.
 * - active pane 이 바뀔 때 (setActivePane / splitPane / closePane):
 *   1) 현재 글로벌 tabs/activeId 를 현재 active pane 의 PaneNode 로 캡처
 *   2) 새 active pane 의 tabs/activeTabId 를 글로벌로 swap
 *   3) editor 에 새 active tab 의 path 를 openFile (없으면 closeFile)
 * - 같은 pane 안 TabSlice 액션 (openTab/closeTab/...) 호출 후에는
 *   active pane 의 PaneNode 가 일시적으로 stale 이지만, swap 직전
 *   capture 단계에서 글로벌 → active pane 으로 덮어써져 일관성 유지.
 */

import type { StateCreator } from "zustand";

import { closeTerminalSessionsForTabs } from "@/lib/terminal-session-registry";
import {
  collectPanes,
  findPane,
  isPaneNode,
  patchPaneInTree,
  patchSplitRatio,
  type PaneNode,
  type WorkspaceNode,
} from "../workspace-types";
import type { EditorSlice } from "./editor-slice";
import { isTerminalTab, type Tab, type TabSlice } from "./tab-slice";
import {
  captureGlobalIntoActivePane,
  closePaneInWorkspace,
  type EdgeZone,
  makeWorkspaceTab,
  moveTabBetweenPanes,
  pruneEmptyPanes,
  removePathTabsFromPane,
  reorderTabsInPane,
  closeOtherTabsInPane,
  closeTabsAfterInPane,
  closeUnpinnedTabsInPane,
  renamePathTabsInPane,
  removeTabFromPane,
  splitMoveFromSinglePaneWorkspace,
  splitMoveInWorkspace,
  splitPaneInWorkspace,
  splitSinglePaneWorkspace,
  togglePaneTabPinnedState,
} from "./workspace-tree-helpers";

interface WorkspaceTreeState {
  workspaceTree: WorkspaceNode | null;
  activePaneId: string | null;
}

export interface WorkspaceTreeSlice extends WorkspaceTreeState {
  splitPane: (
    targetPaneId: string | null,
    zone: EdgeZone,
    initialTab?: Tab,
  ) => void;
  closePane: (paneId: string) => void;
  setActivePane: (paneId: string | null) => void;
  getActivePane: () => PaneNode | null;

  /** Phase B — 다른 pane 으로 탭 이동 (center drop). 같은 pane 이면 reorder. */
  movePaneTab: (
    sourcePaneId: string,
    tabId: string,
    destPaneId: string,
    /** undefined 면 dest 의 끝에 삽입. */
    destIndex?: number,
  ) => void;

  /** Phase B — pane 안에서 탭 재정렬 (active pane 외에서도 쓰기 위함). */
  reorderPaneTab: (paneId: string, fromIndex: number, toIndex: number) => void;

  /** Phase B — 비활성 pane 의 특정 탭 활성화. setActivePane 도 같이. */
  activatePaneTab: (paneId: string, tabId: string) => void;

  /** Phase B — pane 단위 탭 닫기. active pane 이면 글로벌도 mirror. */
  closePaneTab: (paneId: string, tabId: string) => void;
  closeOtherPaneTabs: (paneId: string, tabId: string) => void;
  closePaneTabsAfter: (paneId: string, tabId: string) => void;
  closeAllPaneTabs: (paneId: string) => void;
  togglePaneTabPinned: (paneId: string, tabId: string) => void;

  /** Phase E — 특정 pane 에 placeholder 또는 파일 탭을 추가하고 활성화. */
  createPaneTab: (paneId: string, path?: string) => void;

  /**
   * Phase C — edge drop split. source pane 의 tab 을 target pane 옆에 새로
   * 만들어진 fresh pane 으로 *이동* (clone 아님). zone 은 left/right/top/bottom.
   *
   * source === target 인 경우에도 동작 — target 을 split 하고 fresh pane 으로
   * tab 이동. source pane 이 비더라도 자동 closePane 하지 않음 (사용자가
   * 명시적으로 닫도록).
   */
  splitPaneMove: (
    sourcePaneId: string | null,
    tabId: string,
    targetPaneId: string | null,
    zone: EdgeZone,
  ) => void;

  /**
   * Phase D — SplitNode ratio 갱신. divider drag 중 호출. clamp [0.2, 0.8].
   * persist subscribe (workspaceTree 변경) 가 자동으로 debounce 저장.
   */
  setSplitRatio: (splitId: string, ratio: number) => void;

  /**
   * Phase D — 외부 파일 삭제 시 모든 pane 의 해당 path 탭을 일괄 제거.
   * 자기 자신과 하위 경로 (`path/...`) 전부 제거. active pane 이 영향 받으면
   * 글로벌 mirror 도 같이 갱신. 모든 pane 이 비면 tree 를 null 로 collapse.
   */
  removeFromAllPanes: (path: string) => void;

  /**
   * Phase D — 외부 rename 시 모든 pane 의 해당 path 탭의 path/title 을 갱신.
   * `oldPath` 자기와 하위 경로 둘 다 처리. active pane 이면 글로벌 mirror 도 같이.
   */
  updatePathInAllPanes: (oldPath: string, newPath: string) => void;
}

type FullSlice = WorkspaceTreeSlice & TabSlice & EditorSlice;

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const createWorkspaceTreeSlice: StateCreator<
  FullSlice,
  [],
  [],
  WorkspaceTreeSlice
> = (set, get) => {
  /** mirror swap — 새 active pane 으로 글로벌 tabs/activeId 를 맞춘다. */
  function applyActivePaneSwap(
    nextTree: WorkspaceNode,
    nextActivePaneId: string | null,
  ): void {
    let nextTabs: Tab[] = [];
    let nextActiveTabId: string | null = null;
    if (nextActivePaneId) {
      const pane = findPane(nextTree, nextActivePaneId);
      if (pane) {
        nextTabs = pane.tabs;
        nextActiveTabId = pane.activeTabId;
      }
    }
    set({
      workspaceTree: nextTree,
      activePaneId: nextActivePaneId,
      tabs: nextTabs,
      activeId: nextActiveTabId,
    });

    // editor 도 새 active tab path 로
    const state = get();
    if (nextActiveTabId) {
      const tab = nextTabs.find((t) => t.id === nextActiveTabId);
      if (tab) {
        if (isTerminalTab(tab) || !tab.path) {
          state.closeFile();
          return;
        }
        void state.openFile(tab.path);
        return;
      }
    }
    state.closeFile();
  }

  function collapseToSinglePane(pane: PaneNode): void {
    set({
      workspaceTree: null,
      activePaneId: null,
      tabs: pane.tabs,
      activeId: pane.activeTabId,
    });
    const activeTab = pane.activeTabId
      ? pane.tabs.find((t) => t.id === pane.activeTabId)
      : null;
    if (activeTab && !isTerminalTab(activeTab) && activeTab.path) {
      void get().openFile(activeTab.path);
    } else {
      get().closeFile();
    }
  }

  function commitPaneTabsMutation(
    tree: WorkspaceNode,
    affectedPaneId: string,
  ): void {
    const state = get();
    const nextTree = pruneEmptyPanes(tree) ?? tree;

    if (isPaneNode(nextTree)) {
      collapseToSinglePane(nextTree);
      return;
    }

    if (state.activePaneId === affectedPaneId) {
      applyActivePaneSwap(
        nextTree,
        findPane(nextTree, affectedPaneId)
          ? affectedPaneId
          : (collectPanes(nextTree)[0]?.id ?? null),
      );
      return;
    }

    if (state.activePaneId && findPane(nextTree, state.activePaneId)) {
      set({ workspaceTree: nextTree });
      return;
    }

    applyActivePaneSwap(nextTree, collectPanes(nextTree)[0]?.id ?? null);
  }

  function patchPaneTabsAndCommit(
    tree: WorkspaceNode,
    paneId: string,
    patch: { tabs: Tab[]; activeTabId?: string | null },
  ): void {
    commitPaneTabsMutation(patchPaneInTree(tree, paneId, patch), paneId);
  }

  function mirrorActivePaneTabsWithoutEditorOpen(
    nextTree: WorkspaceNode,
  ): void {
    const state = get();
    const activePane = state.activePaneId
      ? findPane(nextTree, state.activePaneId)
      : null;
    if (activePane) {
      set({
        workspaceTree: nextTree,
        tabs: activePane.tabs,
        activeId: activePane.activeTabId,
      });
      return;
    }
    set({ workspaceTree: nextTree });
  }

  return {
    workspaceTree: null,
    activePaneId: null,

    splitPane: (targetPaneId, zone, initialTab) => {
      const state = get();
      const tree = state.workspaceTree;

      if (tree === null) {
        const transition = splitSinglePaneWorkspace(
          state.tabs,
          state.activeId,
          zone,
          initialTab,
        );
        if (transition.tree) {
          applyActivePaneSwap(transition.tree, transition.activePaneId);
        }
        return;
      }

      const target = targetPaneId
        ? findPane(tree, targetPaneId)
        : state.activePaneId
          ? findPane(tree, state.activePaneId)
          : (collectPanes(tree)[0] ?? null);
      if (!target) return;

      const captured = captureGlobalIntoActivePane(
        tree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );

      const transition = splitPaneInWorkspace(
        captured,
        target.id,
        zone,
        initialTab,
      );
      if (!transition?.tree) return;
      applyActivePaneSwap(transition.tree, transition.activePaneId);
    },

    closePane: (paneId) => {
      const state = get();
      const tree = state.workspaceTree;
      if (tree === null) return;
      const pane = findPane(tree, paneId);
      if (pane) closeTerminalSessionsForTabs(pane.tabs);

      const captured = captureGlobalIntoActivePane(
        tree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );

      const transition = closePaneInWorkspace(
        captured,
        paneId,
        state.activePaneId,
      );

      if (transition.tree === null) {
        set({ workspaceTree: null, activePaneId: null });
        return;
      }

      if (isPaneNode(transition.tree)) {
        collapseToSinglePane(transition.tree);
        return;
      }

      applyActivePaneSwap(transition.tree, transition.activePaneId);
    },

    setActivePane: (paneId) => {
      const state = get();
      if (state.activePaneId === paneId) return;
      if (!state.workspaceTree) {
        // tree 가 없으면 mirror 동기 의미 없음 — id 만 변경.
        set({ activePaneId: paneId });
        return;
      }

      // 1. 현재 active pane 캡처
      const captured = captureGlobalIntoActivePane(
        state.workspaceTree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );
      // 2. 새 active pane 으로 swap (글로벌 + editor)
      applyActivePaneSwap(captured, paneId);
    },

    getActivePane: () => {
      const state = get();
      if (!state.workspaceTree) return null;
      if (state.activePaneId) {
        return findPane(state.workspaceTree, state.activePaneId);
      }
      return collectPanes(state.workspaceTree)[0] ?? null;
    },

    movePaneTab: (sourcePaneId, tabId, destPaneId, destIndex) => {
      const state = get();
      const tree = state.workspaceTree;
      if (!tree) return;

      // 글로벌 → active pane 으로 capture (작업 결과 보존)
      const captured = captureGlobalIntoActivePane(
        tree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );

      const source = findPane(captured, sourcePaneId);
      const dest = findPane(captured, destPaneId);
      if (!source || !dest) return;

      const tab = source.tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // 같은 pane 안 → reorder
      if (sourcePaneId === destPaneId) {
        const nextTabs = reorderTabsInPane(source, tabId, destIndex);
        if (!nextTabs) return;
        const nextTree = patchPaneInTree(captured, sourcePaneId, {
          tabs: nextTabs,
        });
        // active pane 이면 글로벌도 같이
        if (state.activePaneId === sourcePaneId) {
          set({ workspaceTree: nextTree, tabs: nextTabs });
        } else {
          set({ workspaceTree: nextTree });
        }
        return;
      }

      // 다른 pane 으로 이동.
      const transfer = moveTabBetweenPanes(source, dest, tabId, destIndex);
      if (!transfer) return;

      let nextTree = patchPaneInTree(captured, sourcePaneId, {
        tabs: transfer.sourcePatch.tabs,
        activeTabId: transfer.sourcePatch.activeTabId,
      });
      nextTree = patchPaneInTree(nextTree, destPaneId, {
        tabs: transfer.destinationPatch.tabs,
        activeTabId: transfer.destinationPatch.activeTabId,
      });
      nextTree = pruneEmptyPanes(nextTree) ?? nextTree;

      // 이동 후 dest pane 으로 active 옮김 (Obsidian UX 모방).
      if (isPaneNode(nextTree)) {
        collapseToSinglePane(nextTree);
        return;
      }
      applyActivePaneSwap(
        nextTree,
        findPane(nextTree, destPaneId)
          ? destPaneId
          : (collectPanes(nextTree)[0]?.id ?? null),
      );
    },

    activatePaneTab: (paneId, tabId) => {
      const state = get();
      if (!state.workspaceTree) return;

      // 1. 글로벌 → 현재 active pane capture.
      let captured = captureGlobalIntoActivePane(
        state.workspaceTree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );
      // 2. 대상 pane 의 activeTabId 변경.
      const target = findPane(captured, paneId);
      if (!target) return;
      if (!target.tabs.some((t) => t.id === tabId)) return;
      captured = patchPaneInTree(captured, paneId, { activeTabId: tabId });
      // 3. paneId 를 새 active 로 swap.
      applyActivePaneSwap(captured, paneId);
    },

    closePaneTab: (paneId, tabId) => {
      const state = get();
      if (!state.workspaceTree) return;
      const captured = captureGlobalIntoActivePane(
        state.workspaceTree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );
      const pane = findPane(captured, paneId);
      if (!pane) return;
      closeTerminalSessionsForTabs(pane.tabs.filter((tab) => tab.id === tabId));
      const patch = removeTabFromPane(pane, tabId);
      if (!patch) return;
      patchPaneTabsAndCommit(captured, paneId, {
        tabs: patch.tabs,
        activeTabId: patch.activeTabId,
      });
    },

    closeOtherPaneTabs: (paneId, tabId) => {
      const state = get();
      if (!state.workspaceTree) return;
      const captured = captureGlobalIntoActivePane(
        state.workspaceTree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );
      const pane = findPane(captured, paneId);
      if (!pane) return;
      const patch = closeOtherTabsInPane(pane, tabId);
      if (!patch) return;
      closeTerminalSessionsForTabs(
        pane.tabs.filter(
          (tab) =>
            !patch.tabs.some((remainingTab) => remainingTab.id === tab.id),
        ),
      );

      patchPaneTabsAndCommit(captured, paneId, {
        tabs: patch.tabs,
        activeTabId: patch.activeTabId,
      });
    },

    closePaneTabsAfter: (paneId, tabId) => {
      const state = get();
      if (!state.workspaceTree) return;
      const captured = captureGlobalIntoActivePane(
        state.workspaceTree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );
      const pane = findPane(captured, paneId);
      if (!pane) return;
      const patch = closeTabsAfterInPane(pane, tabId);
      if (!patch) return;
      closeTerminalSessionsForTabs(
        pane.tabs.filter(
          (tab) =>
            !patch.tabs.some((remainingTab) => remainingTab.id === tab.id),
        ),
      );

      patchPaneTabsAndCommit(captured, paneId, {
        tabs: patch.tabs,
        activeTabId: patch.activeTabId,
      });
    },

    closeAllPaneTabs: (paneId) => {
      const state = get();
      if (!state.workspaceTree) return;
      const captured = captureGlobalIntoActivePane(
        state.workspaceTree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );
      const pane = findPane(captured, paneId);
      if (!pane) return;
      const patch = closeUnpinnedTabsInPane(pane);
      if (!patch) return;
      closeTerminalSessionsForTabs(
        pane.tabs.filter(
          (tab) =>
            !patch.tabs.some((remainingTab) => remainingTab.id === tab.id),
        ),
      );

      patchPaneTabsAndCommit(captured, paneId, {
        tabs: patch.tabs,
        activeTabId: patch.activeTabId,
      });
    },

    togglePaneTabPinned: (paneId, tabId) => {
      const state = get();
      if (!state.workspaceTree) return;
      const captured = captureGlobalIntoActivePane(
        state.workspaceTree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );
      const pane = findPane(captured, paneId);
      if (!pane) return;
      const nextTabs = togglePaneTabPinnedState(pane, tabId);
      if (!nextTabs) return;
      patchPaneTabsAndCommit(captured, paneId, { tabs: nextTabs });
    },

    createPaneTab: (paneId, path = "") => {
      const state = get();
      if (!state.workspaceTree) return;

      const captured = captureGlobalIntoActivePane(
        state.workspaceTree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );
      const pane = findPane(captured, paneId);
      if (!pane) return;

      if (path) {
        const existing = pane.tabs.find((t) => t.path === path);
        if (existing) {
          const nextTree = patchPaneInTree(captured, paneId, {
            activeTabId: existing.id,
          });
          applyActivePaneSwap(nextTree, paneId);
          return;
        }
      }

      const tab = makeWorkspaceTab(path);
      const nextTree = patchPaneInTree(captured, paneId, {
        tabs: [...pane.tabs, tab],
        activeTabId: tab.id,
      });
      applyActivePaneSwap(nextTree, paneId);
    },

    setSplitRatio: (splitId, ratio) => {
      const state = get();
      if (!state.workspaceTree) return;
      const clamped = Math.max(0.2, Math.min(0.8, ratio));
      const next = patchSplitRatio(state.workspaceTree, splitId, clamped);
      if (next === state.workspaceTree) return;
      set({ workspaceTree: next });
    },

    removeFromAllPanes: (path) => {
      const state = get();
      const tree = state.workspaceTree;
      if (!tree) return;

      // 글로벌 → active pane capture (작업 결과 보존).
      const captured = captureGlobalIntoActivePane(
        tree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );

      // 모든 pane 을 walk 해서 해당 path 들을 제거.
      let nextTree: WorkspaceNode = captured;
      let mutated = false;
      for (const pane of collectPanes(captured)) {
        const patch = removePathTabsFromPane(pane, path);
        if (!patch) continue;
        mutated = true;
        nextTree = patchPaneInTree(nextTree, pane.id, {
          tabs: patch.tabs,
          activeTabId: patch.activeTabId,
        });
      }
      if (!mutated) return;

      nextTree = pruneEmptyPanes(nextTree) ?? nextTree;

      // 모든 pane 이 비었으면 tree collapse → 단일 empty 모드 (spec §11).
      const allEmpty = collectPanes(nextTree).every((p) => p.tabs.length === 0);
      if (allEmpty) {
        set({
          workspaceTree: null,
          activePaneId: null,
          tabs: [],
          activeId: null,
        });
        get().closeFile();
        return;
      }

      if (isPaneNode(nextTree)) {
        collapseToSinglePane(nextTree);
        return;
      }

      mirrorActivePaneTabsWithoutEditorOpen(nextTree);
    },

    updatePathInAllPanes: (oldPath, newPath) => {
      const state = get();
      const tree = state.workspaceTree;
      if (!tree) return;

      const captured = captureGlobalIntoActivePane(
        tree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );

      let nextTree: WorkspaceNode = captured;
      let mutated = false;
      for (const pane of collectPanes(captured)) {
        const tabs = renamePathTabsInPane(pane, oldPath, newPath);
        if (!tabs) continue;
        mutated = true;
        nextTree = patchPaneInTree(nextTree, pane.id, { tabs });
      }
      if (!mutated) return;

      mirrorActivePaneTabsWithoutEditorOpen(nextTree);
    },

    splitPaneMove: (sourcePaneId, tabId, targetPaneId, zone) => {
      const state = get();
      const tree = state.workspaceTree;
      if (!tree) {
        const transition = splitMoveFromSinglePaneWorkspace(
          state.tabs,
          state.activeId,
          tabId,
          zone,
        );
        if (transition?.tree) {
          applyActivePaneSwap(transition.tree, transition.activePaneId);
        }
        return;
      }
      if (!sourcePaneId || !targetPaneId) return;

      const captured = captureGlobalIntoActivePane(
        tree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );

      const transition = splitMoveInWorkspace(
        captured,
        sourcePaneId,
        tabId,
        targetPaneId,
        zone,
      );
      if (!transition?.tree) return;

      if (isPaneNode(transition.tree)) {
        collapseToSinglePane(transition.tree);
        return;
      }
      applyActivePaneSwap(transition.tree, transition.activePaneId);
    },

    reorderPaneTab: (paneId, fromIndex, toIndex) => {
      const state = get();
      if (!state.workspaceTree) return;
      const captured = captureGlobalIntoActivePane(
        state.workspaceTree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );
      const pane = findPane(captured, paneId);
      if (!pane) return;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        fromIndex >= pane.tabs.length
      )
        return;

      const nextTabs = pane.tabs.slice();
      const [moved] = nextTabs.splice(fromIndex, 1);
      if (!moved) return;
      const insertAt = Math.max(0, Math.min(nextTabs.length, toIndex));
      nextTabs.splice(insertAt, 0, moved);

      const nextTree = patchPaneInTree(captured, paneId, { tabs: nextTabs });
      if (state.activePaneId === paneId) {
        set({ workspaceTree: nextTree, tabs: nextTabs });
      } else {
        set({ workspaceTree: nextTree });
      }
    },
  };
};
