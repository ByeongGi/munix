/**
 * BacklinksSlice — vault scope wikilink/backlink 인덱스.
 * (ADR-031 Phase B-δ: backlink-store 마이그레이션)
 */

import type { StateCreator } from "zustand";

import type { FileNode } from "@/types/ipc";
import { BacklinkIndex, type BacklinkHit } from "@/lib/backlink-index";
import type { VaultId } from "@/store/vault-types";

export type BacklinksStatus = "idle" | "building" | "ready" | "error";

export interface BacklinksState {
  index: BacklinkIndex;
  status: BacklinksStatus;
  builtFor: string | null;
  error: string | null;

  build: (root: string, files: FileNode[]) => Promise<void>;
  updatePath: (path: string) => Promise<void>;
  removePath: (path: string) => void;
  renamePath: (oldPath: string, newPath: string) => void;
  backlinksOf: (path: string) => BacklinkHit[];
  forwardLinksOf: (path: string) => string[];
}

export interface BacklinksSlice {
  backlinks: BacklinksState;
}

function defaultBacklinksState(): BacklinksState {
  const idx = new BacklinkIndex();
  return {
    index: idx,
    status: "idle",
    builtFor: null,
    error: null,
    build: async () => {},
    updatePath: async () => {},
    removePath: () => {},
    renamePath: () => {},
    backlinksOf: () => [],
    forwardLinksOf: () => [],
  };
}

export function defaultBacklinksSlice(): BacklinksSlice {
  return { backlinks: defaultBacklinksState() };
}

export const createBacklinksSlice =
  (vaultId: VaultId): StateCreator<BacklinksSlice, [], [], BacklinksSlice> =>
  (set, get) => {
    const update = (patch: Partial<BacklinksState>) =>
      set((s) => ({ backlinks: { ...s.backlinks, ...patch } }));

    return {
      backlinks: {
        index: new BacklinkIndex(),
        status: "idle",
        builtFor: null,
        error: null,

        build: async (root, files) => {
          update({ status: "building", error: null });
          try {
            const idx = new BacklinkIndex();
            await idx.build(files, vaultId);
            update({ index: idx, status: "ready", builtFor: root });
          } catch (e) {
            update({
              status: "error",
              error: e instanceof Error ? e.message : String(e),
            });
          }
        },

        updatePath: async (path) => {
          await get().backlinks.index.updateDoc(path, vaultId);
          update({});
        },

        removePath: (path) => {
          get().backlinks.index.removeDoc(path);
          update({});
        },

        renamePath: (oldPath, newPath) => {
          get().backlinks.index.renamePath(oldPath, newPath);
          update({});
        },

        backlinksOf: (path) => get().backlinks.index.backlinksOf(path),
        forwardLinksOf: (path) => get().backlinks.index.forwardLinksOf(path),
      },
    };
  };
