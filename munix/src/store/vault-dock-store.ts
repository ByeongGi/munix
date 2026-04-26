/**
 * VaultDockStore — Vault Dock 표시용 메타 store. (ADR-031, multi-vault-spec §6.1)
 *
 * Phase B-β 단계 — 골격만 도입. 폴링 / event 구독 / 핀 / 순서 관리 등
 * 핵심 기능은 Phase C(UI) 진입 시 채운다.
 *
 * 책임 분리:
 * - **VaultDockStore**: 모든 열린 vault 메타 (Vault Dock 표시·전환)
 * - **WorkspaceRegistry** (`workspace-registry.ts`): vault 별 작업 상태
 * - **legacy `useVaultStore`**: 단일 vault 시점 호환 — Phase B-ε 정리 예정
 */

import { create } from "zustand";

import { ipc } from "@/lib/ipc";
import type { VaultInfo } from "@/types/ipc";
import {
  registerVaultActive,
  registerVaultClose,
  registerVaultOpen,
} from "@/lib/vault-registry";
import type { VaultId } from "./vault-types";
import {
  attachWorkspacePersist,
  disposeWorkspaceStore,
  getWorkspaceStore,
  hydrateWorkspaceStore,
  type WorkspaceStoreHook,
} from "./workspace-registry";

const DOCK_VISIBLE_KEY = "munix:vaultDockVisible";

function readInitialVisible(): boolean {
  try {
    const raw = localStorage.getItem(DOCK_VISIBLE_KEY);
    if (raw === null) return true;
    return raw !== "false";
  } catch {
    return true;
  }
}

async function restoreActiveWorkspaceFile(
  store: WorkspaceStoreHook,
): Promise<void> {
  const state = store.getState();
  const activeTab = state.tabs.find((tab) => tab.id === state.activeId);
  if (!activeTab) return;
  if (!activeTab.path) {
    state.closeFile();
    return;
  }
  try {
    await state.openFile(activeTab.path);
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[workspace] restore active file failed", e);
    }
  }
}

interface VaultDockStore {
  /** backend `list_open_vaults` 의 최근 스냅샷. */
  vaults: VaultInfo[];
  /** 이 창의 active vault id. backend ActiveVault 어댑터와 동기 (Phase A-5). */
  activeVaultId: VaultId | null;
  loading: boolean;
  /** Dock 가시성 — `⌘⌥B` 토글. localStorage 영구화. */
  visible: boolean;

  /** backend 와 동기화. open/close 호출 직후, 또는 watcher 이벤트 시 호출. */
  refresh: () => Promise<void>;
  /** active vault 변경. backend `set_active_vault` 호출 후 로컬 갱신. */
  setActive: (id: VaultId) => Promise<void>;
  /** vault 열기 (backend 호출 + 로컬 동기). */
  openVault: (path: string) => Promise<VaultId>;
  /** vault 닫기 (backend + 로컬 + workspace store 정리). */
  closeVault: (id: VaultId) => Promise<void>;
  /** Dock 가시성 토글. */
  toggleVisible: () => void;
}

export const useVaultDockStore = create<VaultDockStore>((set) => ({
  vaults: [],
  activeVaultId: null,
  loading: false,
  visible: readInitialVisible(),

  toggleVisible: () =>
    set((s) => {
      const next = !s.visible;
      try {
        localStorage.setItem(DOCK_VISIBLE_KEY, String(next));
      } catch {
        // ignore
      }
      return { visible: next };
    }),

  refresh: async () => {
    set({ loading: true });
    try {
      const vaults = await ipc.listOpenVaults();
      set((s) => ({
        vaults,
        // backend 가 닫힌 vault 가 active 였다면 정리
        activeVaultId:
          s.activeVaultId && vaults.some((v) => v.id === s.activeVaultId)
            ? s.activeVaultId
            : (vaults[0]?.id ?? null),
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  setActive: async (id) => {
    await ipc.setActiveVault(id);
    set({ activeVaultId: id });
    void registerVaultActive(id);
  },

  openVault: async (path) => {
    const info = await ipc.openVault(path, true);

    // workspace 복원 — store 만들고 hydrate 후 persist subscribe 부착.
    // 순서 중요: hydrate 가 발생시키는 setState 는 subscribe 부착 전이라
    // 자동 save round-trip 을 일으키지 않는다. (ADR-031 D2)
    const store = getWorkspaceStore(info.id);
    try {
      const raw = await ipc.workspaceLoad(info.id);
      if (raw) hydrateWorkspaceStore(store, raw);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[workspace] hydrate failed", e);
      }
    }
    await restoreActiveWorkspaceFile(store);
    attachWorkspacePersist(store, info.id);

    set((s) => {
      const exists = s.vaults.some((v) => v.id === info.id);
      return {
        vaults: exists ? s.vaults : [...s.vaults, info],
        activeVaultId: info.id,
      };
    });

    // 글로벌 registry (`munix.json`) 갱신 — ADR-032
    void registerVaultOpen(info.id, info.root, true);

    return info.id;
  },

  closeVault: async (id) => {
    await ipc.closeVault(id);
    disposeWorkspaceStore(id);
    set((s) => {
      const next = s.vaults.filter((v) => v.id !== id);
      return {
        vaults: next,
        activeVaultId:
          s.activeVaultId === id ? (next[0]?.id ?? null) : s.activeVaultId,
      };
    });
    void registerVaultClose(id);
  },
}));
