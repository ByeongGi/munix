import { Command, Settings as SettingsIcon } from "lucide-react";
import type {
  PaletteCommand,
  PaletteCommandBuilderContext,
} from "./palette-command-types";

export function createAppCommands({
  t,
  onClose,
  onShowShortcuts,
  onOpenSettings,
}: PaletteCommandBuilderContext): PaletteCommand[] {
  return [
    {
      id: "shortcuts",
      title: t("palette:commands.shortcuts.title"),
      icon: Command,
      shortcut: "⌘/",
      keywords: ["help", "shortcut", "keyboard"],
      run: () => {
        onClose();
        onShowShortcuts();
      },
    },
    {
      id: "settings",
      title: t("palette:commands.settings.title"),
      icon: SettingsIcon,
      shortcut: "⌘,",
      keywords: ["settings", "preferences"],
      run: () => {
        onClose();
        onOpenSettings();
      },
    },
  ];
}
