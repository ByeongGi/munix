import { useEffect, useMemo, useRef } from "react";
import { Loader2, RefreshCw, FileText, Search, Regex } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchStore } from "@/store/search-store";
import { useVaultStore } from "@/store/vault-store";
import type { SearchHit } from "@/lib/search-index";
import { cn } from "@/lib/cn";

function parentDirOf(path: string, rootLabel: string): string {
  const idx = path.lastIndexOf("/");
  return idx < 0 ? rootLabel : path.slice(0, idx);
}

interface SearchPanelProps {
  onSelect: (hit: SearchHit, query: string) => void;
}

export function SearchPanel({ onSelect }: SearchPanelProps) {
  const info = useVaultStore((s) => s.info);
  const files = useVaultStore((s) => s.files);
  const status = useSearchStore((s) => s.status);
  const error = useSearchStore((s) => s.error);
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const builtFor = useSearchStore((s) => s.builtFor);
  const buildIndex = useSearchStore((s) => s.buildIndex);
  const setQuery = useSearchStore((s) => s.setQuery);
  const useRegex = useSearchStore((s) => s.useRegex);
  const regexError = useSearchStore((s) => s.regexError);
  const setUseRegex = useSearchStore((s) => s.setUseRegex);
  const { t } = useTranslation(["search", "common"]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!info) return;
    if (builtFor === info.root && status === "ready") return;
    if (status === "building") return;
    void buildIndex(info.root, files);
  }, [info, files, builtFor, status, buildIndex]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            useRegex
              ? t("search:placeholder.regex")
              : t("search:placeholder.normal")
          }
          spellCheck={!useRegex}
          className={cn(
            "flex-1 bg-transparent text-sm outline-none",
            "placeholder:text-[var(--color-text-tertiary)]",
            useRegex && "font-mono",
          )}
        />
        <button
          type="button"
          onClick={() => setUseRegex(!useRegex)}
          aria-label={t("search:regex.ariaToggle")}
          aria-pressed={useRegex}
          title={
            useRegex ? t("search:regex.titleOn") : t("search:regex.titleOff")
          }
          className={cn(
            "rounded p-1",
            useRegex
              ? "bg-[var(--color-accent)] text-[var(--color-text-on-accent)]"
              : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]",
          )}
        >
          <Regex className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-1 hover:bg-[var(--color-bg-hover)]"
          onClick={() => info && void buildIndex(info.root, files)}
          aria-label={t("search:index.rebuildAria")}
          disabled={status === "building"}
        >
          {status === "building" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
          )}
        </button>
      </div>

      <div className="border-b border-[var(--color-border-primary)] px-3 pb-2 text-xs text-[var(--color-text-tertiary)]">
        {status === "building" && t("search:index.building")}
        {status === "ready" &&
          regexError == null &&
          (query
            ? t("search:result.count", { count: results.length })
            : t("search:result.empty"))}
        {regexError && (
          <span className="text-[var(--color-danger)]">
            {t("search:regex.error", { message: regexError })}
          </span>
        )}
        {status === "error" && (
          <span className="text-[var(--color-danger)]">
            {t("search:status.errorPrefix", {
              message: error ?? t("search:status.unknownError"),
            })}
          </span>
        )}
      </div>

      <ResultsGrouped results={results} query={query} onSelect={onSelect} />
    </div>
  );
}

function ResultsGrouped({
  results,
  query,
  onSelect,
}: {
  results: SearchHit[];
  query: string;
  onSelect: (hit: SearchHit, query: string) => void;
}) {
  const { t } = useTranslation(["search", "common"]);
  const rootLabel = t("search:group.root");
  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of results) {
      const parent = parentDirOf(hit.path, rootLabel);
      const arr = map.get(parent) ?? [];
      arr.push(hit);
      map.set(parent, arr);
    }
    // 첫 매치 등장 순 보존을 위해 Map 삽입 순서 그대로 사용.
    return Array.from(map.entries());
  }, [results, rootLabel]);

  return (
    <ul className="munix-sidebar-scroll flex-1 overflow-y-auto">
      {grouped.map(([parent, hits]) => (
        <li key={parent}>
          <div
            className={cn(
              "sticky top-0 z-10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide",
              "bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]",
              "border-b border-[var(--color-border-secondary)]",
            )}
            title={parent}
          >
            <span className="truncate">📁 {parent}</span>
            <span className="ml-1 text-[var(--color-text-disabled)]">
              · {t("search:group.count", { count: hits.length })}
            </span>
          </div>
          <ul>
            {hits.map((hit) => (
              <li key={hit.path}>
                <button
                  type="button"
                  onClick={() => onSelect(hit, query)}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b px-3 py-2 text-left",
                    "border-[var(--color-border-secondary)]",
                    "hover:bg-[var(--color-bg-hover)]",
                  )}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
                    <span className="truncate font-medium">{hit.title}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-tertiary)] line-clamp-2">
                    <Highlight text={hit.snippet} query={query} />
                  </div>
                  <div className="text-[10px] text-[var(--color-text-disabled)]">
                    {hit.path} · Line {hit.matchedLine}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-[var(--color-warning-mark)] text-[var(--color-text-primary)]">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
