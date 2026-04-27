import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/cn";

interface SidebarTabButtonProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  active?: boolean;
  onClick: () => void;
}

export function SidebarTabButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: SidebarTabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-sidebar-item-selected text-sidebar-text shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.08)]"
          : "text-sidebar-text-muted hover:bg-sidebar-item-hovered hover:text-sidebar-text",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
