/**
 * WorkspaceRegistry — vault별 zustand store 인스턴스 lookup. (ADR-031)
 *
 * Phase B-α: 인프라 도입.
 * Phase B-γ: EditorSlice 흡수.
 * Phase B-δ: search/tag/backlink/recent slice 흡수.
 *
 * 라이프사이클:
 * - vault 오픈 → `getOrCreate(id)` 가 호출되어 빈 store 생성
 * - vault 전환 → `<ActiveVaultProvider>` 가 active id 를 갱신, 컴포넌트는
 *   `useActiveWorkspaceStore()` 로 lookup
 * - vault 닫힘 → `dispose(id)` 가 호출되어 메모리 회수
 *
 * 같은 vault를 두 윈도우에서 띄우는 시나리오 (Phase D)는 B-ε 시점에
 * `Map<{vaultId, windowLabel}, ...>` 로 확장 검토.
 */

import { create, type StoreApi, type UseBoundStore } from "zustand";

import { ipc } from "@/lib/ipc";
import {
  createEmptyWorkspace,
  type WorkspaceNode,
  type WorkspaceState,
} from "./workspace-types";
import type { VaultId } from "./vault-types";
import { createEditorSlice, type EditorSlice } from "./slices/editor-slice";
import { createTabSlice, type TabSlice } from "./slices/tab-slice";
import { createSearchSlice, type SearchSlice } from "./slices/search-slice";
import { createTagsSlice, type TagsSlice } from "./slices/tags-slice";
import {
  createBacklinksSlice,
  type BacklinksSlice,
} from "./slices/backlinks-slice";
import { createRecentSlice, type RecentSlice } from "./slices/recent-slice";
import {
  createPropertyTypesSlice,
  type PropertyTypesSlice,
} from "./slices/property-types-slice";
import {
  createWorkspaceTreeSlice,
  type WorkspaceTreeSlice,
} from "./slices/workspace-tree-slice";

interface WorkspaceMetaActions {
  setFileTreeExpanded: (paths: string[]) => void;
  toggleFileTreeNode: (path: string) => void;
  touch: () => void; // lastActiveAt 갱신
  reset: () => void;
}

export type WorkspaceStore = WorkspaceState &
  WorkspaceMetaActions &
  EditorSlice &
  TabSlice &
  WorkspaceTreeSlice &
  SearchSlice &
  TagsSlice &
  BacklinksSlice &
  RecentSlice &
  PropertyTypesSlice;

export type WorkspaceStoreHook = UseBoundStore<StoreApi<WorkspaceStore>>;

const registry = new Map<VaultId, WorkspaceStoreHook>();

function createWorkspaceStore(vaultId: VaultId): WorkspaceStoreHook {
  return create<WorkspaceStore>((set, get, api) => ({
    ...createEmptyWorkspace(vaultId),
    ...createEditorSlice(set, get, api),
    ...createTabSlice(set, get, api),
    ...createWorkspaceTreeSlice(set, get, api),
    ...createSearchSlice(vaultId)(set, get, api),
    ...createTagsSlice(vaultId)(set, get, api),
    ...createBacklinksSlice(vaultId)(set, get, api),
    ...createRecentSlice(set, get, api),
    ...createPropertyTypesSlice(set, get, api),

    setFileTreeExpanded: (paths) =>
      set({ fileTreeExpanded: [...paths], lastActiveAt: Date.now() }),

    toggleFileTreeNode: (path) => {
      const cur = get().fileTreeExpanded ?? [];
      const next = cur.includes(path)
        ? cur.filter((p) => p !== path)
        : [...cur, path];
      set({ fileTreeExpanded: next, lastActiveAt: Date.now() });
    },

    touch: () => set({ lastActiveAt: Date.now() }),

    reset: () => {
      set({
        ...createEmptyWorkspace(vaultId),
        ...createEditorSlice(set, get, api),
        ...createTabSlice(set, get, api),
        ...createWorkspaceTreeSlice(set, get, api),
        ...createSearchSlice(vaultId)(set, get, api),
        ...createTagsSlice(vaultId)(set, get, api),
        ...createBacklinksSlice(vaultId)(set, get, api),
        ...createRecentSlice(set, get, api),
        ...createPropertyTypesSlice(set, get, api),
      });
    },
  }));
}

/** vault 의 workspace store 를 가져온다. 없으면 생성. */
export function getWorkspaceStore(vaultId: VaultId): WorkspaceStoreHook {
  let store = registry.get(vaultId);
  if (!store) {
    store = createWorkspaceStore(vaultId);
    registry.set(vaultId, store);
  }
  return store;
}

/** vault 가 닫혔을 때 메모리 회수. */
export function disposeWorkspaceStore(vaultId: VaultId): void {
  detachWorkspacePersist(vaultId);
  registry.delete(vaultId);
}

/** 디버그용 — 현재 등록된 vault id 목록. */
export function listWorkspaceVaultIds(): VaultId[] {
  return Array.from(registry.keys());
}

