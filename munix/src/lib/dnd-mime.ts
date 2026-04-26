/**
 * DnD MIME 정의 — workspace-split-spec §6.1 / file-tree 와 일관성.
 *
 * - file-tree: `application/munix-path`
 * - 탭: `application/munix-tab` (이번 spec 채택)
 *
 * 기존 `application/x-munix-tab` 은 v0 internal — 혼재 기간 동안 양쪽 다
 * setData 한다. 새 코드는 spec MIME 만 읽어도 충분.
 */

import type { VaultId } from "@/store/vault-types";

export const TAB_DND_MIME = "application/munix-tab";

/** v0 호환 — 단일 pane 모드 인덱스 reorder 만 사용. 점진 제거. */
export const LEGACY_TAB_DND_MIME = "application/x-munix-tab";

export interface DragTabPayload {
  type: "munix/tab";
  vaultId: VaultId | null;
  tabId: string;
  /**
   * source pane id. null 이면 단일 pane 모드 (tree=null) — edge drop 시
   * split tree 로 promotion 하면서 dragged tab 을 새 pane 으로 이동한다.
   */
  fromPaneId: string | null;
  path: string;
}

export function serializeTabPayload(p: DragTabPayload): string {
  return JSON.stringify(p);
}

export function parseTabPayload(raw: string): DragTabPayload | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as DragTabPayload;
    if (v && v.type === "munix/tab" && typeof v.tabId === "string") return v;
  } catch {
    // ignore
  }
  return null;
}
