/**
 * EditorSlice — 현재 파일 편집 상태를 workspace store 안에 묶는다.
 * (ADR-031 Phase B-γ: editor-store 마이그레이션)
 *
 * 기존 글로벌 `useEditorStore` 의 모든 상태/액션을 그대로 옮긴다.
 * 사용처 호환은 `store/editor-store.ts` 의 wrapper 가 담당.
 */

import type { StateCreator } from "zustand";

import { ipc } from "@/lib/ipc";
import { isImagePath } from "@/lib/file-kind";
import type { DocumentRuntimeSlice } from "./document-runtime-slice";

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "dirty"; since: number }
  | { kind: "saving"; attempt: number }
  | { kind: "saved"; at: number }
  | { kind: "error"; error: string }
  | { kind: "conflict" };

export interface FlushOptions {
  force?: boolean;
}

export type FlushFn = (opts?: FlushOptions) => Promise<void>;

export interface EditorSlice {
  currentTabId: string | null;
  currentPath: string | null;
  frontmatter: Record<string, unknown> | null;
  body: string;
  sourceVersion: number;
  isOpening: boolean;
  baseModified: number | null;
  status: SaveStatus;
  flushSave: FlushFn | null;
  requestSave: (() => void) | null;
  pendingSearchQuery: string | null;
  pendingJumpHeading: string | null;
  pendingJumpLine: number | null;
  pendingPropertyFocus: boolean;

  openFile: (relPath: string, tabId?: string | null) => Promise<void>;
  closeFile: () => void;
  reloadFromDisk: () => Promise<void>;
  setStatus: (status: SaveStatus) => void;
  setBody: (body: string) => void;
  setBaseModified: (modified: number) => void;
  setFrontmatter: (fm: Record<string, unknown> | null) => void;
  setFlushSave: (fn: FlushFn | null) => void;
  setRequestSave: (fn: (() => void) | null) => void;
  setPendingSearchQuery: (q: string | null) => void;
  setPendingJumpHeading: (h: string | null) => void;
  setPendingJumpLine: (n: number | null) => void;
  setPendingPropertyFocus: (v: boolean) => void;
  renameCurrent: (
    newName: string,
  ) => Promise<{ ok: true; newPath: string } | { ok: false; reason: string }>;
}

export function defaultEditorSlice(): EditorSlice {
  return {
    currentTabId: null,
    currentPath: null,
    frontmatter: null,
    body: "",
    sourceVersion: 0,
    isOpening: false,
    baseModified: null,
    status: { kind: "idle" },
    flushSave: null,
    requestSave: null,
    pendingSearchQuery: null,
    pendingJumpHeading: null,
    pendingJumpLine: null,
    pendingPropertyFocus: false,
    openFile: async () => {},
    closeFile: () => {},
    reloadFromDisk: async () => {},
    setStatus: () => {},
    setBody: () => {},
    setBaseModified: () => {},
    setFrontmatter: () => {},
    setFlushSave: () => {},
    setRequestSave: () => {},
    setPendingSearchQuery: () => {},
    setPendingJumpHeading: () => {},
    setPendingJumpLine: () => {},
    setPendingPropertyFocus: () => {},
    renameCurrent: async () => ({ ok: false, reason: "no active vault" }),
  };
}

/** zustand slice creator — workspace store 의 한 슬롯으로 끼운다. */
export const createEditorSlice: StateCreator<
  EditorSlice & Partial<DocumentRuntimeSlice>,
  [],
  [],
  EditorSlice
