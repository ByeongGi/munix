import { useEditorStore } from "@/store/editor-store";
import { useTabStore } from "@/store/tab-store";
import type { PaletteItem } from "./palette-items";

interface UsePaletteRunItemParams {
  onClose: () => void;
  onSearchTag: (tag: string) => void;
}

export function usePaletteRunItem({
  onClose,
  onSearchTag,
}: UsePaletteRunItemParams) {
  return (item: PaletteItem) => {
    if (item.kind === "command") {
      item.cmd.run();
      return;
    }

    if (item.kind === "file") {
      onClose();
      const tabs = useTabStore.getState();
      if (!tabs.promoteActiveEmptyTab(item.hit.path)) {
        tabs.openTab(item.hit.path);
      }
      return;
    }

    if (item.kind === "tag") {
      onClose();
      onSearchTag(item.tag);
      return;
    }

    if (item.kind === "heading") {
      onClose();
      useEditorStore.getState().setPendingJumpHeading(item.text);
      return;
    }

    if (item.kind === "line") {
      onClose();
      useEditorStore.getState().setPendingJumpLine(item.lineNum);
    }
  };
}
