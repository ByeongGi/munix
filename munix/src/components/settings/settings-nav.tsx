import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import type { SettingsSectionId } from "./settings-types";

export interface SettingsNavItem {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
}

export function NavGroupLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-2 pb-1 pt-1 text-[10px] font-mono uppercase tracking-wide",
        "text-[var(--color-text-tertiary)]",
        className,
      )}
    >
      {label}
    </div>
  );
}

export function SettingsNavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded px-2 text-sm",
        active
          ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
