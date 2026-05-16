import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

import {
  createDocumentRuntimeSlice,
  type DocumentRuntimeSlice,
} from "./document-runtime-slice";
import { createEditorSlice, type EditorSlice } from "./editor-slice";

const ipcMocks = vi.hoisted(() => ({
  readMarkdownFile: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    readMarkdownFile: ipcMocks.readMarkdownFile,
  },
}));

type TestStore = EditorSlice & DocumentRuntimeSlice;

function makeStore() {
  return create<TestStore>((set, get, api) => ({
    ...createEditorSlice(
      set as unknown as Parameters<typeof createEditorSlice>[0],
      get as unknown as Parameters<typeof createEditorSlice>[1],
      api as unknown as Parameters<typeof createEditorSlice>[2],
    ),
    ...createDocumentRuntimeSlice(
      set as unknown as Parameters<typeof createDocumentRuntimeSlice>[0],
      get as unknown as Parameters<typeof createDocumentRuntimeSlice>[1],
      api as unknown as Parameters<typeof createDocumentRuntimeSlice>[2],
    ),
  }));
}

describe("editor-slice runtime reuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not bump sourceVersion when reopening an unchanged runtime", async () => {
    const store = makeStore();
    store.getState().upsertDocumentRuntime({
      tabId: "tab-1",
      path: "note.md",
      body: "# Cached",
      frontmatter: null,
      baseModified: 10,
      status: { kind: "idle" },
      dirty: false,
      lastAccessedAt: 1,
    });

    await store.getState().openFile("note.md", "tab-1");

    expect(store.getState().currentTabId).toBe("tab-1");
    expect(store.getState().currentPath).toBe("note.md");
    expect(store.getState().body).toBe("# Cached");
    expect(store.getState().sourceVersion).toBe(0);
    expect(ipcMocks.readMarkdownFile).not.toHaveBeenCalled();
  });

  it("reloads from disk when a runtime was externally modified", async () => {
    const store = makeStore();
    store.getState().upsertDocumentRuntime({
      tabId: "tab-1",
      path: "note.md",
      body: "# Stale",
      frontmatter: null,
      baseModified: 10,
      status: { kind: "idle" },
      dirty: false,
      externalModified: true,
      lastAccessedAt: 1,
    });
    ipcMocks.readMarkdownFile.mockResolvedValueOnce({
      frontmatter: null,
      body: "# Fresh",
      modified: 20,
    });

    await store.getState().openFile("note.md", "tab-1");

    expect(ipcMocks.readMarkdownFile).toHaveBeenCalledWith("note.md");
    expect(store.getState().body).toBe("# Fresh");
    expect(store.getState().sourceVersion).toBe(2);
  });

  it("marks clean runtimes as externally modified instead of dropping them", () => {
    const store = makeStore();
    store.getState().upsertDocumentRuntime({
      tabId: "tab-1",
      path: "note.md",
      body: "# Cached",
      frontmatter: null,
      baseModified: 10,
      status: { kind: "idle" },
      dirty: false,
      lastAccessedAt: 1,
    });

    store.getState().invalidateDocumentRuntimesForPath("note.md");

    expect(
      store.getState().documentRuntimes["tab-1"]?.externalModified,
    ).toBe(true);
  });

  it("preserves an external modification flag across passive runtime capture", () => {
    const store = makeStore();
    store.getState().upsertDocumentRuntime({
      tabId: "tab-1",
      path: "note.md",
      body: "# Stale",
      frontmatter: null,
      baseModified: 10,
      status: { kind: "idle" },
      dirty: false,
      externalModified: true,
      lastAccessedAt: 1,
    });

    store.getState().upsertDocumentRuntime({
      tabId: "tab-1",
      path: "note.md",
      body: "# Still stale",
      frontmatter: null,
      baseModified: 10,
      status: { kind: "idle" },
      dirty: false,
      lastAccessedAt: 2,
    });

    expect(
      store.getState().documentRuntimes["tab-1"]?.externalModified,
    ).toBe(true);
  });

  it("clears an external modification flag after an explicit disk reload", () => {
    const store = makeStore();
    store.getState().upsertDocumentRuntime({
      tabId: "tab-1",
      path: "note.md",
      body: "# Stale",
      frontmatter: null,
      baseModified: 10,
      status: { kind: "idle" },
      dirty: false,
      externalModified: true,
      lastAccessedAt: 1,
    });

    store.getState().upsertDocumentRuntime({
      tabId: "tab-1",
      path: "note.md",
      body: "# Fresh",
      frontmatter: null,
      baseModified: 20,
      status: { kind: "idle" },
      dirty: false,
      externalModified: false,
      lastAccessedAt: 2,
    });

    expect(
      store.getState().documentRuntimes["tab-1"]?.externalModified,
    ).toBe(false);
  });
});
