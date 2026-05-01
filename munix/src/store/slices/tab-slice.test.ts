import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

import { collectPanes } from "@/store/workspace-types";
import {
  createWorkspaceTreeSlice,
  type WorkspaceTreeSlice,
} from "./workspace-tree-slice";
import {
  createTabSlice,
  isTerminalTab,
  type Tab,
  type TabSlice,
} from "./tab-slice";

const editorMocks = vi.hoisted(() => ({
  closeFile: vi.fn(),
  flushSave: vi.fn(async () => {}),
  openFile: vi.fn(async (_path: string) => {}),
}));

const recentMocks = vi.hoisted(() => ({
  push: vi.fn((_path: string) => {}),
}));

vi.mock("@/store/editor-store", () => ({
  useEditorStore: {
    getState: () => editorMocks,
  },
}));

vi.mock("@/store/recent-store", () => ({
  useRecentStore: {
    getState: () => recentMocks,
  },
}));

type TestStore = TabSlice & WorkspaceTreeSlice;

function tab(id: string, path: string): Tab {
  return { id, path, title: path.replace(/\.md$/, "") };
}

function makeStore(initialTabs: Tab[], activeId: string) {
  return create<TestStore>((set, get, api) => ({
    closeFile: () => {},
    openFile: async (_path: string) => {},
    ...createWorkspaceTreeSlice(
      set as unknown as Parameters<typeof createWorkspaceTreeSlice>[0],
      get as unknown as Parameters<typeof createWorkspaceTreeSlice>[1],
      api as unknown as Parameters<typeof createWorkspaceTreeSlice>[2],
    ),
    ...createTabSlice(
      set as unknown as Parameters<typeof createTabSlice>[0],
      get as unknown as Parameters<typeof createTabSlice>[1],
      api as unknown as Parameters<typeof createTabSlice>[2],
    ),
    tabs: initialTabs,
    activeId,
  }));
}

describe("tab-slice split pane routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens document tabs in the active pane", () => {
    const first = tab("t1", "a.md");
    const second = tab("t2", "b.md");
    const store = makeStore([first, second], first.id);
    store.getState().splitPane(null, "right", {
      ...first,
      id: "right-a",
    });
    const inactive = collectPanes(store.getState().workspaceTree!).find(
      (pane) => pane.id !== store.getState().activePaneId,
    )!;

    store.getState().setActivePane(inactive.id);
    store.getState().openTab("new.md");

    const state = store.getState();
    const activePane = collectPanes(state.workspaceTree!).find(
      (pane) => pane.id === inactive.id,
    )!;
    const otherPane = collectPanes(state.workspaceTree!).find(
      (pane) => pane.id !== inactive.id,
    )!;

    expect(activePane.tabs.map((item) => item.path)).toEqual([
      "a.md",
      "b.md",
      "new.md",
    ]);
    expect(activePane.activeTabId).toBe(state.activeId);
    expect(state.tabs.map((item) => item.path)).toEqual([
      "a.md",
      "b.md",
      "new.md",
    ]);
    expect(otherPane.tabs.map((item) => item.id)).toEqual(["right-a"]);
  });

  it("opens terminal tabs in the active pane", () => {
    const first = tab("t1", "a.md");
    const store = makeStore([first], first.id);
    store.getState().splitPane(null, "right", {
      ...first,
      id: "right-a",
    });
    const inactive = collectPanes(store.getState().workspaceTree!).find(
      (pane) => pane.id !== store.getState().activePaneId,
    )!;

    store.getState().setActivePane(inactive.id);
    store.getState().openTerminalTab();

    const state = store.getState();
    const activePane = collectPanes(state.workspaceTree!).find(
      (pane) => pane.id === inactive.id,
    )!;
    const activeTab = activePane.tabs.find(
      (item) => item.id === activePane.activeTabId,
    );

    expect(activeTab && isTerminalTab(activeTab)).toBe(true);
    expect(state.activePaneId).toBe(inactive.id);
    expect(state.activeId).toBe(activePane.activeTabId);
  });

  it("creates empty tabs in the active pane", () => {
    const first = tab("t1", "a.md");
    const store = makeStore([first], first.id);
    store.getState().splitPane(null, "right", {
      ...first,
      id: "right-a",
    });
    const inactive = collectPanes(store.getState().workspaceTree!).find(
      (pane) => pane.id !== store.getState().activePaneId,
    )!;

    store.getState().setActivePane(inactive.id);
    store.getState().createEmptyTab();

    const state = store.getState();
    const activePane = collectPanes(state.workspaceTree!).find(
      (pane) => pane.id === inactive.id,
    )!;
    const activeTab = activePane.tabs.find(
      (item) => item.id === activePane.activeTabId,
    );

    expect(activeTab?.path).toBe("");
    expect(state.activePaneId).toBe(inactive.id);
    expect(state.activeId).toBe(activePane.activeTabId);
  });
});
