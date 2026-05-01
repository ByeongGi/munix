import { Copy, ExternalLink, PinOff, Pin, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { VaultInfo } from "@/types/ipc";

export type VaultTabAction =
  | "close"
  | "removeFromHistory"
  | "togglePin"
  | "copyPath"
  | "revealInSystem";

export interface VaultTabContextMenuProps {
  vault: VaultInfo;
  pinned: boolean;
  x: number;
  y: number;
  onAction: (action: VaultTabAction) => void;
}

/** Vault 탭 우클릭 컨텍스트 메뉴. (multi-vault-spec §6.1) */
export function VaultTabContextMenu({
  vault: _vault,
  pinned,
  x,
  y,
  onAction,
}: VaultTabContextMenuProps) {
  const { t } = useTranslation(["vault-dock", "common"]);

  return (
    <div
      role="menu"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed z-50 min-w-[200px] rounded-md border p-1 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
      )}
      style={{ left: x, top: y }}
    >
      <MenuItem
        onClick={() => onAction("togglePin")}
        icon={
          pinned ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )
        }
        label={pinned ? t("vault-dock:menu.unpin") : t("vault-dock:menu.pin")}
      />
      <MenuItem
        onClick={() => onAction("copyPath")}
        icon={<Copy className="h-3.5 w-3.5" />}
        label={t("vault-dock:menu.copyPath")}
      />
      <MenuItem
        onClick={() => onAction("revealInSystem")}
        icon={<ExternalLink className="h-3.5 w-3.5" />}
        label={t("vault-dock:menu.revealInSystem")}
      />
      <Divider />
      <MenuItem
        onClick={() => onAction("close")}
        icon={<X className="h-3.5 w-3.5" />}
        label={t("vault-dock:menu.close")}
      />
      <MenuItem
        onClick={() => onAction("removeFromHistory")}
        icon={<Trash2 className="h-3.5 w-3.5" />}
        label={t("vault-dock:menu.removeFromHistory")}
        danger
      />
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  label,
  danger = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
        "hover:bg-[var(--color-bg-hover)]",
        danger
          ? "text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div
      role="separator"
      className="my-1 h-px bg-[var(--color-border-primary)]"
    />
  );
}
