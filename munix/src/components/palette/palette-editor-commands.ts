import { Clipboard, FileCode2, FileText, Type } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import type { EditorCopyMode } from "@/types/editor-clipboard";
import type {
  PaletteCommand,
  PaletteCommandBuilderContext,
} from "./palette-command-types";

function copySelection(mode: EditorCopyMode): void {
  const copySelectionAs = useEditorStore.getState().copySelectionAs;
  if (!copySelectionAs) return;
  void copySelectionAs(mode);
}

export function createEditorCommands({
  t,
  onClose,
}: PaletteCommandBuilderContext): PaletteCommand[] {
  const run = (mode: EditorCopyMode) => {
    onClose();
    copySelection(mode);
  };

  return [
    {
      id: "editor-copy-standard",
      title: t("palette:commands.copyStandard.title"),
      icon: Clipboard,
      shortcut: "⌘C",
      keywords: ["copy", "clipboard", "standard", "html", "markdown"],
      run: () => run("standard"),
    },
    {
      id: "editor-copy-markdown",
      title: t("palette:commands.copyMarkdown.title"),
      icon: FileCode2,
      keywords: ["copy", "clipboard", "markdown", "md"],
      run: () => run("markdown"),
    },
    {
      id: "editor-copy-rich-text",
      title: t("palette:commands.copyRichText.title"),
      icon: FileText,
      keywords: ["copy", "clipboard", "rich", "html", "formatted"],
      run: () => run("richText"),
    },
    {
      id: "editor-copy-plain-text",
      title: t("palette:commands.copyPlainText.title"),
      icon: Type,
      keywords: ["copy", "clipboard", "plain", "text"],
      run: () => run("plainText"),
    },
  ];
}
