import { AlertTriangle } from "lucide-react";
import type { TFunction } from "i18next";

import { cn } from "@/lib/cn";
import { TAB_SOFT_LIMIT } from "@/store/tab-store";

interface TabSoftLimitBadgeProps {
  count: number;
  t: TFunction<["tabs", "common"]>;
}

export function TabSoftLimitBadge({ count, t }: TabSoftLimitBadgeProps) {
  if (count <= TAB_SOFT_LIMIT) return null;

  return (
    <span
      className={cn(
        "ml-2 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
        "bg-[var(--color-warning-muted)] text-[var(--color-warning)]",
      )}
      title={t("tabs:softLimit.tooltip", {
        limit: TAB_SOFT_LIMIT,
        count,
      })}
    >
      <AlertTriangle className="h-3 w-3" />
      {count}/{TAB_SOFT_LIMIT}
    </span>
  );
}
