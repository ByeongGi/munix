/**
 * useTabStore — Phase B-γ part 2 호환 wrapper. (ADR-031)
 *
 * 실제 상태/액션은 active vault 의 workspace store 안 TabSlice 가 보유.
 * 컴포넌트 입장에선 시그니처가 그대로 — `useTabStore(s => s.tabs)`,
 * `useTabStore.getState().openTab(path)` 모두 호환.
 *
 * editor-store wrapper 와 동일한 zustand `useStore(api, selector)` 패턴 —
 * vault swap 시 subscription 안전 재바인딩.
 */

import { useStore } from "zustand";

import { useActiveVaultId, NO_VAULT_ID } from "@/lib/active-vault-context";
import { getWorkspaceStore } from "@/store/workspace-registry";
import { useVaultDockStore } from "@/store/vault-dock-store";
import {
  defaultTabSlice,
  type TabSlice,
} from "@/store/slices/tab-slice";

export type { Tab } from "@/store/slices/tab-slice";
export { TAB_SOFT_LIMIT } from "@/store/slices/tab-slice";

interface TabStoreApi {
  <T>(selector: (s: TabSlice) => T): T;
  getState(): TabSlice;
}

const useTabStoreFn = <T,>(selector: (s: TabSlice) => T): T => {
  const id = useActiveVaultId();
  const store = getWorkspaceStore(id ?? NO_VAULT_ID);
  return useStore(store, selector);
};

(useTabStoreFn as TabStoreApi).getState = (): TabSlice => {
  const id = useVaultDockStore.getState().activeVaultId;
  if (!id) {
    return defaultTabSlice();
  }
  return getWorkspaceStore(id).getState();
};

export const useTabStore = useTabStoreFn as TabStoreApi;
