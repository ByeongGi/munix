import { Files, Search } from "lucide-react";
import type {
  PaletteCommand,
  PaletteCommandBuilderContext,
} from "./palette-command-types";

export function createSidebarCommands({
  t,
  onClose,
  onSwitchSidebar,
}: PaletteCommandBuilderContext): PaletteCommand[] {
  return [
    {
      id: "sidebar-files",
      title: t("palette:commands.sidebarFiles.title"),
      icon: Files,
      keywords: ["sidebar", "tree", "file"],
      run: () => {
        onClose();
        onSwitchSidebar("files");
      },
    },
    {
      id: "sidebar-search",
      title: t("palette:commands.sidebarSearch.title"),
      icon: Search,
      shortcut: "⌘⇧F",
      keywords: ["sidebar", "search"],
      run: () => {
        onClose();
        onSwitchSidebar("search");
      },
    },
  ];
}
