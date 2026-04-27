import { Columns2, PanelLeftClose, Rows2 } from "lucide-react";
import { closeActivePane, splitActivePane } from "@/lib/workspace-commands";
import type {
  PaletteCommand,
  PaletteCommandBuilderContext,
} from "./palette-command-types";

export function createWorkspaceCommands({
  t,
  onClose,
}: PaletteCommandBuilderContext): PaletteCommand[] {
  return [
    {
      id: "workspace-split-right",
      title: t("palette:commands.workspaceSplitRight.title"),
      icon: Columns2,
      shortcut: "⌘\\",
      keywords: ["split", "right", "pane", "분할", "오른쪽"],
      run: () => {
        onClose();
        splitActivePane("right");
      },
    },
    {
      id: "workspace-split-down",
      title: t("palette:commands.workspaceSplitDown.title"),
      icon: Rows2,
      shortcut: "⌘⇧\\",
      keywords: ["split", "down", "pane", "분할", "아래"],
      run: () => {
        onClose();
        splitActivePane("bottom");
      },
    },
    {
      id: "workspace-close-pane",
      title: t("palette:commands.workspaceClosePane.title"),
      icon: PanelLeftClose,
      shortcut: "⌘⌥⇧W",
      keywords: ["close", "pane", "패널", "닫기"],
      run: () => {
        onClose();
        closeActivePane();
      },
    },
  ];
}
