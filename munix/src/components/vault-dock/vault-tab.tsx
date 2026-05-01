import { AlertTriangle, Pin } from "lucide-react";
import type { VaultInfo } from "@/types/ipc";
import { cn } from "@/lib/cn";

export interface VaultTabProps {
  info: VaultInfo;
  active: boolean;
  pinned?: boolean;
  unsavedCount?: number;
  indexing?: boolean;
  onActivate: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function getVaultInitial(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase() : "?";
}

/** Vault Dock 의 탭 한 개. (multi-vault-spec §6.1) */
export function VaultTab({
  info,
  active,
  pinned = false,
  unsavedCount,
  indexing = false,
  onActivate,
  onContextMenu,
}: VaultTabProps) {
  const subtitle = indexing
    ? "indexing..."
    : unsavedCount && unsavedCount > 0
      ? `${unsavedCount} unsaved`
      : info.root;
  const title = `${info.name}\n${subtitle}`;

  return (
    <button
      type="button"
      onClick={onActivate}
      onContextMenu={onContextMenu}
      className={cn(
        "group relative flex h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left",
        "transition-colors",
        active
          ? "bg-sidebar-item-selected text-sidebar-text shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.1)]"
          : "text-sidebar-text-muted hover:bg-sidebar-item-hovered hover:text-sidebar-text",
      )}
      aria-current={active ? "true" : undefined}
      title={title}
      aria-label={title}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-0.5 rounded-r-sm bg-accent"
        />
      )}
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          "bg-sidebar-item-bg text-[11px] font-semibold leading-none",
          active ? "bg-accent-muted text-accent" : "text-sidebar-text-subtle",
        )}
        aria-hidden
      >
        {getVaultInitial(info.name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        {info.name}
      </span>
      {pinned && <Pin className="h-3 w-3 shrink-0 text-accent" />}
      {unsavedCount && unsavedCount > 0 ? (
        <AlertTriangle className="h-3 w-3 shrink-0 text-[var(--color-warning)]" />
      ) : null}
      {indexing && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-info"
        />
      )}
    </button>
  );
}
