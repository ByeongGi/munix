/**
 * useVaultStore — Phase B-ε wrapper. (ADR-031, ADR-032)
 *
 * 단일 vault 시점의 호환을 위해 info/files 만 캐시. open/close 는 항상
 * `vault-dock-store` 에 위임 — backend `VaultManager` 의 진실과 동기되도록.
 * source of truth (active vault id) 는 vault-dock-store.activeVaultId.
 *
 * 글로벌 vault 목록·history·last vault 영구화는 backend `munix.json`
 * (ADR-032). 본 store 는 localStorage 에 어떤 것도 저장하지 않는다.
 */

import { create } from "zustand";
import i18n from "i18next";
import { confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";
import type { FileNode, VaultInfo } from "@/types/ipc";
import { ipc } from "@/lib/ipc";
import { useVaultDockStore } from "@/store/vault-dock-store";

let listFilesRequestSeq = 0;

interface VaultStore {
  info: VaultInfo | null;
  files: FileNode[];
  loading: boolean;
  error: string | null;

  open: (path: string) => Promise<void>;
  close: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  info: null,
  files: [],
  loading: false,
  error: null,

  open: async (path) => {
    // ADR-031 C-6: 새 vault 면 trust prompt. 사용자가 거부하면 조용히 중단
    // (error state set X — 의도된 취소). bootstrap 의 자동 reopen 은
    // useVaultDockStore.openVault 를 직접 호출하므로 이 경로 우회.
    try {
      const trusted = await ipc.isPathTrusted(path);
      if (!trusted) {
        const message = i18n.t("vault:trust.openPrompt", {
          path,
          defaultValue:
            "이 폴더를 vault 로 신뢰하시겠습니까?\n\n{{path}}\n\n.munix/ 메타데이터 폴더가 자동으로 만들어집니다.",
        });
        const ok = await tauriConfirm(message, {
          title: i18n.t("vault:trust.openTitle", {
            defaultValue: "Vault 신뢰",
          }),
          kind: "warning",
        });
        if (!ok) return;
        await ipc.trustPath(path);
      }
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        loading: false,
      });
      return;
    }

    set({ loading: true, error: null });
    try {
      const id = await useVaultDockStore.getState().openVault(path);
      const info =
        useVaultDockStore.getState().vaults.find((v) => v.id === id) ?? null;
      if (!info) throw new Error("Vault registration missing after openVault");
      const requestSeq = ++listFilesRequestSeq;
      const files = await ipc.listFiles();
      if (
        requestSeq !== listFilesRequestSeq ||
        useVaultDockStore.getState().activeVaultId !== id
      ) {
        set({ loading: false });
        return;
      }
      set({ info, files, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        loading: false,
      });
    }
  },

  close: async () => {
    const cur = get().info;
    if (cur) {
      await useVaultDockStore.getState().closeVault(cur.id);
    } else {
      await ipc.closeVault();
    }
    set({ info: null, files: [], error: null });
  },

  refresh: async () => {
    const info = get().info;
    if (!info) return;
    const requestSeq = ++listFilesRequestSeq;
    const vaultId = info.id;
    if (useVaultDockStore.getState().activeVaultId !== vaultId) return;
    const files = await ipc.listFiles();
    if (requestSeq !== listFilesRequestSeq) return;
    if (useVaultDockStore.getState().activeVaultId !== vaultId) return;
    if (useVaultStore.getState().info?.id !== vaultId) return;
    set({ files });
  },
}));

// vault-dock-store.activeVaultId 가 변하면 본 store 의 info / files 캐시를
// 그 vault 로 swap. open 직후엔 vault-store.open 이 이미 동기 set 하므로
// 같은 id 면 skip 해 중복 listFiles 를 피한다.
useVaultDockStore.subscribe((state, prev) => {
  if (state.activeVaultId === prev.activeVaultId) return;
  const id = state.activeVaultId;
  if (!id) {
    if (useVaultStore.getState().info !== null) {
      useVaultStore.setState({ info: null, files: [], error: null });
    }
    return;
  }
  if (useVaultStore.getState().info?.id === id) return;
  const info = state.vaults.find((v) => v.id === id) ?? null;
  if (!info) return;
  const requestSeq = ++listFilesRequestSeq;
  void ipc
    .listFiles()
    .then((files) => {
      if (requestSeq !== listFilesRequestSeq) return;
      if (useVaultDockStore.getState().activeVaultId !== id) return;
      useVaultStore.setState({ info, files });
    })
    .catch((e) => {
      if (import.meta.env.DEV) {
        console.warn("[vault-store] listFiles after setActive failed", e);
      }
    });
});
