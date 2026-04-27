import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTabStore } from "@/store/tab-store";
import type {
  PaletteCommand,
  PaletteCommandBuilderContext,
} from "./palette-command-types";

export function createTabCommands({
  t,
  onClose,
}: PaletteCommandBuilderContext): PaletteCommand[] {
  return [
    {
      id: "close-tab",
      title: t("palette:commands.closeTab.title"),
      icon: X,
      shortcut: "⌘W",
      keywords: ["close", "tab"],
      run: () => {
        onClose();
        const { activeId, closeTab } = useTabStore.getState();
        if (activeId) closeTab(activeId);
      },
    },
    {
      id: "close-all-tabs",
      title: t("palette:commands.closeAllTabs.title"),
      icon: X,
      shortcut: "⌘⇧W",
      keywords: ["close", "all", "tab"],
      run: () => {
        onClose();
        useTabStore.getState().closeAll();
      },
    },
    {
      id: "next-tab",
      title: t("palette:commands.nextTab.title"),
      icon: ChevronRight,
      shortcut: "⌘⇧]",
      keywords: ["next", "tab"],
      run: () => {
        onClose();
        useTabStore.getState().activateNext();
      },
    },
    {
      id: "prev-tab",
      title: t("palette:commands.prevTab.title"),
      icon: ChevronLeft,
      shortcut: "⌘⇧[",
      keywords: ["prev", "tab"],
      run: () => {
        onClose();
        useTabStore.getState().activatePrev();
      },
    },
  ];
}
