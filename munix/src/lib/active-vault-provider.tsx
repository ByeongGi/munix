import { useMemo, type ReactNode } from "react";

import { ActiveVaultContext } from "@/lib/active-vault";
import type { VaultId } from "@/store/vault-types";

interface ActiveVaultProviderProps {
  vaultId: VaultId | null;
  children: ReactNode;
}

export function ActiveVaultProvider({
  vaultId,
  children,
}: ActiveVaultProviderProps) {
  const value = useMemo(() => ({ vaultId }), [vaultId]);
  return (
    <ActiveVaultContext.Provider value={value}>
      {children}
    </ActiveVaultContext.Provider>
  );
}
