import { FilePlus, FolderPlus, Save } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import type {
  PaletteCommand,
  PaletteCommandBuilderContext,
} from "./palette-command-types";

export function createFileCommands({
  t,
  onClose,
  onNewFile,
  onNewFolder,
}: PaletteCommandBuilderContext): PaletteCommand[] {
  return [
    {
      id: "new-file",
      title: t("palette:commands.newFile.title"),
      icon: FilePlus,
      shortcut: "⌘T",
      keywords: ["new", "file", "note"],
      run: () => {
        onClose();
        onNewFile();
      },
    },
    {
      id: "new-folder",
      title: t("palette:commands.newFolder.title"),
      icon: FolderPlus,
      keywords: ["new", "folder", "directory"],
      run: () => {
        onClose();
        onNewFolder();
      },
    },
    {
      id: "save",
      title: t("palette:commands.save.title"),
      icon: Save,
      shortcut: "⌘S",
      keywords: ["save"],
      run: () => {
        onClose();
        const flush = useEditorStore.getState().flushSave;
        if (flush) void flush();
      },
    },
  ];
}
