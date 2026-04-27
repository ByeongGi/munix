import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  FileText,
  FilePlus,
  FolderPlus,
  Save,
  X,
  Search,
  Files,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Settings as SettingsIcon,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Heading,
  ArrowRight,
  Trash2,
  RotateCcw,
  Columns2,
  Rows2,
  PanelLeftClose,
  type LucideIcon,
} from "lucide-react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { useRecentStore } from "@/store/recent-store";
import { useSearchStore } from "@/store/search-store";
import { useTabStore } from "@/store/tab-store";
import { useThemeStore } from "@/store/theme-store";
import { useTagStore } from "@/store/tag-store";
import { useVaultStore } from "@/store/vault-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/cn";
import { CommandDialog } from "@/components/ui/command-dialog";
import { closeActivePane, splitActivePane } from "@/lib/workspace-commands";
import type { SearchHit } from "@/lib/search-index";
import { extractHeadings, parseMode } from "./command-palette-utils";

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

interface Cmd {
  id: string;
  title: string;
  icon: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  run: () => void;
}

interface HeadingItem {
  kind: "heading";
  text: string;
  level: number;
  index: number;
}

interface TagItem {
  kind: "tag";
  tag: string;
  fileCount: number;
}

interface LineItem {
  kind: "line";
  lineNum: number;
}

interface CommandItem {
  kind: "command";
  cmd: Cmd;
}

interface FileItem {
  kind: "file";
  hit: SearchHit;
}

type PaletteItem = CommandItem | FileItem | HeadingItem | TagItem | LineItem;

