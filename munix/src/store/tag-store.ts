/**
 * useTagStore — Phase B-δ 호환 wrapper. (ADR-031)
 * 실제 상태는 active vault workspace 의 TagsSlice (`tags` nested 슬롯).
 */

import { useStore } from "zustand";

import { useActiveVaultId, NO_VAULT_ID } from "@/lib/active-vault";
import {
  getWorkspaceStore,
  type WorkspaceStore,
} from "@/store/workspace-registry";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { defaultTagsSlice, type TagsState } from "@/store/slices/tags-slice";

interface TagStoreApi {
  <T>(selector: (s: TagsState) => T): T;
  getState(): TagsState;
}

const pickTags = (s: WorkspaceStore) => s.tags;

const useTagStoreFn = <T>(selector: (s: TagsState) => T): T => {
  const id = useActiveVaultId();
  const store = getWorkspaceStore(id ?? NO_VAULT_ID);
  const tags = useStore(store, pickTags);
  return selector(tags);
};

(useTagStoreFn as TagStoreApi).getState = (): TagsState => {
  const id = useVaultDockStore.getState().activeVaultId;
  if (!id) return defaultTagsSlice().tags;
  return getWorkspaceStore(id).getState().tags;
};

export const useTagStore = useTagStoreFn as TagStoreApi;
