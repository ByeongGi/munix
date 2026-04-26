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

import {
  collectPanes,
  findPane,
  isPaneNode,
  isSplitNode,
  makePaneId,
  makeSplitId,
  patchPaneInTree,
  patchSplitRatio,
  type DropZone,
  type PaneNode,
  type SplitDirection,
  type SplitNode,
  type WorkspaceNode,
} from "../workspace-types";
import type { EditorSlice } from "./editor-slice";
import type { Tab, TabSlice } from "./tab-slice";

type EdgeZone = Exclude<DropZone, "center">;

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
// Tree 변형 헬퍼 (immutable)
// ---------------------------------------------------------------------------

function zoneToDirection(zone: EdgeZone): SplitDirection {
  return zone === "left" || zone === "right" ? "row" : "column";
}

/** zone 기준 새 pane 이 first 자리인지 (left/top) 아니면 second 자리인지 (right/bottom). */
function isNewPaneFirst(zone: EdgeZone): boolean {
  return zone === "left" || zone === "top";
}

function buildSplit(
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

/** node.id === targetId 인 노드를 replacement 로 교체한 새 tree. */
function replaceNode(
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

/** pane 제거 — 부모 split 의 sibling 으로 대체. 모두 사라지면 null. */
function removePane(node: WorkspaceNode, paneId: string): WorkspaceNode | null {
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

function makeFreshPane(initialTab?: Tab): PaneNode {
  return {
    type: "pane",
    id: makePaneId(),
    tabs: initialTab ? [initialTab] : [],
    activeTabId: initialTab?.id ?? null,
  };
}

function makeTab(path = ""): Tab {
  const i = path.lastIndexOf("/");
  const title = path
    ? (i < 0 ? path : path.slice(i + 1)).replace(/\.md$/i, "")
    : "";
  return {
    id: `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    path,
    title,
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

/**
 * 현재 글로벌 tabs/activeId 를 현재 active pane 의 PaneNode 안으로 capture.
 * 같은 pane mirror 정책 (active pane = 글로벌) 을 유지하기 위한 swap 직전 단계.
 */
function captureGlobalIntoActivePane(
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
        if (!tab.path) {
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
    if (activeTab?.path) {
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

  return {
    workspaceTree: null,
    activePaneId: null,

    splitPane: (targetPaneId, zone, initialTab) => {
      const state = get();
      const tree = state.workspaceTree;

      // case 1: 단일 pane 모드 → tree promotion.
      if (tree === null) {
        const rootPane: PaneNode = {
          type: "pane",
          id: makePaneId(),
          tabs: state.tabs,
          activeTabId: state.activeId,
        };
        const fresh = makeFreshPane(initialTab);
        const split = buildSplit(zone, rootPane, fresh);
        applyActivePaneSwap(split, fresh.id);
        return;
      }

      // case 2: tree 모드 — target pane 을 SplitNode 로 교체.
      const target = targetPaneId
        ? findPane(tree, targetPaneId)
        : state.activePaneId
          ? findPane(tree, state.activePaneId)
          : (collectPanes(tree)[0] ?? null);
      if (!target) return;

      // 현재 active pane 의 글로벌 → PaneNode capture (split 직전).
      const captured = captureGlobalIntoActivePane(
        tree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );

      const fresh = makeFreshPane(initialTab);
      const refreshedTarget =
        target.id === state.activePaneId
          ? (findPane(captured, target.id) ?? target)
          : target;
      const split = buildSplit(zone, refreshedTarget, fresh);
      const nextTree = replaceNode(captured, target.id, split);
      applyActivePaneSwap(nextTree, fresh.id);
    },

    closePane: (paneId) => {
      const state = get();
      const tree = state.workspaceTree;
      if (tree === null) return; // 단일 pane 모드는 closePane no-op

      // 닫히는 pane 이 active 가 아닐 수도 있으므로, 우선 글로벌을
      // active pane 으로 capture (active pane 의 작업 결과 보존).
      const captured = captureGlobalIntoActivePane(
        tree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );

      const next = removePane(captured, paneId);

      // 남은 노드가 없음 — 안전 fallback. tabs/activeId 유지.
      if (next === null) {
        set({ workspaceTree: null, activePaneId: null });
        return;
      }

      // 단 하나의 pane 만 남음 — tabs/activeId 로 mirror 하고 tree 해제.
      if (isPaneNode(next)) {
        set({
          workspaceTree: null,
          activePaneId: null,
          tabs: next.tabs,
          activeId: next.activeTabId,
        });
        const lastTab = next.activeTabId
          ? next.tabs.find((t) => t.id === next.activeTabId)
          : undefined;
        if (lastTab) {
          void get().openFile(lastTab.path);
        } else {
          get().closeFile();
        }
        return;
      }

      // 여전히 split tree — 닫힌 pane 이 active 였으면 새 active 결정.
      let nextActive = state.activePaneId;
      if (nextActive === paneId || nextActive === null) {
        nextActive = collectPanes(next)[0]?.id ?? null;
      }
      applyActivePaneSwap(next, nextActive);
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
        const fromIdx = source.tabs.findIndex((t) => t.id === tabId);
        const toIdx = destIndex ?? source.tabs.length - 1;
        if (fromIdx < 0 || fromIdx === toIdx) return;
        const nextTabs = source.tabs.slice();
        const [moved] = nextTabs.splice(fromIdx, 1);
        if (!moved) return;
        const insertAt = Math.max(0, Math.min(nextTabs.length, toIdx));
        nextTabs.splice(insertAt, 0, moved);
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
      const sourceTabs = source.tabs.filter((t) => t.id !== tabId);
      let sourceActive = source.activeTabId;
      if (source.activeTabId === tabId) {
        const removedIdx = source.tabs.findIndex((t) => t.id === tabId);
        const neighbor =
          sourceTabs[removedIdx] ?? sourceTabs[removedIdx - 1] ?? null;
        sourceActive = neighbor?.id ?? null;
      }

      const insertAt =
        destIndex !== undefined
          ? Math.max(0, Math.min(dest.tabs.length, destIndex))
          : dest.tabs.length;
      const destTabs = dest.tabs.slice();
      destTabs.splice(insertAt, 0, tab);

      let nextTree = patchPaneInTree(captured, sourcePaneId, {
        tabs: sourceTabs,
        activeTabId: sourceActive,
      });
      nextTree = patchPaneInTree(nextTree, destPaneId, {
        tabs: destTabs,
        activeTabId: tab.id,
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
      const idx = pane.tabs.findIndex((t) => t.id === tabId);
      if (idx < 0) return;

      const nextTabs = pane.tabs.filter((t) => t.id !== tabId);
      let nextActive = pane.activeTabId;
      if (pane.activeTabId === tabId) {
        const neighbor = nextTabs[idx] ?? nextTabs[idx - 1] ?? null;
        nextActive = neighbor?.id ?? null;
      }
      let nextTree = patchPaneInTree(captured, paneId, {
        tabs: nextTabs,
        activeTabId: nextActive,
      });
      nextTree = pruneEmptyPanes(nextTree) ?? nextTree;

      if (isPaneNode(nextTree)) {
        collapseToSinglePane(nextTree);
        return;
      }

      if (state.activePaneId === paneId) {
        // 글로벌도 같이 swap (active pane mirror)
        applyActivePaneSwap(
          nextTree,
          findPane(nextTree, paneId)
            ? paneId
            : (collectPanes(nextTree)[0]?.id ?? null),
        );
      } else {
        set({ workspaceTree: nextTree });
      }
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
      const target = pane?.tabs.find((t) => t.id === tabId);
      if (!pane || !target) return;

      const nextTabs = pane.tabs.filter((t) => t.id === tabId || t.pinned);
      const nextTree = patchPaneInTree(captured, paneId, {
        tabs: nextTabs,
        activeTabId: target.id,
      });
      commitPaneTabsMutation(nextTree, paneId);
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
      const idx = pane.tabs.findIndex((t) => t.id === tabId);
      if (idx < 0) return;

      const nextTabs = pane.tabs.filter((t, i) => i <= idx || t.pinned);
      const activeStillOpen = nextTabs.some((t) => t.id === pane.activeTabId);
      const nextTree = patchPaneInTree(captured, paneId, {
        tabs: nextTabs,
        activeTabId: activeStillOpen ? pane.activeTabId : tabId,
      });
      commitPaneTabsMutation(nextTree, paneId);
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
      if (!pane || pane.tabs.length === 0) return;

      const nextTabs = pane.tabs.filter((t) => t.pinned);
      const nextActive =
        nextTabs.find((t) => t.id === pane.activeTabId)?.id ??
        nextTabs[0]?.id ??
        null;
      const nextTree = patchPaneInTree(captured, paneId, {
        tabs: nextTabs,
        activeTabId: nextActive,
      });
      commitPaneTabsMutation(nextTree, paneId);
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
      if (!pane || !pane.tabs.some((t) => t.id === tabId)) return;
      const nextTabs = pane.tabs.map((t) =>
        t.id === tabId ? { ...t, pinned: !t.pinned } : t,
      );
      const nextTree = patchPaneInTree(captured, paneId, { tabs: nextTabs });
      commitPaneTabsMutation(nextTree, paneId);
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

      const tab = makeTab(path);
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

      const matchPath = (p: string) => p === path || p.startsWith(`${path}/`);

      // 모든 pane 을 walk 해서 해당 path 들을 제거.
      let nextTree: WorkspaceNode = captured;
      let mutated = false;
      for (const pane of collectPanes(captured)) {
        if (!pane.tabs.some((t) => matchPath(t.path))) continue;
        mutated = true;
        const removedIds = pane.tabs
          .filter((t) => matchPath(t.path))
          .map((t) => t.id);
        const nextTabs = pane.tabs.filter((t) => !matchPath(t.path));
        let nextActive = pane.activeTabId;
        if (pane.activeTabId && removedIds.includes(pane.activeTabId)) {
          const removedIdx = pane.tabs.findIndex(
            (t) => t.id === pane.activeTabId,
          );
          const neighbor =
            nextTabs[removedIdx] ?? nextTabs[removedIdx - 1] ?? null;
          nextActive = neighbor?.id ?? null;
        }
        nextTree = patchPaneInTree(nextTree, pane.id, {
          tabs: nextTabs,
          activeTabId: nextActive,
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

      // active pane 의 새 PaneNode 를 글로벌로 mirror (editor 재오픈 없이).
      const activePane = state.activePaneId
        ? findPane(nextTree, state.activePaneId)
        : null;
      if (activePane) {
        set({
          workspaceTree: nextTree,
          tabs: activePane.tabs,
          activeId: activePane.activeTabId,
        });
      } else {
        set({ workspaceTree: nextTree });
      }
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

      const basename = (p: string) =>
        (p.lastIndexOf("/") < 0 ? p : p.slice(p.lastIndexOf("/") + 1)).replace(
          /\.md$/i,
          "",
        );

      let nextTree: WorkspaceNode = captured;
      let mutated = false;
      for (const pane of collectPanes(captured)) {
        const renamed = pane.tabs.map((t) => {
          if (t.path === oldPath) {
            return {
              ...t,
              path: newPath,
              title: basename(newPath),
              titleDraft: undefined,
            };
          }
          if (t.path.startsWith(`${oldPath}/`)) {
            const np = `${newPath}${t.path.slice(oldPath.length)}`;
            return {
              ...t,
              path: np,
              title: basename(np),
              titleDraft: undefined,
            };
          }
          return t;
        });
        if (renamed.some((t, i) => t !== pane.tabs[i])) {
          mutated = true;
          nextTree = patchPaneInTree(nextTree, pane.id, { tabs: renamed });
        }
      }
      if (!mutated) return;

      // active pane 의 새 PaneNode 를 글로벌로 mirror (editor 재오픈 없이).
      const activePane = state.activePaneId
        ? findPane(nextTree, state.activePaneId)
        : null;
      if (activePane) {
        set({
          workspaceTree: nextTree,
          tabs: activePane.tabs,
          activeId: activePane.activeTabId,
        });
      } else {
        set({ workspaceTree: nextTree });
      }
    },

    splitPaneMove: (sourcePaneId, tabId, targetPaneId, zone) => {
      const state = get();
      const tree = state.workspaceTree;
      if (!tree) {
        const tab = state.tabs.find((t) => t.id === tabId);
        if (!tab) return;
        const removedIdx = state.tabs.findIndex((t) => t.id === tabId);
        const sourceTabs = state.tabs.filter((t) => t.id !== tabId);
        let sourceActive = state.activeId;
        if (state.activeId === tabId) {
          const neighbor =
            sourceTabs[removedIdx] ?? sourceTabs[removedIdx - 1] ?? null;
          sourceActive = neighbor?.id ?? null;
        }
        const rootPane: PaneNode = {
          type: "pane",
          id: makePaneId(),
          tabs: sourceTabs,
          activeTabId: sourceActive,
        };
        const fresh = makeFreshPane(tab);
        const split = buildSplit(zone, rootPane, fresh);
        applyActivePaneSwap(split, fresh.id);
        return;
      }
      if (!sourcePaneId || !targetPaneId) return;

      // 글로벌 → active pane 으로 capture (split 직전 일관성).
      const captured = captureGlobalIntoActivePane(
        tree,
        state.activePaneId,
        state.tabs,
        state.activeId,
      );

      const source = findPane(captured, sourcePaneId);
      const target = findPane(captured, targetPaneId);
      if (!source || !target) return;

      const tab = source.tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // 1. source pane 에서 tab 제거 + 필요 시 activeTabId 갱신.
      const removedIdx = source.tabs.findIndex((t) => t.id === tabId);
      const sourceTabs = source.tabs.filter((t) => t.id !== tabId);
      let sourceActive = source.activeTabId;
      if (source.activeTabId === tabId) {
        const neighbor =
          sourceTabs[removedIdx] ?? sourceTabs[removedIdx - 1] ?? null;
        sourceActive = neighbor?.id ?? null;
      }
      const treeAfterRemove = patchPaneInTree(captured, sourcePaneId, {
        tabs: sourceTabs,
        activeTabId: sourceActive,
      });

      // 2. fresh pane 만들고 target 자리에 SplitNode 삽입.
      //    target 자체가 source 와 다를 수 있으니 treeAfterRemove 에서 다시 lookup.
      const refreshedTarget = findPane(treeAfterRemove, targetPaneId);
      if (!refreshedTarget) return;
      const fresh = makeFreshPane(tab);
      const split = buildSplit(zone, refreshedTarget, fresh);
      let nextTree = replaceNode(treeAfterRemove, targetPaneId, split);
      nextTree = pruneEmptyPanes(nextTree) ?? nextTree;

      // 3. fresh pane 으로 active swap (Obsidian UX: 끌어 놓은 곳으로 시선 이동).
      if (isPaneNode(nextTree)) {
        collapseToSinglePane(nextTree);
        return;
      }
      applyActivePaneSwap(nextTree, fresh.id);
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
