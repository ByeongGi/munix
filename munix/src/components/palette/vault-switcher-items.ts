import type { VaultRegistryEntry } from "@/lib/vault-registry";
import type { VaultInfo } from "@/types/ipc";

export type VaultSwitcherItem =
  | { kind: "open"; vault: VaultInfo; active: boolean }
  | { kind: "recent"; id: string; entry: VaultRegistryEntry }
  | { kind: "new" };

export function getVaultSwitcherItemKey(
  item: VaultSwitcherItem,
  fallbackIndex: number,
): string {
  switch (item.kind) {
    case "open":
      return `open:${item.vault.id}`;
    case "recent":
      return `recent:${item.id}`;
    case "new":
      return `new:${fallbackIndex}`;
  }
}

export function getVaultNameFromPath(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}
