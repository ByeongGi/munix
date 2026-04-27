import { useEffect, useRef } from "react";
import { Loader2, RefreshCw, Search, Regex } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchStore } from "@/store/search-store";
import { useVaultStore } from "@/store/vault-store";
import type { SearchHit } from "@/lib/search-index";
import { cn } from "@/lib/cn";
import { SearchResultsGrouped } from "@/components/search-results-grouped";

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

      <SearchResultsGrouped
        results={results}
        query={query}
        onSelect={onSelect}
      />
    </div>
  );
}
