import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useVaultStore } from "@/store/vault-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { getWorkspaceStore } from "@/store/workspace-registry";
import { ipc } from "@/lib/ipc";

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
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    void listen<FileChangeEvent>("vault:fs-changed", (event) => {
      const { vaultId, kind, path } = event.payload;
      if (!vaultId) return;

      const activeId = useVaultDockStore.getState().activeVaultId;
      const isActive = vaultId === activeId;

      const workspace = getWorkspaceStore(vaultId).getState();

      // 파일 트리 갱신 (active vault 의 캐시만 보유)
      if (isActive) {
        void useVaultStore.getState().refresh();
      }

      // 검색 인덱스 증분 업데이트 — 해당 vault 의 search slice 에 적용
      const search = workspace.search;
      if (search.status === "ready") {
        if (kind === "deleted") {
          search.index.removeDoc(path);
          // 그 vault 의 query 가 있으면 결과 재계산
          const cur = getWorkspaceStore(vaultId).getState().search;
          if (cur.status === "ready" && cur.query) cur.setQuery(cur.query);
        } else if (/\.md$/i.test(path)) {
          void (async () => {
            try {
              const content = await ipc.readMarkdownFile(path, vaultId);
              const cur = getWorkspaceStore(vaultId).getState().search;
              if (cur.status !== "ready") return;
              cur.index.updateDoc(path, content.body);
              if (cur.query) cur.setQuery(cur.query);
            } catch {
              // read 실패는 무시 (파일이 곧 다시 사라질 수도)
            }
          })();
        }
      }

      // 외부 삭제 시 그 vault 의 탭/backlink/tag 에서 제거.
      // tab-slice removeByPath 가 tree 모드일 때 모든 pane 도 정리 (Phase D).
      if (kind === "deleted") {
        getWorkspaceStore(vaultId).getState().removeByPath(path);
        getWorkspaceStore(vaultId).getState().backlinks.removePath(path);
        getWorkspaceStore(vaultId).getState().tags.removePath(path);
      } else if (kind === "modified" || kind === "created") {
        // BacklinksSlice / TagsSlice 가 closure 로 vaultId 캡처 → 인덱스가 그
        // vault 의 파일을 읽음. 비-active vault 도 정확히 갱신.
        if (/\.md$/i.test(path)) {
          void getWorkspaceStore(vaultId).getState().backlinks.updatePath(path);
          void getWorkspaceStore(vaultId).getState().tags.updatePath(path);
        }
      }

      // 현재 파일 reload — active vault 일 때만 (ipc.readFile 이 active 기준)
      if (isActive) {
        const editor = workspace;
        if (editor.currentPath && kind === "modified" && path === editor.currentPath) {
          const s = editor.status.kind;
          if (s === "idle" || s === "saved") {
            void editor.reloadFromDisk();
          }
        }
      }
    }).then((u) => {
      if (cancelled) {
        u();
      } else {
        unlisten = u;
      }
    });

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);
}
