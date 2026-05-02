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
import type { DocumentRuntimeSlice } from "./document-runtime-slice";
import type { EditorSlice } from "./editor-slice";

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

type TestStore = TabSlice &
  WorkspaceTreeSlice &
  Partial<EditorSlice> &
  Partial<DocumentRuntimeSlice>;

function tab(id: string, path: string): Tab {
  return { id, path, title: path.replace(/\.md$/, "") };
}

interface EditorOverrides {
  closeFile?: EditorSlice["closeFile"];
  flushSave?: EditorSlice["flushSave"];
  openFile?: EditorSlice["openFile"];
}

function makeStore(
  initialTabs: Tab[],
  activeId: string,
  editorOverrides: EditorOverrides = {},
) {
  return create<TestStore>((set, get, api) => ({
    closeFile: editorOverrides.closeFile ?? (() => {}),
    flushSave: editorOverrides.flushSave ?? null,
    openFile: editorOverrides.openFile ?? (async (_path: string) => {}),
    captureActiveDocumentRuntime: () => {},
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

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
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

describe("tab-slice editor activation races", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips a document open when that tab is no longer active after save flush", async () => {
    const first = tab("t1", "a.md");
    const second = tab("t2", "b.md");
    const pendingFlush = deferred();
    const openFile = vi.fn(async (_path: string, _tabId?: string | null) => {});
    const flushSave = vi
      .fn()
      .mockReturnValueOnce(pendingFlush.promise)
      .mockResolvedValue(undefined);
    const store = makeStore([first, second], first.id, {
      flushSave,
      openFile,
    });

    store.getState().activate(second.id);
    await flushMicrotasks();
    store.getState().activate(first.id);
    await flushMicrotasks();

    expect(openFile).toHaveBeenCalledWith(first.path, first.id);
    pendingFlush.resolve();
    await flushMicrotasks();

    expect(openFile).toHaveBeenCalledTimes(1);
    expect(openFile).not.toHaveBeenCalledWith(second.path, second.id);
  });

  it("skips a delayed close when an empty tab is no longer active", async () => {
    const first = tab("t1", "a.md");
    const pendingFlush = deferred();
    const closeFile = vi.fn();
    const openFile = vi.fn(async (_path: string, _tabId?: string | null) => {});
    const flushSave = vi
      .fn()
      .mockReturnValueOnce(pendingFlush.promise)
      .mockResolvedValue(undefined);
    const store = makeStore([first], first.id, {
      closeFile,
      flushSave,
      openFile,
    });

    store.getState().createEmptyTab();
    await flushMicrotasks();
    store.getState().activate(first.id);
    await flushMicrotasks();

    expect(openFile).toHaveBeenCalledWith(first.path, first.id);
    pendingFlush.resolve();
    await flushMicrotasks();

    expect(closeFile).not.toHaveBeenCalled();
  });

  it("skips a delayed close when an empty tab is promoted to a document", async () => {
    const first = tab("t1", "a.md");
    const pendingFlush = deferred();
    const closeFile = vi.fn();
    const openFile = vi.fn(async (_path: string, _tabId?: string | null) => {});
    const flushSave = vi
      .fn()
      .mockReturnValueOnce(pendingFlush.promise)
      .mockResolvedValue(undefined);
    const store = makeStore([first], first.id, {
      closeFile,
      flushSave,
      openFile,
    });

    store.getState().createEmptyTab();
    await flushMicrotasks();
    const activeEmptyId = store.getState().activeId;
    expect(store.getState().promoteActiveEmptyTab("new.md")).toBe(true);
    await flushMicrotasks();

    expect(openFile).toHaveBeenCalledWith("new.md", activeEmptyId);
    pendingFlush.resolve();
    await flushMicrotasks();

    expect(closeFile).not.toHaveBeenCalled();
  });
});
