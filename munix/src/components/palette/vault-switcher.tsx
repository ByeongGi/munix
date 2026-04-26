import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Folder, FolderPlus, Search } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { useVaultDockStore } from "@/store/vault-dock-store";
import { useVaultStore } from "@/store/vault-store";
import {
  listClosedVaults,
  type VaultRegistryEntry,
} from "@/lib/vault-registry";
import type { VaultInfo } from "@/types/ipc";
import { cn } from "@/lib/cn";

interface VaultSwitcherProps {
  open: boolean;
  onClose: () => void;
}

type Item =
  | { kind: "open"; vault: VaultInfo; active: boolean }
  | { kind: "recent"; id: string; entry: VaultRegistryEntry }
  | { kind: "new" };

/**
 * Vault Switcher 팔레트 — `⌘⇧O`. (ADR-031 Phase C-5)
 *
 * 그룹: 열린 vault → 최근 닫힌 vault (munix.json 의 closed entry, ts 내림차순)
 * → "새 vault 열기" 액션. 검색 박스로 이름·경로 부분 일치 필터.
 */
export function VaultSwitcher({ open, onClose }: VaultSwitcherProps) {
  const { t } = useTranslation(["vault-dock", "palette", "common"]);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recent, setRecent] = useState<
    Array<{ id: string; entry: VaultRegistryEntry }>
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const vaults = useVaultDockStore((s) => s.vaults);
  const activeVaultId = useVaultDockStore((s) => s.activeVaultId);
  const setActive = useVaultDockStore((s) => s.setActive);
  const openVaultLegacy = useVaultStore((s) => s.open);

  // 열릴 때마다 reset + recent 재로드 (다른 dialog 로 변경됐을 수 있음)
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIdx(0);
    void listClosedVaults().then(setRecent);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (name: string, path: string) =>
      !q ||
      name.toLowerCase().includes(q) ||
      path.toLowerCase().includes(q);

    const openItems: Item[] = vaults
      .filter((v) => matches(v.name, v.root))
      .map((v) => ({
        kind: "open" as const,
        vault: v,
        active: v.id === activeVaultId,
      }));

    const openPaths = new Set(vaults.map((v) => v.root));
    const recentItems: Item[] = recent
      .filter(({ entry }) => !openPaths.has(entry.path))
      .filter(({ entry }) => {
        const name = entry.path.split("/").filter(Boolean).pop() ?? entry.path;
        return matches(name, entry.path);
      })
      .map(({ id, entry }) => ({ kind: "recent" as const, id, entry }));

    return [...openItems, ...recentItems, { kind: "new" }];
  }, [vaults, activeVaultId, recent, query]);

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

  const handleSelect = async (item: Item) => {
    onClose();
    switch (item.kind) {
      case "open":
        if (item.vault.id !== activeVaultId) await setActive(item.vault.id);
        break;
      case "recent":
        await openVaultLegacy(item.entry.path);
        break;
      case "new": {
        const path = await openDialog({
          directory: true,
          multiple: false,
          title: t("vault-dock:openDialogTitle", "Open another vault"),
        });
        if (typeof path === "string") await openVaultLegacy(path);
        break;
      }
    }
  };

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
      if (item) void handleSelect(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // 그룹 헤더는 첫 등장 시점에만 렌더 — 인덱스로 탐지
  const firstRecentIdx = items.findIndex((i) => i.kind === "recent");
  const newIdx = items.findIndex((i) => i.kind === "new");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-lg rounded-lg border shadow-2xl",
          "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
        )}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border-primary)] px-3 py-2">
          <Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t(
              "vault-dock:switcher.placeholder",
              "Switch vault…",
            )}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>

        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
              {t("palette:empty.noResults", "No results")}
            </li>
          ) : (
            items.map((item, i) => {
              const showOpenHeader = i === 0 && item.kind === "open";
              const showRecentHeader = i === firstRecentIdx && firstRecentIdx >= 0;
              const showNewHeader = i === newIdx;
              return (
                <li key={itemKey(item, i)}>
                  {showOpenHeader && (
                    <GroupHeader
                      label={t("vault-dock:switcher.group.open", "Open")}
                    />
                  )}
                  {showRecentHeader && (
                    <GroupHeader
                      label={t("vault-dock:switcher.group.recent", "Recent")}
                    />
                  )}
                  {showNewHeader && i > 0 && (
                    <GroupHeader
                      label={t("vault-dock:switcher.group.new", "New")}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSelect(item)}
                    onMouseEnter={() => setSelectedIdx(i)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      i === selectedIdx
                        ? "bg-[var(--color-bg-hover)]"
                        : "hover:bg-[var(--color-bg-hover)]",
                    )}
                  >
                    <Icon item={item} />
                    <ItemLabel item={item} />
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border-primary)] px-3 py-1.5 text-[10px] text-[var(--color-text-tertiary)]">
          <span>{t("palette:footer.navigate", "↑↓ Navigate")}</span>
          <span>{t("palette:footer.open", "Enter Run")}</span>
          <span>{t("palette:footer.dismiss", "Esc Close")}</span>
        </div>
      </div>
    </div>
  );
}

function itemKey(item: Item, fallbackIdx: number): string {
  switch (item.kind) {
    case "open":
      return `open:${item.vault.id}`;
    case "recent":
      return `recent:${item.id}`;
    case "new":
      return `new:${fallbackIdx}`;
  }
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wide text-[var(--color-text-tertiary)]">
      {label}
    </div>
  );
}

function Icon({ item }: { item: Item }) {
  if (item.kind === "new") {
    return (
      <FolderPlus className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
    );
  }
  return (
    <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
  );
}

function ItemLabel({ item }: { item: Item }) {
  const { t } = useTranslation(["vault-dock"]);
  if (item.kind === "new") {
    return (
      <span className="flex-1 truncate">
        {t("vault-dock:switcher.action.openNew", "Open vault…")}
      </span>
    );
  }
  if (item.kind === "open") {
    return (
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <span className="truncate">{item.vault.name}</span>
          <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">
            {item.vault.root}
          </span>
        </div>
        {item.active && (
          <span className="shrink-0 rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[9px] font-mono uppercase text-[var(--color-text-secondary)]">
            {t("vault-dock:switcher.activeTag", "active")}
          </span>
        )}
      </div>
    );
  }
  // recent
  const name =
    item.entry.path.split("/").filter(Boolean).pop() ?? item.entry.path;
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <span className="truncate">{name}</span>
      <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">
        {item.entry.path}
      </span>
    </div>
  );
}
