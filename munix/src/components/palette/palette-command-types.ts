import type { LucideIcon } from "lucide-react";
import type { TFunction } from "i18next";

export interface PaletteCommand {
  id: string;
  title: string;
  icon: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  run: () => void;
}

export interface PaletteCommandBuilderContext {
  t: TFunction<["palette", "common"]>;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onPickVault: () => void;
  onSwitchSidebar: (tab: "files" | "search") => void;
  onShowShortcuts: () => void;
  onOpenSettings: () => void;
}
