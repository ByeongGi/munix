import { Plus } from "lucide-react";

import { cn } from "@/lib/cn";

interface NewTabButtonProps {
  label: string;
  tooltip: string;
  onClick: () => void;
}

export function NewTabButton({ label, tooltip, onClick }: NewTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "ml-1 flex h-6 w-6 items-center justify-center rounded",
        "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]",
      )}
      aria-label={label}
      title={tooltip}
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  );
}
