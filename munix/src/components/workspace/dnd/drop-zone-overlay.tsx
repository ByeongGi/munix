import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

interface DropZoneOverlayProps {
  className?: string;
  style: CSSProperties | undefined;
  label: string | null;
}

export function DropZoneOverlay({
  className,
  style,
  label,
}: DropZoneOverlayProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 border border-[var(--color-accent)] bg-[var(--color-accent)]/22",
        className,
      )}
      style={style}
    >
      {label ? (
        <span
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium shadow-lg",
            "bg-[var(--color-accent)] text-[var(--color-text-on-accent)]",
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
