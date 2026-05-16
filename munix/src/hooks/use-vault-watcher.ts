import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useVaultStore } from "@/store/vault-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { isTauriRuntime } from "@/lib/tauri-runtime";
import { applyWorkspaceFileChange } from "@/lib/workspace-file-change";

interface FileChangeEvent {
  vaultId: string;
  kind: "modified" | "created" | "deleted";
  path: string;
}

/**
 * Rust watcher가 보내는 `vault:fs-changed` 이벤트 수신.
 *
 * payload `vaultId` 기준으로 그 vault 의 workspace store 에 직접 dispatch
 * (멀티 vault 동시 운영 시 active vault 가 아닌 vault 의 변경도 정확히 라우팅).
 *
 * - 파일 트리 (vault-store) refresh: active vault 일 때만 (캐시 단일 슬롯)
 * - search/tab/backlink/tag: 그 vault 의 workspace store 인스턴스에 적용
 * - editor reload: 그 vault 가 active 일 때만 (현재 구조상 active 외 vault 의
 *   currentPath 는 사용자 전환 시 자연 갱신)
 */
export function useVaultWatcher(): void {
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    void listen<FileChangeEvent>("vault:fs-changed", (event) => {
      const { vaultId, kind, path } = event.payload;
      if (!vaultId) return;

      const activeId = useVaultDockStore.getState().activeVaultId;
      const isActive = vaultId === activeId;

      // 파일 트리 갱신 (active vault 의 캐시만 보유)
      if (isActive) {
        void useVaultStore.getState().refresh();
      }

      applyWorkspaceFileChange(vaultId, kind, path, {
        reloadCurrentEditor: isActive,
      });
    })
      .then((u) => {
        if (cancelled) {
          u();
        } else {
          unlisten = u;
        }
      })
      .catch((e) => {
        if (import.meta.env.DEV) {
          console.warn("[vault-watcher] listen failed", e);
        }
      });

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);
}
