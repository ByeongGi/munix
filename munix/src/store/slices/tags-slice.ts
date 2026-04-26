/**
 * TagsSlice — vault scope 태그 인덱스.
 * (ADR-031 Phase B-δ: tag-store 마이그레이션)
 */

import type { StateCreator } from "zustand";

import type { FileNode } from "@/types/ipc";
import { TagIndex } from "@/lib/tag-index";
import type { VaultId } from "@/store/vault-types";

export type TagsStatus = "idle" | "building" | "ready" | "error";

export interface TagsState {
  index: TagIndex;
  status: TagsStatus;
  builtFor: string | null;
  selectedTag: string | null;

  build: (root: string, files: FileNode[]) => Promise<void>;
  updatePath: (path: string) => Promise<void>;
  removePath: (path: string) => void;
  renamePath: (oldPath: string, newPath: string) => void;
  selectTag: (tag: string | null) => void;
}

export interface TagsSlice {
  tags: TagsState;
}

function defaultTagsState(): TagsState {
  return {
    index: new TagIndex(),
    status: "idle",
    builtFor: null,
    selectedTag: null,
    build: async () => {},
    updatePath: async () => {},
    removePath: () => {},
    renamePath: () => {},
    selectTag: () => {},
  };
}

export function defaultTagsSlice(): TagsSlice {
  return { tags: defaultTagsState() };
}

export const createTagsSlice = (
  vaultId: VaultId,
): StateCreator<TagsSlice, [], [], TagsSlice> => (set, get) => {
  const update = (patch: Partial<TagsState>) =>
    set((s) => ({ tags: { ...s.tags, ...patch } }));

  return {
    tags: {
      index: new TagIndex(),
      status: "idle",
      builtFor: null,
      selectedTag: null,

      build: async (root, files) => {
        update({ status: "building" });
        try {
          const idx = new TagIndex();
          await idx.build(files, vaultId);
          update({ index: idx, status: "ready", builtFor: root });
        } catch {
          update({ status: "error" });
        }
      },

      updatePath: async (path) => {
        await get().tags.index.updateDoc(path, vaultId);
        update({});
      },

      removePath: (path) => {
        get().tags.index.removeDoc(path);
        update({});
      },

      renamePath: (oldPath, newPath) => {
        get().tags.index.renamePath(oldPath, newPath);
        update({});
      },

      selectTag: (tag) => update({ selectedTag: tag }),
    },
  };
};
