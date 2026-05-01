import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

export function useVaultPickerAction(
  openVault: (path: string) => Promise<void>,
) {
  return useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await openVault(selected);
    }
  }, [openVault]);
}
