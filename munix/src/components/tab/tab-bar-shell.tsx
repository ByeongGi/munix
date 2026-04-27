import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface TabBarShellProps {
  children: ReactNode;
}

export function TabBarShell({ children }: TabBarShellProps) {
  return (
    <div
      data-no-edge-drop="true"
      className={cn(
        "flex h-10 shrink-0 items-center gap-0 border-b pl-2 pr-1",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] shadow-[inset_0_-1px_0_var(--color-accent-muted)]",
      )}
    >
      {children}
    </div>
  );
}