> = (set, get) => ({
  currentTabId: null,
  currentPath: null,
  frontmatter: null,
  body: "",
  sourceVersion: 0,
  isOpening: false,
  baseModified: null,
  status: { kind: "idle" },
  flushSave: null,
  requestSave: null,
  pendingSearchQuery: null,
  pendingJumpHeading: null,
  pendingJumpLine: null,
  pendingPropertyFocus: false,

  openFile: async (relPath, tabId = null) => {
    if (isImagePath(relPath)) {
      set({
        currentTabId: tabId,
        currentPath: relPath,
        frontmatter: null,
        body: "",
        sourceVersion: get().sourceVersion + 1,
        isOpening: false,
        baseModified: null,
        status: { kind: "idle" },
      });
      return;
    }

    const runtime = get().getDocumentRuntime?.(tabId);
    if (runtime && runtime.path === relPath && !runtime.externalModified) {
      set({
        currentTabId: tabId,
        currentPath: relPath,
        frontmatter: runtime.frontmatter,
        body: runtime.body,
        isOpening: false,
        baseModified: runtime.baseModified,
        status: runtime.status,
      });
      return;
    }

    set({
      currentTabId: tabId,
      currentPath: relPath,
      frontmatter: null,
      body: "",
      sourceVersion: get().sourceVersion + 1,
      isOpening: true,
      baseModified: null,
      status: { kind: "idle" },
    });

    try {
      const content = await ipc.readMarkdownFile(relPath);
      if (get().currentPath !== relPath || get().currentTabId !== tabId) return;
      set({
        frontmatter: content.frontmatter,
        body: content.body,
        sourceVersion: get().sourceVersion + 1,
        isOpening: false,
        baseModified: content.modified,
        status: { kind: "idle" },
      });
      if (tabId) {
        get().upsertDocumentRuntime?.({
          tabId,
          path: relPath,
          body: content.body,
          frontmatter: content.frontmatter,
          baseModified: content.modified,
          status: { kind: "idle" },
          dirty: false,
          lastAccessedAt: Date.now(),
        });
      }
    } catch (error) {
      if (get().currentPath !== relPath || get().currentTabId !== tabId) return;
      set({
        isOpening: false,
        status: {
          kind: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  },

  closeFile: () =>
    set({
      currentTabId: null,
      currentPath: null,
      frontmatter: null,
      body: "",
      sourceVersion: get().sourceVersion + 1,
      isOpening: false,
      baseModified: null,
      status: { kind: "idle" },
    }),

  reloadFromDisk: async () => {
    const { currentPath } = get();
    if (!currentPath) return;
    set({ isOpening: true, status: { kind: "idle" } });
    try {
      const content = await ipc.readMarkdownFile(currentPath);
      if (get().currentPath !== currentPath) return;
      const currentTabId = get().currentTabId;
      set({
        frontmatter: content.frontmatter,
        body: content.body,
        sourceVersion: get().sourceVersion + 1,
        isOpening: false,
        baseModified: content.modified,
        status: { kind: "idle" },
      });
      if (currentTabId) {
        get().upsertDocumentRuntime?.({
          tabId: currentTabId,
          path: currentPath,
          body: content.body,
          frontmatter: content.frontmatter,
          baseModified: content.modified,
          status: { kind: "idle" },
          dirty: false,
          lastAccessedAt: Date.now(),
        });
      }
    } catch (error) {
      if (get().currentPath !== currentPath) return;
      set({
        isOpening: false,
        status: {
          kind: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  },

  setStatus: (status) => set({ status }),
  setBody: (body) => set({ body }),
  setBaseModified: (modified) => set({ baseModified: modified }),
  setFrontmatter: (fm) => set({ frontmatter: fm }),
  setFlushSave: (fn) => set({ flushSave: fn }),
  setRequestSave: (fn) => set({ requestSave: fn }),
  setPendingSearchQuery: (q) => set({ pendingSearchQuery: q }),
  setPendingJumpHeading: (h) => set({ pendingJumpHeading: h }),
  setPendingJumpLine: (n) => set({ pendingJumpLine: n }),
  setPendingPropertyFocus: (v) => set({ pendingPropertyFocus: v }),

  renameCurrent: async (newName) => {
    const { currentPath, flushSave } = get();
    if (!currentPath) return { ok: false, reason: "no file open" };

    const trimmed = newName.trim();
    if (!trimmed) return { ok: false, reason: "empty" };
    if (/[/\\:*?"<>|]/.test(trimmed) || trimmed.startsWith(".")) {
      return { ok: false, reason: "invalid characters" };
    }

    const lastSlash = currentPath.lastIndexOf("/");
    const dir = lastSlash >= 0 ? currentPath.substring(0, lastSlash) : "";
    const newRel = dir ? `${dir}/${trimmed}.md` : `${trimmed}.md`;

    if (newRel === currentPath) return { ok: true, newPath: currentPath };

    if (flushSave) await flushSave();

    try {
      const { ipc: ipcLib } = await import("@/lib/ipc");
      await ipcLib.renameEntry(currentPath, newRel);

      // 인덱스 rename — Phase B-δ 에서 workspace 안으로 통합 예정.
      const { useSearchStore } = await import("@/store/search-store");
      const { useTagStore } = await import("@/store/tag-store");
      const { useBacklinkStore } = await import("@/store/backlink-store");
      useSearchStore.getState().renamePath?.(currentPath, newRel);
      useTagStore.getState().renamePath?.(currentPath, newRel);
      useBacklinkStore.getState().renamePath?.(currentPath, newRel);

      const workspace = get() as EditorSlice & {
        updatePath?: (oldPath: string, newPath: string) => void;
      };
      workspace.updatePath?.(currentPath, newRel);
      set({ currentPath: newRel });
      const { useVaultStore } = await import("@/store/vault-store");
      void useVaultStore.getState().refresh();
      return { ok: true, newPath: newRel };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  },
});
