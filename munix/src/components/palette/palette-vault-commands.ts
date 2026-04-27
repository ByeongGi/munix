import { FolderOpen, RotateCcw, Trash2 } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { useVaultDockStore } from "@/store/vault-dock-store";
import type {
  PaletteCommand,
  PaletteCommandBuilderContext,
} from "./palette-command-types";

export function createVaultCommands({
  t,
  onClose,
  onPickVault,
}: PaletteCommandBuilderContext): PaletteCommand[] {
  return [
    {
      id: "pick-vault",
      title: t("palette:commands.pickVault.title"),
      icon: FolderOpen,
      keywords: ["vault", "open", "folder"],
      run: () => {
        onClose();
        onPickVault();
      },
    },
    {
      id: "vault-reset-history",
      title: t("palette:commands.vaultResetHistory.title"),
      icon: Trash2,
      keywords: ["vault", "history", "clear", "reset", "닫힌"],
      run: () => {
        onClose();
        void ipc.vaultRegistryClearClosed();
      },
    },
    {
      id: "vault-reset-all",
      title: t("palette:commands.vaultResetAll.title"),
      icon: RotateCcw,
      keywords: ["vault", "reset", "registry", "all", "초기화"],
      run: () => {
        onClose();
        void (async () => {
          const ok = window.confirm(
            t("palette:commands.vaultResetAll.confirm"),
          );
          if (!ok) return;

          const dock = useVaultDockStore.getState();
          const ids = dock.vaults.map((vault) => vault.id);
          for (const id of ids) {
            try {
              await dock.closeVault(id);
            } catch {
              // ignore
            }
          }
          await ipc.vaultRegistryClear();
        })();
      },
    },
  ];
}
