import { useTranslation } from "react-i18next";
import { MoreHorizontal, Plus, Search } from "lucide-react";

import { iconButton } from "@/lib/ui-variants";
import { startWindowDrag } from "@/lib/window-drag";

export function WorkspaceHeader({
  title,
  subtitle,
  onQuickOpen,
  onNewFile,
}: {
  title: string;
  subtitle: string;
  onQuickOpen: () => void;
  onNewFile: () => void;
}) {
  const { t } = useTranslation("app");

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-workspace px-3"
      data-tauri-drag-region
      onMouseDown={startWindowDrag}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
        <span className="min-w-0 truncate font-medium text-text">{title}</span>
        <span className="shrink-0 text-text-subtle">{subtitle}</span>
      </div>
      <div
        className="flex shrink-0 items-center gap-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onQuickOpen}
          title={t("workspace.quickOpen")}
          aria-label={t("workspace.quickOpen")}
          className={iconButton({ size: "sm" })}
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onNewFile}
          title={t("header.newFile")}
          aria-label={t("header.newFile")}
          className={iconButton({ size: "sm" })}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={t("workspace.more")}
          aria-label={t("workspace.more")}
          className={iconButton({ size: "sm" })}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
