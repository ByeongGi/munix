import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/cn";
import { iconButton } from "@/lib/ui-variants";
import { startWindowDrag } from "@/lib/window-drag";

function WindowControl({
  label,
  className,
  onClick,
}: {
  label: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={cn(
        "h-3 w-3 rounded-full border border-[var(--color-window-control-border)]",
        "shadow-[inset_0_0_0_0.5px_rgb(255_255_255_/_0.22)]",
        "transition duration-100 brightness-100 hover:brightness-110 active:brightness-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40",
        className,
      )}
    />
  );
}

type AppTitleBarProps =
  | {
      variant: "full";
    }
  | {
      variant: "workspace";
      sidebarCollapsed: boolean;
      sidebarWidth: number;
      title: string;
      subtitle: string;
      onToggleSidebar: () => void;
    };

export function AppTitleBar(props: AppTitleBarProps) {
  const { t } = useTranslation("app");
  const win = getCurrentWindow();
  const isWorkspace = props.variant === "workspace";
  const sidebarCollapsed = isWorkspace ? props.sidebarCollapsed : true;
  const sidebarToggleLabel = sidebarCollapsed
    ? t("sidebar.expand")
    : t("sidebar.collapse");
  const isFullWidth = !isWorkspace || sidebarCollapsed;

  return (
    <div
      className={cn(
        "z-30 flex h-9 shrink-0 items-center",
        isFullWidth ? "border-b border-border bg-bg" : "absolute left-0 top-0",
      )}
      style={{
        width: isFullWidth ? "100%" : props.sidebarWidth,
      }}
      title={t("window.drag")}
      data-tauri-drag-region
      onMouseDown={startWindowDrag}
      onDoubleClick={() => void win.toggleMaximize()}
    >
      <div
        className="flex w-[84px] shrink-0 items-center gap-2 px-3.5"
        data-tauri-drag-region
      >
        <WindowControl
          label={t("window.close")}
          className="bg-[var(--color-window-close)]"
          onClick={() => void win.close()}
        />
        <WindowControl
          label={t("window.minimize")}
          className="bg-[var(--color-window-minimize)]"
          onClick={() => void win.minimize()}
        />
        <WindowControl
          label={t("window.maximize")}
          className="bg-[var(--color-window-maximize)]"
          onClick={() => void win.toggleMaximize()}
        />
      </div>
      {isWorkspace ? (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={props.onToggleSidebar}
          title={sidebarToggleLabel}
          aria-label={sidebarToggleLabel}
          className={cn(iconButton({ size: "sm" }), "ml-0.5")}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}
      {isWorkspace && sidebarCollapsed ? (
        <div className="ml-3 flex min-w-0 items-center gap-2 text-xs">
          <span className="max-w-[34vw] truncate font-medium text-text">
            {props.title}
          </span>
          <span className="max-w-40 truncate text-text-subtle">
            {props.subtitle}
          </span>
        </div>
      ) : null}
      <div className="h-full flex-1" data-tauri-drag-region />
    </div>
  );
}
