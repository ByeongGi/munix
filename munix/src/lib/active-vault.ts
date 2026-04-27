import { createContext, useContext } from "react";

import {
  getWorkspaceStore,
  type WorkspaceStoreHook,
} from "@/store/workspace-registry";
import type { VaultId } from "@/store/vault-types";

export interface ActiveVaultContextValue {
  vaultId: VaultId | null;
}

export const ActiveVaultContext = createContext<ActiveVaultContextValue | null>(
  null,
);

export function useActiveVaultId(): VaultId | null {
  return useContext(ActiveVaultContext)?.vaultId ?? null;
}

export function useRequiredActiveVaultId(): VaultId {
  const id = useActiveVaultId();
  if (!id) {
    throw new Error(
      "useRequiredActiveVaultId called outside an active vault context",
    );
  }
  return id;
}

export const NO_VAULT_ID = "__no_vault__";

export function useActiveWorkspaceStore(): WorkspaceStoreHook {
  const id = useActiveVaultId();
  return getWorkspaceStore(id ?? NO_VAULT_ID);
}