function headingIcon(level: number): LucideIcon {
  if (level === 1) return Heading1;
  if (level === 2) return Heading2;
  if (level === 3) return Heading3;
  return Heading;
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
  const { t, i18n } = useTranslation(["palette", "common"]);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const searchIndex = useSearchStore((s) => s.index);
  const searchStatus = useSearchStore((s) => s.status);
  const buildSearchIndex = useSearchStore((s) => s.buildIndex);
  const tagIndex = useTagStore((s) => s.index);
  const tagStatus = useTagStore((s) => s.status);
  const vaultInfo = useVaultStore((s) => s.info);
  const vaultFiles = useVaultStore((s) => s.files);
  const recentPaths = useRecentStore((s) => s.paths);
  const editorBody = useEditorStore((s) => s.body);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 팔레트가 열려 있을 때 태그 인덱스가 준비 안 됐으면 빌드 트리거
  useEffect(() => {
    if (open && tagStatus === "idle" && vaultInfo) {
      void useTagStore.getState().build(vaultInfo.root, vaultFiles);
    }
  }, [open, tagStatus, vaultInfo, vaultFiles]);

  useEffect(() => {
    if (!open || !vaultInfo) return;
    if (searchStatus === "idle")
      void buildSearchIndex(vaultInfo.root, vaultFiles);
  }, [open, vaultInfo, vaultFiles, searchStatus, buildSearchIndex]);

  const commands = useMemo<Cmd[]>(
    () => [
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
      {
        id: "pick-vault",
        title: t("palette:commands.pickVault.title"),
        icon: FolderOpen,
        keywords: ["vault", "open", "folder"],
        run: () => {
          onClose();
          onPickVault();
        },
      },
      {
        id: "theme-system",
        title: t("palette:commands.themeSystem.title"),
        icon: Monitor,
        keywords: ["theme", "system", "auto"],
        run: () => {
          onClose();
          useThemeStore.getState().set("system");
        },
      },
      {
        id: "theme-light",
        title: t("palette:commands.themeLight.title"),
        icon: Sun,
        keywords: ["theme", "light"],
        run: () => {
          onClose();
          useThemeStore.getState().set("light");
        },
      },
      {
        id: "theme-dark",
        title: t("palette:commands.themeDark.title"),
        icon: Moon,
        keywords: ["theme", "dark"],
        run: () => {
          onClose();
          useThemeStore.getState().set("dark");
        },
      },
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
      {
        id: "vault-reset-history",
        title: t("palette:commands.vaultResetHistory.title"),
        icon: Trash2,
        keywords: ["vault", "history", "clear", "reset", "닫힌"],
        run: () => {
          onClose();
          void ipc.vaultRegistryClearClosed();
        },
      },
      {
        id: "vault-reset-all",
        title: t("palette:commands.vaultResetAll.title"),
        icon: RotateCcw,
        keywords: ["vault", "reset", "registry", "all", "초기화"],
        run: () => {
          onClose();
          void (async () => {
            const ok = window.confirm(
              t("palette:commands.vaultResetAll.confirm"),
            );
            if (!ok) return;
            // 열린 vault 모두 닫기 → 그 후 registry clear
            const dock = useVaultDockStore.getState();
            const ids = dock.vaults.map((v) => v.id);
            for (const id of ids) {
              try {
                await dock.closeVault(id);
              } catch {
                // ignore
              }
            }
            await ipc.vaultRegistryClear();
          })();
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      t,
      i18n.language,
      onClose,
      onNewFile,
      onNewFolder,
      onPickVault,
      onSwitchSidebar,
      onShowShortcuts,
      onOpenSettings,
    ],
  );

  const { mode, text } = useMemo(() => parseMode(query), [query]);

  const items = useMemo<PaletteItem[]>(() => {
    if (mode === "file") {
      if (searchStatus !== "ready") return [];
      const q = text.trim();
      if (!q) {
        const all = searchIndex.searchByTitle("", 100);
        const byPath = new Map(all.map((h) => [h.path, h]));
        const recent = recentPaths
          .map((p) => byPath.get(p))
          .filter((h): h is SearchHit => !!h);
        const rest = all.filter((h) => !recentPaths.includes(h.path));
        return [...recent, ...rest]
          .slice(0, 30)
          .map((hit) => ({ kind: "file" as const, hit }));
      }
      return searchIndex
        .searchByTitle(q, 30)
        .map((hit) => ({ kind: "file" as const, hit }));
    }

    if (mode === "command") {
      const q = text.toLowerCase();
      const filtered = q
        ? commands.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.keywords?.some((k) => k.toLowerCase().includes(q)),
          )
        : commands;
      return filtered.map((cmd) => ({ kind: "command" as const, cmd }));
    }

    if (mode === "tag") {
      if (tagStatus !== "ready") return [];
      const q = text.toLowerCase().replace(/^#/, "");
      const all = tagIndex.tags();
      const filtered = q
        ? all.filter((h) => h.tag.toLowerCase().includes(q))
        : all;
      return filtered.slice(0, 30).map((h) => ({
        kind: "tag" as const,
        tag: h.tag,
        fileCount: h.count,
      }));
    }

    if (mode === "heading") {
      const headings = extractHeadings(editorBody);
      const q = text.toLowerCase();
      const filtered = q
        ? headings.filter((h) => h.text.toLowerCase().includes(q))
        : headings;
      return filtered.map((h, i) => ({
        kind: "heading" as const,
        text: h.text,
        level: h.level,
        index: i,
      }));
    }

    if (mode === "line") {
      const n = parseInt(text, 10);
      if (!isNaN(n) && n > 0) {
        return [{ kind: "line" as const, lineNum: n }];
      }
      return [];
    }

    return [];
  }, [
    mode,
    text,
    commands,
    searchIndex,
    searchStatus,
    recentPaths,
    editorBody,
    tagIndex,
    tagStatus,
  ]);

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

  function renderItem(item: PaletteItem, i: number) {
    const isSelected = i === selectedIdx;
    const baseClass = cn(
      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
      isSelected
        ? "bg-[var(--color-bg-hover)]"
        : "hover:bg-[var(--color-bg-hover)]",
    );

    if (item.kind === "file") {
      return (
        <li key={`file-${item.hit.path}`}>
          <button
            type="button"
            onClick={() => runItem(item)}
            onMouseEnter={() => setSelectedIdx(i)}
            className={baseClass}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate">{item.hit.title}</span>
              <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                {item.hit.path}
              </span>
            </div>
          </button>
        </li>
      );
    }

    if (item.kind === "command") {
      const Icon = item.cmd.icon;
      return (
        <li key={item.cmd.id}>
          <button
            type="button"
            onClick={() => runItem(item)}
            onMouseEnter={() => setSelectedIdx(i)}
            className={baseClass}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <span className="flex-1 truncate">{item.cmd.title}</span>
            {item.cmd.shortcut && (
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                {item.cmd.shortcut}
              </span>
            )}
          </button>
        </li>
      );
    }

    if (item.kind === "tag") {
      return (
        <li key={`tag-${item.tag}`}>
          <button
            type="button"
            onClick={() => runItem(item)}
            onMouseEnter={() => setSelectedIdx(i)}
            className={baseClass}
          >
            <Hash className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <span className="flex-1 truncate">
              <span className="text-[var(--color-accent)]">#</span>
              {item.tag}
            </span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              {item.fileCount}
            </span>
          </button>
        </li>
      );
    }

    if (item.kind === "heading") {
      const Icon = headingIcon(item.level);
      return (
        <li key={`heading-${item.index}`}>
          <button
            type="button"
            onClick={() => runItem(item)}
            onMouseEnter={() => setSelectedIdx(i)}
            className={baseClass}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <span className="flex-1 truncate">{item.text}</span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              H{item.level}
            </span>
          </button>
        </li>
      );
    }

    if (item.kind === "line") {
      return (
        <li key={`line-${item.lineNum}`}>
          <button
            type="button"
            onClick={() => runItem(item)}
            onMouseEnter={() => setSelectedIdx(i)}
            className={baseClass}
          >
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <span className="flex-1 truncate">
              {t("palette:action.jumpToLine", { line: item.lineNum })}
            </span>
          </button>
        </li>
      );
    }

    return null;
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
        items.map((item, i) => renderItem(item, i))
      )}
    </CommandDialog>
  );
}
