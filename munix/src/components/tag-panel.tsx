import { useEffect, useMemo } from "react";
import { Hash, FileText, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTagStore } from "@/store/tag-store";
import { useVaultStore } from "@/store/vault-store";
import { useTabStore } from "@/store/tab-store";
import { cn } from "@/lib/cn";

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return (i < 0 ? path : path.slice(i + 1)).replace(/\.md$/i, "");
}

export function TagPanel() {
  const { t } = useTranslation(["panels"]);
  const info = useVaultStore((s) => s.info);
  const files = useVaultStore((s) => s.files);
  const index = useTagStore((s) => s.index);
  const status = useTagStore((s) => s.status);
  const builtFor = useTagStore((s) => s.builtFor);
  const selectedTag = useTagStore((s) => s.selectedTag);
  const selectTag = useTagStore((s) => s.selectTag);
  const build = useTagStore((s) => s.build);
  const openTab = useTabStore((s) => s.openTab);

  useEffect(() => {
    if (!info) return;
    if (builtFor === info.root && status === "ready") return;
    if (status === "building") return;
    void build(info.root, files);
  }, [info, files, builtFor, status, build]);

  const tags = useMemo(() => {
    if (status !== "ready") return [];
    return index.tags();
  }, [index, status]);

  const filesOfSelected = useMemo(() => {
    if (!selectedTag || status !== "ready") return [];
    return index.filesOf(selectedTag);
  }, [index, selectedTag, status]);

  if (status === "building") {
    return (
      <div className="px-3 py-4 text-xs text-[var(--color-text-tertiary)]">
        {t("panels:tags.indexing")}
      </div>
    );
  }

  if (selectedTag) {
    return (
      <div>
        <button
          type="button"
          onClick={() => selectTag(null)}
          className="flex w-full items-center gap-1 px-3 py-1.5 text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]"
        >
          <ArrowLeft className="h-3 w-3" /> {t("panels:tags.backToList")}
        </button>
        <div className="flex items-center gap-1 px-3 pb-1.5">
          <Hash className="h-3 w-3 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">{selectedTag}</span>
          <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
            {t("panels:tags.count", { count: filesOfSelected.length })}
          </span>
        </div>
        <ul className="border-t border-[var(--color-border-secondary)]">
          {filesOfSelected.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => openTab(p)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs hover:bg-[var(--color-bg-hover)]"
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

  if (tags.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--color-text-tertiary)]">
        {t("panels:tags.empty")}
      </div>
    );
  }

  return (
    <ul className="py-1">
      {tags.map(({ tag, count }) => (
        <li key={tag}>
          <button
            type="button"
            onClick={() => selectTag(tag)}
            className={cn(
              "flex w-full items-center gap-1 px-3 py-1 text-left text-xs",
              "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
            )}
          >
            <Hash className="h-3 w-3 shrink-0 text-[var(--color-accent)]" />
            <span className="flex-1 truncate">{tag}</span>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {count}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
