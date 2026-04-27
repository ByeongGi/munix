import { useEffect } from "react";

import { useSearchStore } from "@/store/search-store";
import { useTagStore } from "@/store/tag-store";
import { useVaultStore } from "@/store/vault-store";

export function usePaletteIndexes(open: boolean) {
  const searchStatus = useSearchStore((s) => s.status);
  const buildSearchIndex = useSearchStore((s) => s.buildIndex);
  const tagStatus = useTagStore((s) => s.status);
  const vaultInfo = useVaultStore((s) => s.info);
  const vaultFiles = useVaultStore((s) => s.files);

  useEffect(() => {
    if (open && tagStatus === "idle" && vaultInfo) {
      void useTagStore.getState().build(vaultInfo.root, vaultFiles);
    }
  }, [open, tagStatus, vaultInfo, vaultFiles]);

  useEffect(() => {
    if (!open || !vaultInfo) return;
    if (searchStatus === "idle")
      void buildSearchIndex(vaultInfo.root, vaultFiles);
  }, [open, vaultInfo, vaultFiles, searchStatus, buildSearchIndex]);

  return { searchStatus, tagStatus };
}
