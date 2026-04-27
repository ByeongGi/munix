import { useMemo } from "react";
import type { TFunction } from "i18next";

import { createPaletteCommands } from "./palette-command-builders";
import type { PaletteCommand } from "./palette-command-types";

export type { PaletteCommand } from "./palette-command-types";

interface UsePaletteCommandsParams {
  t: TFunction<["palette", "common"]>;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onPickVault: () => void;
  onSwitchSidebar: (tab: "files" | "search") => void;
  onShowShortcuts: () => void;
  onOpenSettings: () => void;
}

export function usePaletteCommands({
  t,
  onClose,
  onNewFile,
  onNewFolder,
  onPickVault,
  onSwitchSidebar,
  onShowShortcuts,
  onOpenSettings,
}: UsePaletteCommandsParams): PaletteCommand[] {
  return useMemo<PaletteCommand[]>(
    () =>
      createPaletteCommands({
        t,
        onClose,
        onNewFile,
        onNewFolder,
        onPickVault,
        onSwitchSidebar,
        onShowShortcuts,
        onOpenSettings,
      }),
    [
      t,
      onClose,
      onNewFile,
      onNewFolder,
      onPickVault,
      onSwitchSidebar,
      onShowShortcuts,
      onOpenSettings,
    ],
  );
}
