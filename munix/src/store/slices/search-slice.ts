/**
 * SearchSlice — vault scope 검색 인덱스 + 쿼리 상태.
 * (ADR-031 Phase B-δ: search-store 마이그레이션)
 *
 * 충돌 회피용 nested `search` 슬롯 — 호환 wrapper 가 그대로 노출.
 */

import type { StateCreator } from "zustand";

import type { FileNode } from "@/types/ipc";
import { VaultSearchIndex, type SearchHit } from "@/lib/search-index";
import type { VaultId } from "@/store/vault-types";

export type IndexStatus = "idle" | "building" | "ready" | "error";

export interface SearchState {
  index: VaultSearchIndex;
  status: IndexStatus;
  error: string | null;
  query: string;
  results: SearchHit[];
  builtFor: string | null;
  useRegex: boolean;
  regexError: string | null;

  buildIndex: (root: string, files: FileNode[]) => Promise<void>;
  setQuery: (q: string) => void;
  setUseRegex: (v: boolean) => void;
  renamePath: (oldPath: string, newPath: string) => void;
  reset: () => void;
}

export interface SearchSlice {
  search: SearchState;
}

function runSearch(
  index: VaultSearchIndex,
  q: string,
  useRegex: boolean,
): { results: SearchHit[]; regexError: string | null } {
  if (!q.trim()) return { results: [], regexError: null };
  if (useRegex) {
    try {
      return { results: index.searchRegex(q), regexError: null };
    } catch (e) {
      return {
        results: [],
        regexError: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return { results: index.search(q), regexError: null };
}

function defaultSearchState(): SearchState {
  return {
    index: new VaultSearchIndex(),
    status: "idle",
    error: null,
    query: "",
    results: [],
    builtFor: null,
    useRegex: false,
    regexError: null,
    buildIndex: async () => {},
    setQuery: () => {},
    setUseRegex: () => {},
    renamePath: () => {},
    reset: () => {},
  };
}

export function defaultSearchSlice(): SearchSlice {
  return { search: defaultSearchState() };
}

export const createSearchSlice = (
  vaultId: VaultId,
): StateCreator<SearchSlice, [], [], SearchSlice> => (set, get) => {
  const update = (patch: Partial<SearchState>) =>
    set((s) => ({ search: { ...s.search, ...patch } }));

  return {
    search: {
      index: new VaultSearchIndex(),
      status: "idle",
      error: null,
      query: "",
      results: [],
      builtFor: null,
      useRegex: false,
      regexError: null,

      buildIndex: async (root, files) => {
        update({ status: "building", error: null });
        try {
          const idx = new VaultSearchIndex();
          await idx.build(files, vaultId);
          const { query, useRegex } = get().search;
          const { results, regexError } = runSearch(idx, query, useRegex);
          update({
            index: idx,
            status: "ready",
            builtFor: root,
            results,
            regexError,
          });
        } catch (e) {
          update({
            status: "error",
            error: e instanceof Error ? e.message : String(e),
          });
        }
      },

      setQuery: (q) => {
        const { index, status, useRegex } = get().search;
        if (status !== "ready") {
          update({ query: q, results: [], regexError: null });
          return;
        }
        const { results, regexError } = runSearch(index, q, useRegex);
        update({ query: q, results, regexError });
      },

      setUseRegex: (v) => {
        const { index, status, query } = get().search;
        if (status !== "ready") {
          update({ useRegex: v, regexError: null });
          return;
        }
        const { results, regexError } = runSearch(index, query, v);
        update({ useRegex: v, results, regexError });
      },

      renamePath: (oldPath, newPath) => {
        const cur = get().search;
        if (cur.status !== "ready") return;
        cur.index.renameDoc(oldPath, newPath);
        if (cur.query) {
          const { results, regexError } = runSearch(
            cur.index,
            cur.query,
            cur.useRegex,
          );
          update({ results, regexError });
        }
      },

      reset: () => {
        update({
          index: new VaultSearchIndex(),
          status: "idle",
          error: null,
          query: "",
          results: [],
          builtFor: null,
          useRegex: false,
          regexError: null,
        });
      },
    },
  };
};
