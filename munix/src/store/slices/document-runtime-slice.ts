import type { StateCreator } from "zustand";

import type { SaveStatus } from "./editor-slice";

export interface SelectionRuntimeState {
  from: number;
  to: number;
}

export interface ScrollRuntimeState {
  top: number;
  anchorPos?: number;
  anchorOffsetTop?: number;
}

export interface DocumentRuntime {
  tabId: string;
  path: string;
  body: string;
  frontmatter: Record<string, unknown> | null;
  baseModified: number | null;
  status: SaveStatus;
  selection?: SelectionRuntimeState;
  scroll?: ScrollRuntimeState;
  dirty: boolean;
  externalModified?: boolean;
  lastAccessedAt: number;
}

export type DocumentRuntimeCapture = () => DocumentRuntime | null;

export interface DocumentRuntimeSlice {
  documentRuntimes: Record<string, DocumentRuntime>;
  activeEditorRuntimeCapture: DocumentRuntimeCapture | null;

  setActiveEditorRuntimeCapture: (
    capture: DocumentRuntimeCapture | null,
  ) => void;
  captureActiveDocumentRuntime: () => void;
  getDocumentRuntime: (
    tabId: string | null | undefined,
  ) => DocumentRuntime | null;
  upsertDocumentRuntime: (runtime: DocumentRuntime) => void;
  removeDocumentRuntime: (tabId: string | null | undefined) => void;
  removeDocumentRuntimesForPath: (path: string) => void;
  renameDocumentRuntimePath: (oldPath: string, newPath: string) => void;
  invalidateDocumentRuntimesForPath: (path: string) => void;
  pruneDocumentRuntimes: (openTabIds: Set<string>) => void;
}

const MAX_DOCUMENT_RUNTIMES = 40;

function isPathOrDescendant(path: string, target: string): boolean {
  return path === target || path.startsWith(`${target}/`);
}

function renameRuntimePath(
  path: string,
  oldPath: string,
  newPath: string,
): string {
  if (path === oldPath) return newPath;
  if (path.startsWith(`${oldPath}/`)) {
    return `${newPath}${path.slice(oldPath.length)}`;
  }
  return path;
}

function isRuntimeDirty(runtime: DocumentRuntime): boolean {
  return (
    runtime.dirty ||
    runtime.status.kind === "dirty" ||
    runtime.status.kind === "conflict"
  );
}

export const createDocumentRuntimeSlice: StateCreator<
  DocumentRuntimeSlice,
  [],
  [],
  DocumentRuntimeSlice
> = (set, get) => ({
  documentRuntimes: {},
  activeEditorRuntimeCapture: null,

  setActiveEditorRuntimeCapture: (capture) =>
    set({ activeEditorRuntimeCapture: capture }),

  captureActiveDocumentRuntime: () => {
    const capture = get().activeEditorRuntimeCapture;
    if (!capture) return;
    const runtime = capture();
    if (!runtime) return;
    get().upsertDocumentRuntime(runtime);
  },

  getDocumentRuntime: (tabId) => {
    if (!tabId) return null;
    const runtime = get().documentRuntimes[tabId];
    if (!runtime) return null;
    set((state) => ({
      documentRuntimes: {
        ...state.documentRuntimes,
        [tabId]: { ...runtime, lastAccessedAt: Date.now() },
      },
    }));
    return runtime;
  },

  upsertDocumentRuntime: (runtime) => {
    set((state) => ({
      documentRuntimes: {
        ...state.documentRuntimes,
        [runtime.tabId]: {
          ...runtime,
          dirty: isRuntimeDirty(runtime),
          lastAccessedAt: Date.now(),
        },
      },
    }));
  },

  removeDocumentRuntime: (tabId) => {
    if (!tabId) return;
    set((state) => {
      if (!state.documentRuntimes[tabId]) return {};
      const next = { ...state.documentRuntimes };
      delete next[tabId];
      return { documentRuntimes: next };
    });
  },

  removeDocumentRuntimesForPath: (path) => {
    set((state) => {
      let changed = false;
      const next = { ...state.documentRuntimes };
      for (const [tabId, runtime] of Object.entries(next)) {
        if (!isPathOrDescendant(runtime.path, path)) continue;
        delete next[tabId];
        changed = true;
      }
      return changed ? { documentRuntimes: next } : {};
    });
  },

  renameDocumentRuntimePath: (oldPath, newPath) => {
    set((state) => {
      let changed = false;
      const next = { ...state.documentRuntimes };
      for (const [tabId, runtime] of Object.entries(next)) {
        if (!isPathOrDescendant(runtime.path, oldPath)) continue;
        next[tabId] = {
          ...runtime,
          path: renameRuntimePath(runtime.path, oldPath, newPath),
          lastAccessedAt: Date.now(),
        };
        changed = true;
      }
      return changed ? { documentRuntimes: next } : {};
    });
  },

  invalidateDocumentRuntimesForPath: (path) => {
    set((state) => {
      let changed = false;
      const next = { ...state.documentRuntimes };
      for (const [tabId, runtime] of Object.entries(next)) {
        if (!isPathOrDescendant(runtime.path, path)) continue;
        if (isRuntimeDirty(runtime)) {
          next[tabId] = { ...runtime, externalModified: true };
        } else {
          delete next[tabId];
        }
        changed = true;
      }
      return changed ? { documentRuntimes: next } : {};
    });
  },

  pruneDocumentRuntimes: (openTabIds) => {
    const runtimes = Object.values(get().documentRuntimes);
    if (runtimes.length <= MAX_DOCUMENT_RUNTIMES) return;

    const keep = new Set(openTabIds);
    const removable = runtimes
      .filter((runtime) => !keep.has(runtime.tabId) && !isRuntimeDirty(runtime))
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
    const removeCount = Math.max(0, runtimes.length - MAX_DOCUMENT_RUNTIMES);
    if (removeCount === 0) return;

    const removeIds = new Set(
      removable.slice(0, removeCount).map((runtime) => runtime.tabId),
    );
    if (removeIds.size === 0) return;

    set((state) => {
      const next = { ...state.documentRuntimes };
      for (const tabId of removeIds) delete next[tabId];
      return { documentRuntimes: next };
    });
  },
});
