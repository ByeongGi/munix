/**
 * workspace-tree-slice 단위 테스트 (workspace-split-spec Phase D 검증).
 *
 * editor/tab slice 의 ipc 의존성을 피하기 위해 zustand store 를 직접 구성하고
 * openFile/closeFile 은 호출 추적용 stub 으로 대체.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { create, type StoreApi } from "zustand";

import { collectPanes, isSplitNode } from "../workspace-types";
import {
  createWorkspaceTreeSlice,
  type WorkspaceTreeSlice,
} from "./workspace-tree-slice";
import type { Tab } from "./tab-slice";
import type { EditorSlice } from "./editor-slice";

// ---------------------------------------------------------------------------
// 미니 store factory — 필요한 필드/액션만 채운 dummy slice 들 + WorkspaceTreeSlice
// ---------------------------------------------------------------------------

interface TestStore extends WorkspaceTreeSlice {
  tabs: Tab[];
  activeId: string | null;
  openFile: EditorSlice["openFile"];
  closeFile: EditorSlice["closeFile"];
  // openFile / closeFile 호출 기록.
  _opened: string[];
  _closeCount: number;
}

function makeStore(initialTabs: Tab[] = [], activeId: string | null = null) {
  const opened: string[] = [];
  let closeCount = 0;

  const store: StoreApi<TestStore> = create<TestStore>((set, get, api) => ({
    tabs: initialTabs,
    activeId,

    openFile: async (path: string) => {
      opened.push(path);
    },
    closeFile: () => {
      closeCount += 1;
    },

    _opened: opened,
    get _closeCount() {
      return closeCount;
    },

    // workspace-tree-slice 가 FullSlice 시그니처를 요구하므로 unknown 캐스트.
    ...createWorkspaceTreeSlice(
      set as unknown as Parameters<typeof createWorkspaceTreeSlice>[0],
      get as unknown as Parameters<typeof createWorkspaceTreeSlice>[1],
      api as unknown as Parameters<typeof createWorkspaceTreeSlice>[2],
    ),
  }));

  return {
    store,
    getState: () => store.getState(),
    opened,
    getCloseCount: () => closeCount,
  };
}

function tab(id: string, path: string): Tab {
  return { id, path, title: path.replace(/\.md$/, "") };
}

function terminalTab(id: string): Tab {
  return { id, kind: "terminal", path: "", title: "Terminal" };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("workspace-tree-slice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("splitPane (clone mode)", () => {
    it("단일 pane → tree promotion (right zone)", () => {
      const t1 = tab("t1", "a.md");
      const { getState } = makeStore([t1], "t1");
      const cloned: Tab = { id: "t2", path: "a.md", title: "a" };

      getState().splitPane(null, "right", cloned);

      const s = getState();
      expect(s.workspaceTree).not.toBeNull();
      expect(isSplitNode(s.workspaceTree!)).toBe(true);
      const split = s.workspaceTree!;
      if (!isSplitNode(split)) throw new Error("expected split");
      expect(split.direction).toBe("row");
      expect(split.ratio).toBe(0.5);
      // active pane = fresh (오른쪽).
      const panes = collectPanes(split);
      expect(panes).toHaveLength(2);
      const fresh = panes.find((p) => p.id === s.activePaneId);
      expect(fresh?.tabs[0]?.id).toBe("t2");
      expect(s.tabs[0]?.id).toBe("t2"); // global mirror
    });

    it("tree 모드에서 active pane split → SplitNode 깊이 증가", () => {
      const t1 = tab("t1", "a.md");
      const { getState } = makeStore([t1], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t2" });
      getState().splitPane(null, "bottom", { ...t1, id: "t3" });

      const tree = getState().workspaceTree!;
      expect(isSplitNode(tree)).toBe(true);
      expect(collectPanes(tree)).toHaveLength(3);
    });
  });

  describe("splitPaneMove (edge drop, transfer mode)", () => {
    it("source 에서 탭 제거 + fresh pane 으로 이동", () => {
      const t1 = tab("t1", "a.md");
      const t2 = tab("t2", "b.md");
      const { getState } = makeStore([t1, t2], "t1");
      // 우선 split 으로 두 pane 만들기.
      getState().splitPane(null, "right", { ...t1, id: "tc" });
      const beforeTree = getState().workspaceTree!;
      const [paneA, paneB] = collectPanes(beforeTree);

      // paneA 의 t2 를 paneB 의 bottom 으로 이동 split.
      // 단, splitPane 직후엔 paneA 의 tabs 가 [t1, t2] 그대로일 수 있다 (active 가 paneB).
      getState().splitPaneMove(paneA!.id, "t2", paneB!.id, "bottom");

      const after = getState().workspaceTree!;
      const panes = collectPanes(after);
      expect(panes).toHaveLength(3);

      // 새 active = fresh pane (t2 보유).
      const active = panes.find((p) => p.id === getState().activePaneId);
      expect(active?.tabs.map((tt) => tt.id)).toEqual(["t2"]);

      // source 에선 t2 제거됨.
      const sourceAfter = panes.find((p) => p.id === paneA!.id);
      expect(sourceAfter?.tabs.find((tt) => tt.id === "t2")).toBeUndefined();
    });
  });

  describe("setSplitRatio", () => {
    it("ratio 갱신 + clamp [0.2, 0.8]", () => {
      const t1 = tab("t1", "a.md");
      const { getState } = makeStore([t1], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t2" });
      const split = getState().workspaceTree!;
      if (!isSplitNode(split)) throw new Error("expected split");

      getState().setSplitRatio(split.id, 0.7);
      const after1 = getState().workspaceTree!;
      if (!isSplitNode(after1)) throw new Error("expected split");
      expect(after1.ratio).toBeCloseTo(0.7);

      // clamp 상한
      getState().setSplitRatio(split.id, 0.95);
      const after2 = getState().workspaceTree!;
      if (!isSplitNode(after2)) throw new Error("expected split");
      expect(after2.ratio).toBeCloseTo(0.8);

      // clamp 하한
      getState().setSplitRatio(split.id, 0.05);
      const after3 = getState().workspaceTree!;
      if (!isSplitNode(after3)) throw new Error("expected split");
      expect(after3.ratio).toBeCloseTo(0.2);
    });

    it("단일 pane 모드에선 no-op", () => {
      const { getState } = makeStore();
      const before = getState().workspaceTree;
      getState().setSplitRatio("nope", 0.5);
      expect(getState().workspaceTree).toBe(before);
    });
  });

  describe("removeFromAllPanes", () => {
    it("모든 pane 의 path 제거", () => {
      const t1 = tab("t1", "a.md");
      const t2 = tab("t2", "b.md");
      const { getState } = makeStore([t1, t2], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t3" });

      // a.md 는 양 pane 모두에 (active pane t3 path=a.md, source t1 path=a.md).
      getState().removeFromAllPanes("a.md");

      const tree = getState().workspaceTree;
      const panes = tree ? collectPanes(tree) : [{ tabs: getState().tabs }];
      // 모든 pane 에서 a.md 제거됨.
      for (const p of panes) {
        expect(p.tabs.find((tt) => tt.path === "a.md")).toBeUndefined();
      }
      // b.md 만 남은 pane 존재.
      expect(panes.some((p) => p.tabs.some((tt) => tt.path === "b.md"))).toBe(
        true,
      );
    });

    it("하위 경로 (`folder/...`) 도 같이 제거", () => {
      const t1 = tab("t1", "folder/a.md");
      const t2 = tab("t2", "folder/sub/b.md");
      const t3 = tab("t3", "outside.md");
      const { getState } = makeStore([t1, t2, t3], "t1");
      getState().splitPane(null, "right", { ...t1, id: "tc" });

      getState().removeFromAllPanes("folder");

      const tree = getState().workspaceTree;
      const allTabs = tree
        ? collectPanes(tree).flatMap((p) => p.tabs)
        : getState().tabs;
      expect(
        allTabs.find((tt) => tt.path.startsWith("folder")),
      ).toBeUndefined();
      expect(allTabs.some((tt) => tt.path === "outside.md")).toBe(true);
    });

    it("모든 pane 이 비면 tree collapse + closeFile", () => {
      const t1 = tab("t1", "a.md");
      const { result, getState } = makeStoreWithOpened([t1], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t2" });
      // 두 pane 모두 a.md.

      getState().removeFromAllPanes("a.md");

      expect(getState().workspaceTree).toBeNull();
      expect(getState().activePaneId).toBeNull();
      expect(getState().tabs).toEqual([]);
      expect(getState().activeId).toBeNull();
      expect(result.getCloseCount()).toBeGreaterThan(0);
    });
  });

  describe("updatePathInAllPanes", () => {
    it("모든 pane 의 oldPath → newPath 갱신", () => {
      const t1 = tab("t1", "old.md");
      const { getState } = makeStore([t1], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t2" });

      getState().updatePathInAllPanes("old.md", "new.md");

      const panes = collectPanes(getState().workspaceTree!);
      for (const p of panes) {
        const renamed = p.tabs.find((tt) => tt.path === "new.md");
        expect(renamed).toBeDefined();
        expect(renamed!.title).toBe("new");
      }
      // global mirror 도 갱신.
      expect(getState().tabs.some((tt) => tt.path === "new.md")).toBe(true);
    });

    it("하위 경로 prefix 도 같이 rename", () => {
      const t1 = tab("t1", "folder/a.md");
      const t2 = tab("t2", "folder/sub/b.md");
      const { getState } = makeStore([t1, t2], "t1");
      getState().splitPane(null, "right", { ...t1, id: "tc" });

      getState().updatePathInAllPanes("folder", "renamed");

      const allTabs = collectPanes(getState().workspaceTree!).flatMap(
        (p) => p.tabs,
      );
      expect(allTabs.some((tt) => tt.path === "renamed/a.md")).toBe(true);
      expect(allTabs.some((tt) => tt.path === "renamed/sub/b.md")).toBe(true);
      expect(allTabs.some((tt) => tt.path.startsWith("folder"))).toBe(false);
    });
  });

  describe("closePane", () => {
    it("두 pane 중 하나 닫으면 tree collapse → 단일 pane 모드", () => {
      const t1 = tab("t1", "a.md");
      const { getState } = makeStore([t1], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t2" });
      const beforePanes = collectPanes(getState().workspaceTree!);
      const sourcePane = beforePanes.find(
        (p) => p.id !== getState().activePaneId,
      )!;

      getState().closePane(getState().activePaneId!);

      expect(getState().workspaceTree).toBeNull();
      expect(getState().activePaneId).toBeNull();
      // 남은 pane 의 tabs 가 글로벌로 mirror.
      expect(getState().tabs.map((t) => t.id)).toEqual(
        sourcePane.tabs.map((t) => t.id),
      );
    });
  });

  describe("Phase E pane equality", () => {
    it("splitPaneMove 는 단일 pane 탭을 edge drop 으로 새 pane 에 이동한다", () => {
      const t1 = tab("t1", "a.md");
      const t2 = tab("t2", "b.md");
      const { getState } = makeStore([t1, t2], "t1");

      getState().splitPaneMove(null, "t1", null, "right");

      const state = getState();
      expect(state.workspaceTree).not.toBeNull();
      const panes = collectPanes(state.workspaceTree!);
      expect(panes).toHaveLength(2);
      expect(
        panes.some((pane) => pane.tabs.map((tt) => tt.id).join() === "t2"),
      ).toBe(true);
      expect(state.tabs.map((tt) => tt.id)).toEqual(["t1"]);
      expect(state.activeId).toBe("t1");
    });

    it("splitPaneMove 는 단일 pane 의 마지막 탭 이동 후 source 에 placeholder 탭을 남긴다", () => {
      const t1 = terminalTab("t1");
      const { getState } = makeStore([t1], "t1");

      getState().splitPaneMove(null, "t1", null, "bottom");

      const state = getState();
      expect(state.workspaceTree).not.toBeNull();
      const panes = collectPanes(state.workspaceTree!);
      expect(panes).toHaveLength(2);
      expect(panes.every((pane) => pane.tabs.length >= 1)).toBe(true);
      expect(
        panes.some(
          (pane) =>
            pane.tabs.length === 1 &&
            pane.tabs[0]?.path === "" &&
            pane.tabs[0]?.kind !== "terminal",
        ),
      ).toBe(true);
      expect(state.tabs.map((tt) => tt.id)).toEqual(["t1"]);
      expect(state.activeId).toBe("t1");
    });

    it("createPaneTab 은 대상 pane 에 placeholder 탭을 만들고 active 로 swap", () => {
      const t1 = tab("t1", "a.md");
      const { getState, getCloseCount } = makeStore([t1], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t2" });
      const inactive = collectPanes(getState().workspaceTree!).find(
        (pane) => pane.id !== getState().activePaneId,
      )!;

      getState().createPaneTab(inactive.id, "");

      const state = getState();
      expect(state.activePaneId).toBe(inactive.id);
      expect(state.activeId).toBeTruthy();
      expect(state.tabs.find((tt) => tt.id === state.activeId)?.path).toBe("");
      expect(getCloseCount()).toBeGreaterThan(0);
    });

    it("closePaneTab 은 빈 source pane 을 prune 하고 마지막 pane 은 보존", () => {
      const t1 = tab("t1", "a.md");
      const { getState } = makeStore([t1], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t2" });

      getState().closePaneTab(getState().activePaneId!, "t2");

      expect(getState().workspaceTree).toBeNull();
      expect(getState().tabs.map((tt) => tt.id)).toEqual(["t1"]);
    });

    it("active pane 의 closeAllPaneTabs 는 여러 pane 중 해당 pane 을 닫는다", () => {
      const t1 = tab("t1", "a.md");
      const t2 = tab("t2", "b.md");
      const { getState } = makeStore([t1, t2], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t3" });

      getState().closeAllPaneTabs(getState().activePaneId!);

      expect(getState().workspaceTree).toBeNull();
      expect(getState().tabs.map((tt) => tt.id)).toEqual(["t1", "t2"]);
      expect(getState().activeId).toBe("t1");
    });

    it("inactive pane 의 closeAllPaneTabs 는 여러 pane 중 해당 pane 을 닫는다", () => {
      const t1 = tab("t1", "a.md");
      const t2 = tab("t2", "b.md");
      const { getState } = makeStore([t1, t2], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t3" });
      const inactive = collectPanes(getState().workspaceTree!).find(
        (pane) => pane.id !== getState().activePaneId,
      )!;

      getState().closeAllPaneTabs(inactive.id);

      expect(getState().workspaceTree).toBeNull();
      expect(getState().tabs.map((tt) => tt.id)).toEqual(["t3"]);
      expect(getState().activeId).toBe("t3");
    });

    it("비활성 pane 의 closeOthers 는 active pane 을 오염시키지 않는다", () => {
      const t1 = tab("t1", "a.md");
      const t2 = tab("t2", "b.md");
      const { getState } = makeStore([t1, t2], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t3" });
      const inactive = collectPanes(getState().workspaceTree!).find(
        (pane) => pane.id !== getState().activePaneId,
      )!;

      getState().closeOtherPaneTabs(inactive.id, "t2");

      const panes = collectPanes(getState().workspaceTree!);
      const inactiveAfter = panes.find((pane) => pane.id === inactive.id)!;
      expect(inactiveAfter.tabs.map((tt) => tt.id)).toEqual(["t2"]);
      expect(getState().tabs.map((tt) => tt.id)).toEqual(["t3"]);
    });

    it("비활성 pane 의 closeTabsToRight 는 대상 pane 에만 적용된다", () => {
      const t1 = tab("t1", "a.md");
      const t2 = tab("t2", "b.md");
      const t3 = tab("t3", "c.md");
      const { getState } = makeStore([t1, t2, t3], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t4" });
      const inactive = collectPanes(getState().workspaceTree!).find(
        (pane) => pane.id !== getState().activePaneId,
      )!;

      getState().closePaneTabsAfter(inactive.id, "t1");

      const inactiveAfter = collectPanes(getState().workspaceTree!).find(
        (pane) => pane.id === inactive.id,
      )!;
      expect(inactiveAfter.tabs.map((tt) => tt.id)).toEqual(["t1"]);
      expect(getState().tabs.map((tt) => tt.id)).toEqual(["t4"]);
    });

    it("togglePaneTabPinned 은 탭 고정 상태를 토글한다", () => {
      const t1 = tab("t1", "a.md");
      const t2 = tab("t2", "b.md");
      const { getState } = makeStore([t1, t2], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t3" });
      const inactive = collectPanes(getState().workspaceTree!).find(
        (pane) => pane.id !== getState().activePaneId,
      )!;

      getState().togglePaneTabPinned(inactive.id, "t2");
      let pinned = collectPanes(getState().workspaceTree!)
        .find((pane) => pane.id === inactive.id)!
        .tabs.find((tt) => tt.id === "t2");
      expect(pinned?.pinned).toBe(true);

      getState().togglePaneTabPinned(inactive.id, "t2");
      pinned = collectPanes(getState().workspaceTree!)
        .find((pane) => pane.id === inactive.id)!
        .tabs.find((tt) => tt.id === "t2");
      expect(pinned?.pinned).toBe(false);
    });

    it("closeAllPaneTabs 는 pinned tab 을 보존한다", () => {
      const t1 = tab("t1", "a.md");
      const t2 = { ...tab("t2", "b.md"), pinned: true };
      const { getState } = makeStore([t1, t2], "t1");
      getState().splitPane(null, "right", { ...t1, id: "t3" });
      const inactive = collectPanes(getState().workspaceTree!).find(
        (pane) => pane.id !== getState().activePaneId,
      )!;

      getState().closeAllPaneTabs(inactive.id);

      const inactiveAfter = collectPanes(getState().workspaceTree!).find(
        (pane) => pane.id === inactive.id,
      )!;
      expect(inactiveAfter.tabs.map((tt) => tt.id)).toEqual(["t2"]);
      expect(inactiveAfter.activeTabId).toBe("t2");
      expect(getState().tabs.map((tt) => tt.id)).toEqual(["t3"]);
    });
  });
});

// helper — closeCount 추적용 별도 factory
function makeStoreWithOpened(
  initialTabs: Tab[] = [],
  activeId: string | null = null,
): {
  result: ReturnType<typeof makeStore>;
  getState: ReturnType<typeof makeStore>["getState"];
} {
  const result = makeStore(initialTabs, activeId);
  return { result, getState: result.getState };
}
