import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

export interface WikilinkItem {
  path: string;
  title: string;
}

export interface WikilinkListProps {
  items: WikilinkItem[];
  command: (item: WikilinkItem) => void;
}

export interface WikilinkListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const WikilinkList = forwardRef<WikilinkListHandle, WikilinkListProps>(
  ({ items, command }, ref) => {
    const { t } = useTranslation(["editor"]);
    const [selected, setSelected] = useState(0);
    useEffect(() => setSelected(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelected((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const item = items[selected];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div
          className={cn(
            "rounded-md border p-3 text-xs shadow-lg",
            "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
            "text-[var(--color-text-tertiary)]",
          )}
        >
          {t("editor:wikilink.noMatch")}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "max-h-64 w-64 overflow-y-auto rounded-md border p-1 shadow-lg",
          "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
        )}
      >
        {items.map((item, i) => {
          const active = i === selected;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => command(item)}
              onMouseEnter={() => setSelected(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                active
                  ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)]",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
              <span className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate">{item.title}</span>
                <span className="truncate text-[10px] text-[var(--color-text-tertiary)]">
                  {item.path}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

WikilinkList.displayName = "WikilinkList";
