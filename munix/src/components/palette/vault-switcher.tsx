import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { useVaultDockStore } from "@/store/vault-dock-store";
import { useVaultStore } from "@/store/vault-store";
import {
  listClosedVaults,
  type VaultRegistryEntry,
} from "@/lib/vault-registry";
import { CommandDialog } from "@/components/ui/command-dialog";
import { VaultSwitcherItemList } from "./vault-switcher-item-list";
import type { VaultSwitcherItem } from "./vault-switcher-items";
import { useVaultSwitcherItems } from "./use-vault-switcher-items";

interface VaultSwitcherProps {
  open: boolean;
  onClose: () => void;
}

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

  const items = useVaultSwitcherItems({
    activeVaultId,
    query,
    recent,
    vaults,
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

  const handleSelect = async (item: VaultSwitcherItem) => {
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

  return (
    <CommandDialog
      icon={<Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />}
      inputRef={inputRef}
      listRef={listRef}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={onKeyDown}
      onClose={onClose}
      placeholder={t("vault-dock:switcher.placeholder", "Switch vault…")}
      footer={
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border-primary)] px-3 py-1.5 text-[10px] text-[var(--color-text-tertiary)]">
          <span>{t("palette:footer.navigate", "↑↓ Navigate")}</span>
          <span>{t("palette:footer.open", "Enter Run")}</span>
          <span>{t("palette:footer.dismiss", "Esc Close")}</span>
        </div>
      }
    >
      {items.length === 0 ? (
        <li className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
          {t("palette:empty.noResults", "No results")}
        </li>
      ) : (
        <VaultSwitcherItemList
          items={items}
          selectedIndex={selectedIdx}
          t={t}
          onRun={(item) => void handleSelect(item)}
          onSelect={setSelectedIdx}
        />
      )}
    </CommandDialog>
  );
}
