/**
 * RecentSlice — vault scope 최근 파일 목록 (LRU, localStorage 영구화).
 * (ADR-031 Phase B-δ: recent-store 마이그레이션)
 *
 * vaultRoot 는 워크스페이스가 vault 1개에 묶이므로 사실상 vault root 와 같다.
 * `setVault` 는 호환성 위해 노출 (legacy 호출 = vault root 변경 시 paths 재로드).
 */

import type { StateCreator } from "zustand";

const KEY_PREFIX = "munix:recent:";
const MAX_RECENT = 20;

export interface RecentState {
  vaultRoot: string | null;
  paths: string[]; // 최신이 맨 앞

  setVault: (root: string | null) => void;
  push: (path: string) => void;
  clear: () => void;
}

export interface RecentSlice {
  recent: RecentState;
}

function readFor(root: string): string[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + root);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT);
  } catch {
    // ignore
  }
  return [];
}

function persistFor(root: string, paths: string[]): void {
  try {
    localStorage.setItem(KEY_PREFIX + root, JSON.stringify(paths));
  } catch {
    // ignore
  }
}

function defaultRecentState(): RecentState {
  return {
    vaultRoot: null,
    paths: [],
    setVault: () => {},
    push: () => {},
    clear: () => {},
  };
}

export function defaultRecentSlice(): RecentSlice {
  return { recent: defaultRecentState() };
}

export const createRecentSlice: StateCreator<
  RecentSlice,
  [],
  [],
  RecentSlice
> = (set, get) => {
  const update = (patch: Partial<RecentState>) =>
    set((s) => ({ recent: { ...s.recent, ...patch } }));

  return {
    recent: {
      vaultRoot: null,
      paths: [],

      setVault: (root) => {
        if (!root) {
          update({ vaultRoot: null, paths: [] });
          return;
        }
        update({ vaultRoot: root, paths: readFor(root) });
      },

      push: (path) => {
        const { vaultRoot, paths } = get().recent;
        if (!vaultRoot) return;
        const next = [path, ...paths.filter((p) => p !== path)].slice(
          0,
          MAX_RECENT,
        );
        persistFor(vaultRoot, next);
        update({ paths: next });
      },

      clear: () => {
        const { vaultRoot } = get().recent;
        if (vaultRoot) persistFor(vaultRoot, []);
        update({ paths: [] });
      },
    },
  };
};
