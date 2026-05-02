import { useTranslation } from "react-i18next";
import { Search, TerminalIcon } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { handleWindowTitleMouseDown } from "@/lib/window-drag";

export function WorkspaceHeader({
  title,
  subtitle,
  onQuickOpen,
  onOpenTerminal,
}: {
  title: string;
  subtitle: string;
  onQuickOpen: () => void;
  onOpenTerminal: () => void;
}) {
  const { t } = useTranslation("app");

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-workspace px-3"
      data-tauri-drag-region
      onMouseDown={handleWindowTitleMouseDown}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
        <span className="min-w-0 truncate font-medium text-text">{title}</span>
        <span className="shrink-0 text-text-subtle">{subtitle}</span>
      </div>
      <div
        className="flex shrink-0 items-center gap-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <IconButton
          onClick={onQuickOpen}
          label={t("workspace.quickOpen")}
          size="sm"
          icon={<Search className="h-3.5 w-3.5" />}
        />
        <IconButton
          onClick={onOpenTerminal}
          label={t("terminal.toggle")}
          size="sm"
          icon={<TerminalIcon className="h-3.5 w-3.5" />}
        />
      </div>
    </div>
  );
}
