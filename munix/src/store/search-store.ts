/**
 * useSearchStore — Phase B-δ 호환 wrapper. (ADR-031)
 * 실제 상태는 active vault workspace 의 SearchSlice (`search` nested 슬롯).
 */

import { useStore } from "zustand";

import { useActiveVaultId, NO_VAULT_ID } from "@/lib/active-vault";
import {
  getWorkspaceStore,
  type WorkspaceStore,
} from "@/store/workspace-registry";
import { useVaultDockStore } from "@/store/vault-dock-store";
import {
  defaultSearchSlice,
  type SearchState,
} from "@/store/slices/search-slice";

export type { IndexStatus } from "@/store/slices/search-slice";

interface SearchStoreApi {
  <T>(selector: (s: SearchState) => T): T;
  getState(): SearchState;
}

// stable selector — module scope. useSyncExternalStoreWithSelector cache 효율.
const pickSearch = (s: WorkspaceStore) => s.search;

const useSearchStoreFn = <T>(selector: (s: SearchState) => T): T => {
  const id = useActiveVaultId();
  const store = getWorkspaceStore(id ?? NO_VAULT_ID);
  const search = useStore(store, pickSearch);
  return selector(search);
};

(useSearchStoreFn as SearchStoreApi).getState = (): SearchState => {
  const id = useVaultDockStore.getState().activeVaultId;
  if (!id) return defaultSearchSlice().search;
  return getWorkspaceStore(id).getState().search;
};

export const useSearchStore = useSearchStoreFn as SearchStoreApi;
