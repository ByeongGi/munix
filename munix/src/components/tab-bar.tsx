import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { X, Plus, AlertTriangle, Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTabStore, type Tab, TAB_SOFT_LIMIT } from "@/store/tab-store";
import { makeTabId } from "@/store/slices/tab-slice";
import { useEditorStore } from "@/store/editor-store";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { cn } from "@/lib/cn";
import {
  getReorderIndex,
  getTabDropTargetIndex,
  getTabHoverSide,
  setTabDragData,
  shouldShowLeftDropIndicator,
  shouldShowRightDropIndicator,
  type TabHoverSide,
} from "@/components/tab/tab-dnd";
import {
  copyTabLink,
  copyTabPath,
  copyTabRelativePath,
  revealTabInFileTree,
  revealTabInSystem,
} from "@/components/tab/tab-actions";
import {
  LEGACY_TAB_DND_MIME,
  TAB_DND_MIME,
  parseTabPayload,
} from "@/lib/dnd-mime";
import {
  PaneActionsButton,
  PaneActionsMenu,
} from "@/components/workspace/pane/pane-context-menu";
import { TabBarShell } from "@/components/tab/tab-bar-shell";
import { TabContextMenu } from "@/components/tab/tab-context-menu";

interface TabBarProps {
  onNewFile: () => void;
}

interface TabContextMenuState {
  x: number;
  y: number;
  tab: Tab;
}

interface PaneMenuState {
  x: number;
  y: number;
}

