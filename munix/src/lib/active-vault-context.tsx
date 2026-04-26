/**
 * ActiveVaultProvider — 현재 창의 active vault id 를 자식 트리에 주입한다.
 * (ADR-031, multi-vault-spec §4.2 / §6.6.4)
 *
 * Phase B-α: Provider + 훅만 정의. 실제 mount 와 store 라우팅은 sub-phase
 * B-β (vault-dock-store 도입) 부터 단계적으로 적용.
 *
 * 사용:
 * ```tsx
 * <ActiveVaultProvider vaultId={info?.id ?? null}>
 *   <App />
 * </ActiveVaultProvider>
 * ```
 *
 * 자식 컴포넌트:
 * ```tsx
 * const vaultId = useActiveVaultId();           // 없으면 null
 * const required = useRequiredActiveVaultId();  // 없으면 throw
 * const ws = useActiveWorkspaceStore();         // hook of hooks
 * ```
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  getWorkspaceStore,
  type WorkspaceStoreHook,
} from "@/store/workspace-registry";
import type { VaultId } from "@/store/vault-types";

interface ActiveVaultContextValue {
  vaultId: VaultId | null;
}

const ActiveVaultContext = createContext<ActiveVaultContextValue | null>(null);

interface ActiveVaultProviderProps {
  vaultId: VaultId | null;
  children: ReactNode;
}

export function ActiveVaultProvider({
  vaultId,
  children,
}: ActiveVaultProviderProps) {
  const value = useMemo(() => ({ vaultId }), [vaultId]);
  return (
    <ActiveVaultContext.Provider value={value}>
      {children}
    </ActiveVaultContext.Provider>
  );
}

/**
 * 현재 active vault id. provider 밖에서 호출하면 null.
 * Phase B-α 동안엔 호출처가 없을 수 있다 — 그래서 strict 하게 throw 하지 않는다.
 */
export function useActiveVaultId(): VaultId | null {
  return useContext(ActiveVaultContext)?.vaultId ?? null;
}

/**
 * active vault id 가 반드시 있어야 하는 컴포넌트용. 없으면 throw.
 * Phase B-γ 이후 vault scope 컴포넌트들이 사용.
 */
export function useRequiredActiveVaultId(): VaultId {
  const id = useActiveVaultId();
  if (!id) {
    throw new Error(
      "useRequiredActiveVaultId called outside an active vault context",
    );
  }
  return id;
}

/**
 * vault 가 아직 열리지 않은 상태에서 호환 layer 가 사용하는 placeholder.
 * `getWorkspaceStore(NO_VAULT_ID)` 는 default state 만 가진 dummy store 를 반환하므로
 * legacy 컴포넌트가 vault picker 화면에서도 안전하게 selector 를 호출할 수 있다.
 */
export const NO_VAULT_ID = "__no_vault__";

/**
 * active vault 의 workspace store hook 을 가져온다.
 * vault 가 없으면 placeholder store(default state) 를 돌려준다 — legacy 호환.
 * (hook of hooks — 자식 컴포넌트에서 `useActiveWorkspaceStore()(s => s.activeTabId)` 패턴)
 */
export function useActiveWorkspaceStore(): WorkspaceStoreHook {
  const id = useActiveVaultId();
  return getWorkspaceStore(id ?? NO_VAULT_ID);
}
