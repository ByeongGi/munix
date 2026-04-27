import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";

import { cn } from "@/lib/cn";
import type { SearchHit } from "@/lib/search-index";

function parentDirOf(path: string, rootLabel: string): string {
  const idx = path.lastIndexOf("/");
  return idx < 0 ? rootLabel : path.slice(0, idx);
}

export function SearchResultsGrouped({
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
                    <SearchHighlight text={hit.snippet} query={query} />
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

function SearchHighlight({ text, query }: { text: string; query: string }) {
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
