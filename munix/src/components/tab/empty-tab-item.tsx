import type { MouseEvent } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

interface EmptyTabItemProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
}

export function EmptyTabItem({
  title,
  closeLabel,
  onClose,
  onContextMenu,
}: EmptyTabItemProps) {
  return (
    <div
      className={cn(
        "relative flex h-8 min-w-24 max-w-44 flex-[1_1_9rem] cursor-default select-none items-center gap-1.5 rounded-t-md border border-b-0 px-2 text-xs",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]",
      )}
      onContextMenu={onContextMenu}
    >
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <button
        type="button"
        onClick={onClose}
        className="flex h-4 w-4 items-center justify-center rounded hover:bg-[var(--color-bg-hover)]"
        aria-label={closeLabel}
      >
        <X className="h-3 w-3" />
      </button>
      <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-md bg-[var(--color-accent)]" />
    </div>
  );
}
