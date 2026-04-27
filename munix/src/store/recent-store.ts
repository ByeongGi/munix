/**
 * useRecentStore — Phase B-δ 호환 wrapper. (ADR-031)
 * 실제 상태는 active vault workspace 의 RecentSlice (`recent` nested 슬롯).
 */

import { useStore } from "zustand";

import { useActiveVaultId, NO_VAULT_ID } from "@/lib/active-vault";
import {
  getWorkspaceStore,
  type WorkspaceStore,
} from "@/store/workspace-registry";
import { useVaultDockStore } from "@/store/vault-dock-store";
import {
  defaultRecentSlice,
  type RecentState,
} from "@/store/slices/recent-slice";

interface RecentStoreApi {
  <T>(selector: (s: RecentState) => T): T;
  getState(): RecentState;
}

const pickRecent = (s: WorkspaceStore) => s.recent;

const useRecentStoreFn = <T>(selector: (s: RecentState) => T): T => {
  const id = useActiveVaultId();
  const store = getWorkspaceStore(id ?? NO_VAULT_ID);
  const recent = useStore(store, pickRecent);
  return selector(recent);
};

(useRecentStoreFn as RecentStoreApi).getState = (): RecentState => {
  const id = useVaultDockStore.getState().activeVaultId;
  if (!id) return defaultRecentSlice().recent;
  return getWorkspaceStore(id).getState().recent;
};

export const useRecentStore = useRecentStoreFn as RecentStoreApi;
