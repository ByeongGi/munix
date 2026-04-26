/**
 * useEditorStore — Phase B-γ 호환 wrapper. (ADR-031)
 *
 * 실제 상태/액션은 active vault 의 workspace store 안 EditorSlice 가 보유.
 * 컴포넌트 입장에선 시그니처가 그대로다 — `useEditorStore(s => s.currentPath)`,
 * `useEditorStore.getState().flushSave?.()` 모두 호환.
 *
 * **구현 노트:** 초기 버전은 `const ws = useActiveWorkspaceStore(); return ws(selector);`
 * 식의 hook-of-hooks 패턴이었으나, vault swap 시점에 `ws` 가 다른 store hook 인스턴스로
 * 바뀌면서 자식 컴포넌트의 selector subscription 이 흔들려 PropertiesPanel/EditorView 가
 * 깜빡였다. zustand 의 generic `useStore(api, selector)` 를 직접 호출하면 store API 가
 * 다른 객체로 바뀌어도 React 가 안전하게 subscription 을 swap 한다.
 *
 * source of truth (active vault id) 는 legacy `useVaultStore.info.id` —
 * Phase B-ε 에서 vault-dock-store 로 이관 예정.
 */

import { useStore } from "zustand";

import { useActiveVaultId, NO_VAULT_ID } from "@/lib/active-vault-context";
import { getWorkspaceStore } from "@/store/workspace-registry";
import { useVaultDockStore } from "@/store/vault-dock-store";
import {
  defaultEditorSlice,
  type EditorSlice,
} from "@/store/slices/editor-slice";

export type {
  SaveStatus,
  FlushOptions,
  FlushFn,
} from "@/store/slices/editor-slice";

interface EditorStoreApi {
  <T>(selector: (s: EditorSlice) => T): T;
  getState(): EditorSlice;
}

const useEditorStoreFn = <T,>(selector: (s: EditorSlice) => T): T => {
  const id = useActiveVaultId();
  const store = getWorkspaceStore(id ?? NO_VAULT_ID);
  return useStore(store, selector);
};

(useEditorStoreFn as EditorStoreApi).getState = (): EditorSlice => {
  const id = useVaultDockStore.getState().activeVaultId;
  if (!id) {
    return defaultEditorSlice();
  }
  return getWorkspaceStore(id).getState();
};

export const useEditorStore = useEditorStoreFn as EditorStoreApi;
