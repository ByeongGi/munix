import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Search } from "lucide-react";
import { useSearchStore } from "@/store/search-store";
import { useVaultStore } from "@/store/vault-store";
import { useTabStore } from "@/store/tab-store";
import { useRecentStore } from "@/store/recent-store";
import type { SearchHit } from "@/lib/search-index";
import { cn } from "@/lib/cn";
import { CommandDialog } from "@/components/ui/command-dialog";

interface QuickOpenProps {
  open: boolean;
  onClose: () => void;
}

export function QuickOpen({ open, onClose }: QuickOpenProps) {
  const { t } = useTranslation(["palette", "common"]);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const info = useVaultStore((s) => s.info);
  const files = useVaultStore((s) => s.files);
  const index = useSearchStore((s) => s.index);
  const status = useSearchStore((s) => s.status);
  const buildIndex = useSearchStore((s) => s.buildIndex);
  const openTab = useTabStore((s) => s.openTab);
  const promoteActiveEmptyTab = useTabStore((s) => s.promoteActiveEmptyTab);
  const recentPaths = useRecentStore((s) => s.paths);

  // 팔레트 열리면 인덱스 준비 확인
  useEffect(() => {
    if (!open || !info) return;
    if (status === "idle") void buildIndex(info.root, files);
  }, [open, info, files, status, buildIndex]);

  // 열릴 때마다 리셋
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open]);

  const results = useMemo<SearchHit[]>(() => {
    if (status !== "ready") return [];
    if (!query.trim()) {
      // 빈 쿼리: 최근 파일 우선, 없으면 전체 알파벳순
      const all = index.searchByTitle("", 100);
      const byPath = new Map(all.map((h) => [h.path, h]));
      const recent = recentPaths
        .map((p) => byPath.get(p))
        .filter((h): h is SearchHit => !!h);
      const rest = all.filter((h) => !recentPaths.includes(h.path));
      return [...recent, ...rest].slice(0, 30);
    }
    return index.searchByTitle(query, 30);
  }, [index, status, query, recentPaths]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[selectedIdx] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx, open]);

  if (!open) return null;

  const handleSelect = (hit: SearchHit) => {
    if (!promoteActiveEmptyTab(hit.path)) {
      openTab(hit.path);
    }
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) setSelectedIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0)
        setSelectedIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[selectedIdx];
      if (hit) handleSelect(hit);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <CommandDialog
      icon={<Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />}
      inputRef={inputRef}
      listRef={listRef}
      value={query}
      placeholder={t("palette:placeholder.fileSearch")}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={onKeyDown}
      onClose={onClose}
      trailing={
        status === "building" ? (
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            {t("palette:empty.indexing")}
          </span>
        ) : null
      }
      footer={
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border-primary)] px-3 py-1.5 text-[10px] text-[var(--color-text-tertiary)]">
          <span>{t("palette:footer.navigate")}</span>
          <span>{t("palette:footer.open")}</span>
          <span>{t("palette:footer.dismiss")}</span>
        </div>
      }
    >
      {results.length === 0 ? (
        <li className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
          {status === "ready"
            ? t("palette:empty.noResults")
            : t("palette:empty.indexNotReady")}
        </li>
      ) : (
        results.map((hit, i) => (
          <li key={hit.path}>
            <button
              type="button"
              onClick={() => handleSelect(hit)}
              onMouseEnter={() => setSelectedIdx(i)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                i === selectedIdx
                  ? "bg-[var(--color-bg-hover)]"
                  : "hover:bg-[var(--color-bg-hover)]",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate">{hit.title}</span>
                <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                  {hit.path}
                </span>
              </div>
            </button>
          </li>
        ))
      )}
    </CommandDialog>
  );
}
