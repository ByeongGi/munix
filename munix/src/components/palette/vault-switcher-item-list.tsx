import type { TFunction } from "i18next";
import { Folder, FolderPlus } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  getVaultNameFromPath,
  getVaultSwitcherItemKey,
  type VaultSwitcherItem,
} from "./vault-switcher-items";

interface VaultSwitcherItemListProps {
  items: VaultSwitcherItem[];
  selectedIndex: number;
  t: TFunction<["vault-dock", "palette", "common"]>;
  onRun: (item: VaultSwitcherItem) => void;
  onSelect: (index: number) => void;
}

export function VaultSwitcherItemList({
  items,
  selectedIndex,
  t,
  onRun,
  onSelect,
}: VaultSwitcherItemListProps) {
  const firstRecentIndex = items.findIndex((item) => item.kind === "recent");
  const newIndex = items.findIndex((item) => item.kind === "new");

  return items.map((item, index) => {
    const showOpenHeader = index === 0 && item.kind === "open";
    const showRecentHeader =
      index === firstRecentIndex && firstRecentIndex >= 0;
    const showNewHeader = index === newIndex && index > 0;

    return (
      <li key={getVaultSwitcherItemKey(item, index)}>
        {showOpenHeader ? (
          <GroupHeader label={t("vault-dock:switcher.group.open", "Open")} />
        ) : null}
        {showRecentHeader ? (
          <GroupHeader
            label={t("vault-dock:switcher.group.recent", "Recent")}
          />
        ) : null}
        {showNewHeader ? (
          <GroupHeader label={t("vault-dock:switcher.group.new", "New")} />
        ) : null}
        <button
          type="button"
          onClick={() => onRun(item)}
          onMouseEnter={() => onSelect(index)}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
            index === selectedIndex
              ? "bg-[var(--color-bg-hover)]"
              : "hover:bg-[var(--color-bg-hover)]",
          )}
        >
          <VaultSwitcherItemIcon item={item} />
          <VaultSwitcherItemLabel item={item} t={t} />
        </button>
      </li>
    );
  });
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wide text-[var(--color-text-tertiary)]">
      {label}
    </div>
  );
}

function VaultSwitcherItemIcon({ item }: { item: VaultSwitcherItem }) {
  if (item.kind === "new") {
    return (
      <FolderPlus className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
    );
  }

  return (
    <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
  );
}

function VaultSwitcherItemLabel({
  item,
  t,
}: {
  item: VaultSwitcherItem;
  t: TFunction<["vault-dock", "palette", "common"]>;
}) {
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
        {item.active ? (
          <span className="shrink-0 rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[9px] font-mono uppercase text-[var(--color-text-secondary)]">
            {t("vault-dock:switcher.activeTag", "active")}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <span className="truncate">{getVaultNameFromPath(item.entry.path)}</span>
      <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">
        {item.entry.path}
      </span>
    </div>
  );
}
