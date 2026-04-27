import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  Search,
  Hash,
  Heading,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { useTabStore } from "@/store/tab-store";
import { CommandDialog } from "@/components/ui/command-dialog";
import { parseMode } from "./command-palette-utils";
import type { PaletteItem } from "./palette-items";
import { PaletteItemList } from "./palette-item-list";
import { usePaletteCommands } from "./use-palette-commands";
import { usePaletteIndexes } from "./use-palette-indexes";
import { usePaletteItems } from "./use-palette-items";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onPickVault: () => void;
  onSwitchSidebar: (tab: "files" | "search") => void;
  onShowShortcuts: () => void;
  onOpenSettings: () => void;
  onSearchTag: (tag: string) => void;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function CommandPalette({
  open,
  onClose,
  onNewFile,
  onNewFolder,
  onPickVault,
  onSwitchSidebar,
  onShowShortcuts,
  onOpenSettings,
  onSearchTag,
}: CommandPaletteProps) {
  const { t } = useTranslation(["palette", "common"]);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { searchStatus, tagStatus } = usePaletteIndexes(open);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = usePaletteCommands({
    t,
    onClose,
    onNewFile,
    onNewFolder,
    onPickVault,
    onSwitchSidebar,
    onShowShortcuts,
    onOpenSettings,
  });

  const { mode, text } = useMemo(() => parseMode(query), [query]);
  const { items } = usePaletteItems({
    commands,
    mode,
    text,
  });

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[selectedIdx] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx, open]);

  if (!open) return null;

  function runItem(item: PaletteItem) {
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
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length > 0) setSelectedIdx((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length > 0)
        setSelectedIdx((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selectedIdx];
      if (item) runItem(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  function placeholder(): string {
    if (mode === "tag") return t("palette:placeholder.prefix.tag");
    if (mode === "heading") return t("palette:placeholder.prefix.heading");
    if (mode === "line") return t("palette:placeholder.prefix.line");
    if (mode === "command") return t("palette:placeholder.prefix.command");
    return t("palette:placeholder.prefix.file");
  }

  function modeIcon(): LucideIcon {
    if (mode === "tag") return Hash;
    if (mode === "heading") return Heading;
    if (mode === "line") return ArrowRight;
    if (mode === "command") return Command;
    return Search;
  }

  function prefixBadge(): string | null {
    if (mode === "file") return null;
    return query[0] ?? null;
  }

  const badge = prefixBadge();

  function emptyMessage(): string {
    if (mode === "file" && searchStatus === "building")
      return t("palette:empty.indexing");
    if (mode === "file" && searchStatus !== "ready")
      return t("palette:empty.indexNotReady");
    if (mode === "tag" && tagStatus === "building")
      return t("palette:empty.indexing");
    if (mode === "tag" && tagStatus !== "ready")
      return t("palette:empty.indexNotReady");
    return t("palette:empty.noResults");
  }

  const ModeIcon = modeIcon();

  return (
    <CommandDialog
      icon={
        <ModeIcon className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
      }
      inputRef={inputRef}
      listRef={listRef}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={onKeyDown}
      onClose={onClose}
      placeholder={placeholder()}
      trailing={
        badge ? (
          <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
            {badge}
          </span>
        ) : null
      }
      footer={
        <div className="flex items-center gap-3 border-t border-[var(--color-border-primary)] px-3 py-1.5 text-[11px] text-[var(--color-text-tertiary)]">
          <span>{t("palette:footer.navigate")}</span>
          <span>{t("palette:footer.open")}</span>
          <span>{t("palette:footer.dismiss")}</span>
          <span className="ml-auto opacity-60">
            {t("palette:footer.prefixHint")}
          </span>
        </div>
      }
    >
      {items.length === 0 ? (
        <li className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
          {mode === "line" && text === ""
            ? t("palette:placeholder.prefix.line")
            : emptyMessage()}
        </li>
      ) : (
        <PaletteItemList
          items={items}
          selectedIndex={selectedIdx}
          t={t}
          onRun={runItem}
          onSelect={setSelectedIdx}
        />
      )}
    </CommandDialog>
  );
}