// ---------------------------------------------------------------------------
// Persistence — `.munix/workspace.json` (ADR-031, D2)
// ---------------------------------------------------------------------------

const PERSIST_DEBOUNCE_MS = 500;

/**
 * schema version.
 * - v1 : 단일 pane 만 (tabs/activeId/fileTreeExpanded)
 * - v2 : workspace-split-spec §11.1 — workspaceTree/activePaneId 추가.
 *        workspaceTree===null 이면 단일 pane 모드로 유지 (legacy 호환).
 */
const WORKSPACE_VERSION = 2 as const;

interface SerializedWorkspaceV1 {
  version: 1;
  tabs: WorkspaceStore["tabs"];
  activeId: WorkspaceStore["activeId"];
  fileTreeExpanded: string[];
}

interface SerializedWorkspaceV2 {
  version: 2;
  workspaceTree: WorkspaceNode | null;
  activePaneId: string | null;
  tabs: WorkspaceStore["tabs"];
  activeId: WorkspaceStore["activeId"];
  fileTreeExpanded: string[];
}

type SerializedWorkspace = SerializedWorkspaceV1 | SerializedWorkspaceV2;

function serializeWorkspace(s: WorkspaceStore): string {
  const payload: SerializedWorkspaceV2 = {
    version: WORKSPACE_VERSION,
    workspaceTree: s.workspaceTree,
    activePaneId: s.activePaneId,
    tabs: s.tabs,
    activeId: s.activeId,
    fileTreeExpanded: s.fileTreeExpanded ?? [],
  };
  return JSON.stringify(payload);
}

/** disk JSON 으로 store 를 patch. persist subscribe 부착 *전* 에 호출되어야 한다. */
export function hydrateWorkspaceStore(
  store: WorkspaceStoreHook,
  raw: string,
): void {
  try {
    const parsed = JSON.parse(raw) as Partial<SerializedWorkspace>;
    if (parsed.version === 1) {
      // v1 → 단일 pane 모드로 hydrate. 다음 저장에서 자동으로 v2 형식이 됨.
      store.setState({
        tabs: parsed.tabs ?? [],
        activeId: parsed.activeId ?? null,
        fileTreeExpanded: parsed.fileTreeExpanded ?? [],
        workspaceTree: null,
        activePaneId: null,
      });
      return;
    }
    if (parsed.version === 2) {
      const v2 = parsed as Partial<SerializedWorkspaceV2>;
      store.setState({
        tabs: v2.tabs ?? [],
        activeId: v2.activeId ?? null,
        fileTreeExpanded: v2.fileTreeExpanded ?? [],
        workspaceTree: v2.workspaceTree ?? null,
        activePaneId: v2.activePaneId ?? null,
      });
      return;
    }
    if (import.meta.env.DEV) {
      console.warn("[workspace] unknown schema version", parsed.version);
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[workspace] hydrate parse failed", e);
    }
  }
}

const persistTimers = new Map<VaultId, ReturnType<typeof setTimeout>>();
const persistUnsubs = new Map<VaultId, () => void>();

function fireSave(vaultId: VaultId): void {
  const store = registry.get(vaultId);
  if (!store) return;
  const json = serializeWorkspace(store.getState());
  ipc.workspaceSave(json, vaultId).catch((e) => {
    if (import.meta.env.DEV) {
      console.warn("[workspace] save failed", e);
    }
  });
}

/** vault open 직후 호출. 이미 부착되어 있으면 no-op. */
export function attachWorkspacePersist(
  store: WorkspaceStoreHook,
  vaultId: VaultId,
): void {
  if (persistUnsubs.has(vaultId)) return;

  const debouncedSave = () => {
    const existing = persistTimers.get(vaultId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      persistTimers.delete(vaultId);
      fireSave(vaultId);
    }, PERSIST_DEBOUNCE_MS);
    persistTimers.set(vaultId, t);
  };

  const unsub = store.subscribe((state, prev) => {
    if (
      state.tabs !== prev.tabs ||
      state.activeId !== prev.activeId ||
      state.fileTreeExpanded !== prev.fileTreeExpanded ||
      state.workspaceTree !== prev.workspaceTree ||
      state.activePaneId !== prev.activePaneId
    ) {
      debouncedSave();
    }
  });
  persistUnsubs.set(vaultId, unsub);
}

/** close 시점에 보류 중인 save 를 즉시 flush + subscribe 해제. */
export function detachWorkspacePersist(vaultId: VaultId): void {
  const t = persistTimers.get(vaultId);
  if (t) {
    clearTimeout(t);
    persistTimers.delete(vaultId);
    // 마지막 변경분을 disk 로 — fire-and-forget
    fireSave(vaultId);
  }
  const unsub = persistUnsubs.get(vaultId);
  if (unsub) {
    unsub();
    persistUnsubs.delete(vaultId);
  }
}
