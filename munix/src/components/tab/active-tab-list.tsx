import type { MouseEvent } from "react";

import { ActiveTabItem } from "@/components/tab/active-tab-item";
import type { TabDndItemProps } from "@/components/tab/use-tab-dnd-handlers";
import type { Tab } from "@/store/tab-store";

interface ActiveTabListProps {
  tabs: Tab[];
  activeId: string | null;
  emptyTitle: string;
  closeLabel: string;
  isDirty: (tab: Tab) => boolean;
  getTabDndProps: (tab: Tab, index: number) => TabDndItemProps;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>, tab: Tab) => void;
}

export function ActiveTabList({
  tabs,
  activeId,
  emptyTitle,
  closeLabel,
  isDirty,
  getTabDndProps,
  onActivate,
  onClose,
  onContextMenu,
}: ActiveTabListProps) {
  return (
    <div className="flex min-w-0 flex-1 items-end gap-px overflow-x-auto">
      {tabs.map((tab, index) => (
        <ActiveTabItem
          key={tab.id}
          tab={tab}
          active={tab.id === activeId}
          dirty={isDirty(tab)}
          emptyTitle={emptyTitle}
          closeLabel={closeLabel}
          {...getTabDndProps(tab, index)}
          onClick={() => onActivate(tab.id)}
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
              onClose(tab.id);
            }
          }}
          onContextMenu={(event) => onContextMenu(event, tab)}
          onClose={(event) => {
            event.stopPropagation();
            onClose(tab.id);
          }}
        />
      ))}
    </div>
  );
}
