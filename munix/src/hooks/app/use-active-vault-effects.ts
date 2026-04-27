import { useEffect } from "react";

import { usePropertyTypesStore } from "@/store/property-types-store";
import { useRecentStore } from "@/store/recent-store";
import type { VaultInfo } from "@/types/ipc";

interface UseActiveVaultEffectsParams {
  activeVaultId: string | null;
  info: VaultInfo | null;
  resetTabs: () => void;
}

export function useActiveVaultEffects({
  activeVaultId,
  info,
  resetTabs,
}: UseActiveVaultEffectsParams) {
  useEffect(() => {
    if (!info) {
      if (!activeVaultId) resetTabs();
      useRecentStore.getState().setVault(null);
      return;
    }

    useRecentStore.getState().setVault(info.root);
    void usePropertyTypesStore
      .getState()
      .load()
      .catch(() => undefined);
  }, [activeVaultId, info, resetTabs]);
}
