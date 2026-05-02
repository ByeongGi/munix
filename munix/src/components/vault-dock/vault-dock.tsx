import { useEffect, useState } from "react";
import { ChevronDown, FolderPlus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { useVaultDockStore } from "@/store/vault-dock-store";
import { useVaultStore } from "@/store/vault-store";
import { ipc } from "@/lib/ipc";
import {
  requestCloseContextMenus,
  subscribeContextMenuClose,
} from "@/lib/context-menu-coordinator";
import type { VaultInfo } from "@/types/ipc";
import { cn } from "@/lib/cn";
import {
  VaultTabContextMenu,
  type VaultTabAction,
} from "./vault-tab-context-menu";

interface ContextMenuState {
  vault: VaultInfo;
  x: number;
  y: number;
}

interface VaultDockProps {
  onOpenSwitcher: () => void;
}

/** Vault Dock — cmux 스타일 좌측 세로 탭. (ADR-031, multi-vault-spec §6.1) */
export function VaultDock({ onOpenSwitcher }: VaultDockProps) {
  const { t } = useTranslation(["vault-dock", "common"]);
  const vaults = useVaultDockStore((s) => s.vaults);
  const activeVaultId = useVaultDockStore((s) => s.activeVaultId);
  const visible = useVaultDockStore((s) => s.visible);
  const openVaultLegacy = useVaultStore((s) => s.open);

  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const unsubscribeContextMenuClose = subscribeContextMenuClose(close);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close, { once: true });
    return () => {
      unsubscribeContextMenuClose();
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu]);

  if (!visible) return null;

  const activeVault = vaults.find((v) => v.id === activeVaultId) ?? vaults[0];

  const handleOpenAnother = async () => {
    const path = await openDialog({
      directory: true,
      multiple: false,
      title: t("vault-dock:openDialogTitle", "Open another vault"),
    });
    if (typeof path === "string") {
      // legacy useVaultStore 가 vault-dock-store.openVault 로 위임 — 한 호출로 둘 다 동기화
      await openVaultLegacy(path);
    }
  };

  const handleAction = async (
    vault: VaultInfo,
    action: VaultTabAction,
  ): Promise<void> => {
    setMenu(null);
    switch (action) {
      case "close": {
        // 단일 vault 시점: 마지막 vault 닫기 → vault-store.close 가 dock store 도 정리
        if (vault.id === activeVaultId && vaults.length === 1) {
          await useVaultStore.getState().close();
        } else {
          await useVaultDockStore.getState().closeVault(vault.id);
        }
        break;
      }
      case "removeFromHistory": {
        // 순서 중요 — 먼저 munix.json 에서 entry 제거 → 그 다음 close.
        // close 내부의 registerVaultClose 는 fire-and-forget 비동기인데,
        // 이게 vaultRegistryRemove 와 동시에 진행되면 stale snapshot 으로
        // entry 가 munix.json 에 부활할 수 있다. registerVaultClose 는 entry
        // 없을 때 no-op 이므로 (vault-registry.ts:58-59), entry 를 먼저 지우면
        // race 자체가 없어진다.
        try {
          await ipc.vaultRegistryRemove(vault.id);
        } catch {
          // ignore
        }
        if (vault.id === activeVaultId && vaults.length === 1) {
          await useVaultStore.getState().close();
        } else {
          await useVaultDockStore.getState().closeVault(vault.id);
        }
        break;
      }
      case "togglePin":
        // Phase C-1 단계에선 미구현 — D-1 결정사항 후속
        break;
      case "copyPath":
        await ipc.copyText(vault.root);
        break;
      case "revealInSystem":
        try {
          await ipc.revealInSystem("");
        } catch {
          // ignore — vault root 자체는 trust 우회 필요 (vault-trust-spec)
        }
        break;
    }
  };

  return (
    <section
      aria-label={t("vault-dock:label", "Vault Dock")}
      className="mt-2 shrink-0"
    >
      {activeVault ? (
        <button
          type="button"
          onClick={onOpenSwitcher}
          onContextMenu={(e) => {
            e.preventDefault();
            requestCloseContextMenus();
            setMenu({ vault: activeVault, x: e.clientX, y: e.clientY });
          }}
          title={`${activeVault.name}\n${activeVault.root}`}
          aria-label={activeVault.name}
          className={cn(
            "group flex h-12 w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 text-left",
            "bg-sidebar-item-bg text-sidebar-text transition-colors",
            "shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.05)] hover:bg-sidebar-item-hovered",
          )}
        >
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              "bg-accent-muted text-xs font-semibold leading-none text-accent",
            )}
            aria-hidden
          >
            {getVaultInitial(activeVault.name)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium leading-tight">
              {activeVault.name}
            </span>
            <span className="truncate text-[11px] leading-tight text-sidebar-text-subtle">
              {t("vault-dock:switcherHint", "Switch vault")}
            </span>
          </span>
          {vaults.length > 1 ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none",
                "bg-sidebar-item-selected text-sidebar-text-muted",
              )}
              aria-label={t("vault-dock:openCount", {
                count: vaults.length,
                defaultValue: "{{count}} open vaults",
              })}
            >
              {vaults.length}
            </span>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-text-muted transition-colors group-hover:text-sidebar-text" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpenAnother}
          className={cn(
            "flex h-12 w-full items-center gap-2.5 rounded-xl px-2.5 text-left",
            "bg-sidebar-item-bg text-sidebar-text-muted transition-colors",
            "hover:bg-sidebar-item-hovered hover:text-sidebar-text",
          )}
        >
          <FolderPlus className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {t("vault-dock:openAnother", "Open vault…")}
          </span>
          <Plus className="h-3.5 w-3.5 shrink-0" />
        </button>
      )}

      {menu && (
        <VaultTabContextMenu
          vault={menu.vault}
          pinned={false}
          x={menu.x}
          y={menu.y}
          onAction={(action) => void handleAction(menu.vault, action)}
        />
      )}
    </section>
  );
}

function getVaultInitial(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase() : "?";
}
