/**
 * usePropertyTypesStore — Phase B-δ 호환 wrapper. (ADR-031)
 * 실제 상태는 active vault workspace 의 PropertyTypesSlice (`propertyTypes` nested 슬롯).
 */

import { useStore } from "zustand";

import { useActiveVaultId, NO_VAULT_ID } from "@/lib/active-vault";
import {
  getWorkspaceStore,
  type WorkspaceStore,
} from "@/store/workspace-registry";
import { useVaultDockStore } from "@/store/vault-dock-store";
import {
  defaultPropertyTypesSlice,
  type PropertyTypesState,
} from "@/store/slices/property-types-slice";

interface PropertyTypesStoreApi {
  <T>(selector: (s: PropertyTypesState) => T): T;
  getState(): PropertyTypesState;
}

const pickPropertyTypes = (s: WorkspaceStore) => s.propertyTypes;

const usePropertyTypesStoreFn = <T>(
  selector: (s: PropertyTypesState) => T,
): T => {
  const id = useActiveVaultId();
  const store = getWorkspaceStore(id ?? NO_VAULT_ID);
  const propertyTypes = useStore(store, pickPropertyTypes);
  return selector(propertyTypes);
};

(usePropertyTypesStoreFn as PropertyTypesStoreApi).getState =
  (): PropertyTypesState => {
    const id = useVaultDockStore.getState().activeVaultId;
    if (!id) return defaultPropertyTypesSlice().propertyTypes;
    return getWorkspaceStore(id).getState().propertyTypes;
  };

export const usePropertyTypesStore =
  usePropertyTypesStoreFn as PropertyTypesStoreApi;
