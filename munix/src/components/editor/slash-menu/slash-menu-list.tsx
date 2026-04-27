import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { SlashItem, SlashGroup } from "./commands";
import { SLASH_GROUP_ORDER } from "./commands";
import { cn } from "@/lib/cn";

export interface SlashMenuListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

export interface SlashMenuListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashMenuList = forwardRef<
  SlashMenuListHandle,
  SlashMenuListProps
>(({ items, command }, ref) => {
  const { t } = useTranslation(["editor", "common"]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setSelectedIndex(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [items]);

  useEffect(() => {
    const container = scrollRef.current;
    const el = itemRefs.current[selectedIndex];
    if (!container || !el) return;

    const padding = 8;
    const containerRect = container.getBoundingClientRect();
    const itemRect = el.getBoundingClientRect();

    if (itemRect.top < containerRect.top + padding) {
      container.scrollTop -= containerRect.top + padding - itemRect.top;
      return;
    }

    if (itemRect.bottom > containerRect.bottom - padding) {
      container.scrollTop += itemRect.bottom - (containerRect.bottom - padding);
    }
  }, [selectedIndex]);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  const selectItemOnPointerMove = (
    index: number,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.movementX === 0 && event.movementY === 0) return;
    setSelectedIndex(index);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  // 그룹별로 묶고 SLASH_GROUP_ORDER로 정렬. 각 그룹 내 원래 순서 유지.
  const grouped = useMemo(() => {
    const map = new Map<SlashGroup, { item: SlashItem; flatIndex: number }[]>();
    items.forEach((item, flatIndex) => {
      const arr = map.get(item.group) ?? [];
      arr.push({ item, flatIndex });
      map.set(item.group, arr);
    });
    return SLASH_GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      entries: map.get(g) ?? [],
    }));
  }, [items]);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "rounded-md border p-3 shadow-lg",
          "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
          "text-xs text-[var(--color-text-tertiary)]",
        )}
      >
        {t("editor:slashMenu.noResults")}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        "max-h-80 w-64 overflow-y-auto rounded-md border p-1 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
      )}
    >
      {grouped.map(({ group, entries }) => (
        <div key={group}>
          <div
            className={cn(
              "px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide",
              "text-[var(--color-text-tertiary)]",
            )}
          >
            {t(`editor:slashGroups.${group}`)}
          </div>
          {entries.map(({ item, flatIndex }) => {
            const Icon = item.icon;
            const active = flatIndex === selectedIndex;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[flatIndex] = node;
                }}
                type="button"
                onClick={() => selectItem(flatIndex)}
                onPointerMove={(event) =>
                  selectItemOnPointerMove(flatIndex, event)
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                  active
                    ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">
                  <span className="block">{t(item.titleKey)}</span>
                  <span className="block text-xs text-[var(--color-text-tertiary)]">
                    {t(item.descKey)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

SlashMenuList.displayName = "SlashMenuList";
