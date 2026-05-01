import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ModalShellProps {
  children: ReactNode;
  labelledBy?: string;
  onClose?: () => void;
  className?: string;
  panelClassName?: string;
}

export function ModalShell({
  children,
  labelledBy,
  onClose,
  className,
  panelClassName,
}: ModalShellProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        className,
      )}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative rounded-lg border shadow-2xl",
          "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