export function TabBar({ onNewFile }: TabBarProps) {
  const tabs = useTabStore((s) => s.tabs);
  const activeId = useTabStore((s) => s.activeId);
  const activate = useTabStore((s) => s.activate);
  const closeTab = useTabStore((s) => s.closeTab);
  const closeOthers = useTabStore((s) => s.closeOthers);
  const closeTabsAfter = useTabStore((s) => s.closeTabsAfter);
  const closeAll = useTabStore((s) => s.closeAll);
  const togglePinned = useTabStore((s) => s.togglePinned);
  const reorder = useTabStore((s) => s.reorder);
  const status = useEditorStore((s) => s.status);
  const currentPath = useEditorStore((s) => s.currentPath);
  const ws = useActiveWorkspaceStore();
  const activePaneId = useStore(ws, (s) => s.activePaneId);
  const splitPane = useStore(ws, (s) => s.splitPane);
  const closePane = useStore(ws, (s) => s.closePane);
  const movePaneTab = useStore(ws, (s) => s.movePaneTab);
  const vaultId = useVaultDockStore((s) => s.activeVaultId);
  const { t } = useTranslation(["tabs", "common"]);

  const [menu, setMenu] = useState<TabContextMenuState | null>(null);
  const [paneMenu, setPaneMenu] = useState<PaneMenuState | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverSide, setHoverSide] = useState<TabHoverSide>("left");

  const splitTab = (tab: Tab, zone: "right" | "bottom") => {
    splitPane(activePaneId, zone, {
      ...tab,
      id: makeTabId(),
    });
  };

  const splitCurrentTab = (zone: "right" | "bottom") => {
    const tab = tabs.find((t) => t.id === activeId);
    splitPane(
      activePaneId,
      zone,
      tab
        ? {
            ...tab,
            id: makeTabId(),
          }
        : undefined,
    );
  };

  useEffect(() => {
    if (!menu && !paneMenu) return;
    const close = () => {
      setMenu(null);
      setPaneMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close, { once: true });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu, paneMenu]);

  if (tabs.length === 0) {
    return (
      <TabBarShell>
        <div
          className={cn(
            "relative flex h-8 min-w-24 max-w-44 flex-[1_1_9rem] cursor-default select-none items-center gap-1.5 rounded-t-md border border-b-0 px-2 text-xs",
            "border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]",
          )}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({
              x: e.clientX,
              y: e.clientY,
              tab: { id: "__empty-tab__", path: "", title: "" },
            });
          }}
        >
          <span className="min-w-0 flex-1 truncate">
            {t("tabs:emptyTab.title")}
          </span>
          <button
            type="button"
            onClick={closeAll}
            className="flex h-4 w-4 items-center justify-center rounded hover:bg-[var(--color-bg-hover)]"
            aria-label={t("tabs:aria.closeTab")}
          >
            <X className="h-3 w-3" />
          </button>
          <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-md bg-[var(--color-accent)]" />
        </div>
        <button
          type="button"
          onClick={onNewFile}
          className={cn(
            "ml-1 flex h-6 w-6 items-center justify-center rounded",
            "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]",
          )}
          aria-label={t("tabs:aria.newTab")}
          title={t("tabs:tooltip.newTab")}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <PaneActionsButton
          label={t("tabs:paneMenu.label")}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setPaneMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
        />
        {paneMenu && (
          <PaneActionsMenu
            x={paneMenu.x}
            y={paneMenu.y}
            t={t}
            onSplitRight={() => {
              splitCurrentTab("right");
              setPaneMenu(null);
            }}
            onSplitDown={() => {
              splitCurrentTab("bottom");
              setPaneMenu(null);
            }}
            onClosePane={() => {
              if (activePaneId) closePane(activePaneId);
              else closeAll();
              setPaneMenu(null);
            }}
          />
        )}
      </TabBarShell>
    );
  }

  const isDirty = (tab: Tab): boolean => {
    if (tab.path !== currentPath) return false;
    return (
      status.kind === "dirty" ||
      status.kind === "saving" ||
      status.kind === "conflict"
    );
  };

  return (
    <>
      <TabBarShell>
        <div className="flex min-w-0 flex-1 items-end gap-px overflow-x-auto">
          {tabs.map((tab, index) => {
            const active = tab.id === activeId;
            const dirty = isDirty(tab);
            const isHovered = dragIndex !== null && hoverIndex === index;
            const showLeftIndicator = shouldShowLeftDropIndicator({
              isHovered,
              hoverSide,
              dragIndex,
              index,
            });
            const showRightIndicator = shouldShowRightDropIndicator({
              isHovered,
              hoverSide,
              dragIndex,
              index,
            });
            return (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => {
                  setTabDragData({
                    dataTransfer: e.dataTransfer,
                    index,
                    vaultId: vaultId ?? null,
                    tabId: tab.id,
                    fromPaneId: activePaneId,
                    path: tab.path,
                  });
                  setDragIndex(index);
                }}
                onDragOver={(e) => {
                  const types = e.dataTransfer.types;
                  if (
                    !types.includes(LEGACY_TAB_DND_MIME) &&
                    !types.includes(TAB_DND_MIME)
                  )
                    return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = (
                    e.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  const side = getTabHoverSide(rect, e.clientX);
                  if (hoverIndex !== index) setHoverIndex(index);
                  if (hoverSide !== side) setHoverSide(side);
                }}
                onDragLeave={() => {
                  if (hoverIndex === index) setHoverIndex(null);
                }}
                onDrop={(e) => {
                  const types = e.dataTransfer.types;
                  // cross-pane payload 우선 — 다른 pane 에서 끌어왔는지 확인.
                  if (types.includes(TAB_DND_MIME)) {
                    const payload = parseTabPayload(
                      e.dataTransfer.getData(TAB_DND_MIME),
                    );
                    if (
                      payload &&
                      activePaneId &&
                      payload.fromPaneId &&
                      payload.fromPaneId !== activePaneId
                    ) {
                      e.preventDefault();
                      const targetIdx = getTabDropTargetIndex(
                        index,
                        hoverSide,
                      );
                      movePaneTab(
                        payload.fromPaneId,
                        payload.tabId,
                        activePaneId,
                        targetIdx,
                      );
                      setDragIndex(null);
                      setHoverIndex(null);
                      return;
                    }
                  }
                  // 같은 pane 안 reorder.
                  if (!types.includes(LEGACY_TAB_DND_MIME)) return;
                  e.preventDefault();
                  const from = parseInt(
                    e.dataTransfer.getData(LEGACY_TAB_DND_MIME),
                    10,
                  );
                  if (!Number.isNaN(from)) {
                    const targetIdx = getTabDropTargetIndex(index, hoverSide);
                    const adjusted = getReorderIndex(from, targetIdx);
                    if (adjusted !== from) reorder(from, adjusted);
                  }
                  setDragIndex(null);
                  setHoverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setHoverIndex(null);
                }}
                onClick={() => activate(tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu({ x: e.clientX, y: e.clientY, tab });
                }}
                className={cn(
                  "group relative flex h-8 min-w-24 max-w-44 flex-[1_1_9rem] cursor-default select-none items-center gap-1.5 rounded-t-md border border-b-0 px-2 text-xs",
                  "border-[var(--color-border-primary)]",
                  active
                    ? "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
                  dragIndex === index && "opacity-40",
                )}
                title={tab.path || t("tabs:emptyTab.title")}
              >
                {showLeftIndicator && (
                  <span className="absolute -left-px top-0 h-full w-[2px] bg-[var(--color-accent)]" />
                )}
                {showRightIndicator && (
                  <span className="absolute -right-px top-0 h-full w-[2px] bg-[var(--color-accent)]" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {tab.pinned && (
                    <Pin className="mr-1 inline h-3 w-3 text-[var(--color-accent)]" />
                  )}
                  {tab.path
                    ? (tab.titleDraft ?? tab.title)
                    : t("tabs:emptyTab.title")}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded",
                    "hover:bg-[var(--color-bg-hover)]",
                  )}
                  aria-label={t("tabs:aria.closeTab")}
                >
                  {dirty ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-primary)] group-hover:hidden" />
                  ) : null}
                  <X
                    className={cn(
                      "h-3 w-3",
                      dirty ? "hidden group-hover:block" : "",
                    )}
                  />
                </button>
                {active && (
                  <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-md bg-[var(--color-accent)]" />
                )}
              </div>
            );
          })}
        </div>
        {tabs.length > TAB_SOFT_LIMIT && (
          <span
            className={cn(
              "ml-2 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
              "bg-[var(--color-warning-muted)] text-[var(--color-warning)]",
            )}
            title={t("tabs:softLimit.tooltip", {
              limit: TAB_SOFT_LIMIT,
              count: tabs.length,
            })}
          >
            <AlertTriangle className="h-3 w-3" />
            {tabs.length}/{TAB_SOFT_LIMIT}
          </span>
        )}
        <button
          type="button"
          onClick={onNewFile}
          className={cn(
            "ml-1 flex h-6 w-6 items-center justify-center rounded",
            "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]",
          )}
          aria-label={t("tabs:aria.newTab")}
          title={t("tabs:tooltip.newTab")}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <PaneActionsButton
          label={t("tabs:paneMenu.label")}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setPaneMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
        />
      </TabBarShell>

      {menu && (
        <TabContextMenu
          x={menu.x}
          y={menu.y}
          tab={menu.tab}
          t={t}
          onClose={() => {
            if (menu.tab.id === "__empty-tab__") closeAll();
            else closeTab(menu.tab.id);
            setMenu(null);
          }}
          onCloseOthers={() => {
            closeOthers(menu.tab.id);
            setMenu(null);
          }}
          onCloseTabsAfter={() => {
            closeTabsAfter(menu.tab.id);
            setMenu(null);
          }}
          onTogglePinned={() => {
            togglePinned(menu.tab.id);
            setMenu(null);
          }}
          onCopyLink={() => {
            void copyTabLink(menu.tab);
            setMenu(null);
          }}
          onCopyPath={() => {
            void copyTabPath(menu.tab);
            setMenu(null);
          }}
          onCopyRelativePath={() => {
            void copyTabRelativePath(menu.tab);
            setMenu(null);
          }}
          onRevealInFileTree={() => {
            revealTabInFileTree(menu.tab);
            setMenu(null);
          }}
          onRevealInSystem={() => {
            void revealTabInSystem(menu.tab);
            setMenu(null);
          }}
          onSplitRight={() => {
            splitTab(menu.tab, "right");
            setMenu(null);
          }}
          onSplitDown={() => {
            splitTab(menu.tab, "bottom");
            setMenu(null);
          }}
          onCloseAll={() => {
            closeAll();
            setMenu(null);
          }}
        />
      )}
      {paneMenu && (
        <PaneActionsMenu
          x={paneMenu.x}
          y={paneMenu.y}
          t={t}
          onSplitRight={() => {
            splitCurrentTab("right");
            setPaneMenu(null);
          }}
          onSplitDown={() => {
            splitCurrentTab("bottom");
            setPaneMenu(null);
          }}
          onClosePane={() => {
            if (activePaneId) closePane(activePaneId);
            else closeAll();
            setPaneMenu(null);
          }}
        />
      )}
    </>
  );
}
