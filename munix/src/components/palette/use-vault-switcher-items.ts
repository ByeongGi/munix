import { useMemo } from "react";

import {
  getVaultNameFromPath,
  type VaultSwitcherItem,
} from "./vault-switcher-items";
import type { VaultRegistryEntry } from "@/lib/vault-registry";
import type { VaultInfo } from "@/types/ipc";

interface UseVaultSwitcherItemsParams {
  activeVaultId: string | null;
  query: string;
  recent: Array<{ id: string; entry: VaultRegistryEntry }>;
  vaults: VaultInfo[];
}

export function useVaultSwitcherItems({
  activeVaultId,
  query,
  recent,
  vaults,
}: UseVaultSwitcherItemsParams): VaultSwitcherItem[] {
  return useMemo<VaultSwitcherItem[]>(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = (name: string, path: string) =>
      !normalizedQuery ||
      name.toLowerCase().includes(normalizedQuery) ||
      path.toLowerCase().includes(normalizedQuery);

    const openItems: VaultSwitcherItem[] = vaults
      .filter((vault) => matches(vault.name, vault.root))
      .map((vault) => ({
        kind: "open" as const,
        vault,
        active: vault.id === activeVaultId,
      }));

    const openPaths = new Set(vaults.map((vault) => vault.root));
    const recentItems: VaultSwitcherItem[] = recent
      .filter(({ entry }) => !openPaths.has(entry.path))
      .filter(({ entry }) => matches(getVaultNameFromPath(entry.path), entry.path))
      .map(({ id, entry }) => ({ kind: "recent" as const, id, entry }));

    return [...openItems, ...recentItems, { kind: "new" }];
  }, [activeVaultId, query, recent, vaults]);
}
