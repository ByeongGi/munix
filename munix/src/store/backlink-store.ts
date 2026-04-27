/**
 * useBacklinkStore — Phase B-δ 호환 wrapper. (ADR-031)
 * 실제 상태는 active vault workspace 의 BacklinksSlice (`backlinks` nested 슬롯).
 */

import { useStore } from "zustand";

import { useActiveVaultId, NO_VAULT_ID } from "@/lib/active-vault";
import {
  getWorkspaceStore,
  type WorkspaceStore,
} from "@/store/workspace-registry";
import { useVaultDockStore } from "@/store/vault-dock-store";
import {
  defaultBacklinksSlice,
  type BacklinksState,
} from "@/store/slices/backlinks-slice";

interface BacklinkStoreApi {
  <T>(selector: (s: BacklinksState) => T): T;
  getState(): BacklinksState;
}

const pickBacklinks = (s: WorkspaceStore) => s.backlinks;

const useBacklinkStoreFn = <T>(selector: (s: BacklinksState) => T): T => {
  const id = useActiveVaultId();
  const store = getWorkspaceStore(id ?? NO_VAULT_ID);
  const backlinks = useStore(store, pickBacklinks);
  return selector(backlinks);
};

(useBacklinkStoreFn as BacklinkStoreApi).getState = (): BacklinksState => {
  const id = useVaultDockStore.getState().activeVaultId;
  if (!id) return defaultBacklinksSlice().backlinks;
  return getWorkspaceStore(id).getState().backlinks;
};

export const useBacklinkStore = useBacklinkStoreFn as BacklinkStoreApi;
