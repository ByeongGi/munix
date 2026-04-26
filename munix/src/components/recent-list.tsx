import { Clock, FileText } from "lucide-react";
import { useRecentStore } from "@/store/recent-store";
import { useTabStore } from "@/store/tab-store";
import { cn } from "@/lib/cn";

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return (i < 0 ? path : path.slice(i + 1)).replace(/\.md$/i, "");
}

export function RecentList() {
  const paths = useRecentStore((s) => s.paths);
  const openTab = useTabStore((s) => s.openTab);

  if (paths.length === 0) return null;

  return (
    <div className="border-b border-[var(--color-border-secondary)] pb-1">
      <div className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
        <Clock className="h-3 w-3" /> 최근
      </div>
      <ul>
        {paths.slice(0, 5).map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => openTab(p)}
              className={cn(
                "flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs",
                "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
              )}
              title={p}
            >
              <FileText className="h-3 w-3 shrink-0 text-[var(--color-text-tertiary)]" />
              <span className="flex-1 truncate">{basename(p)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
