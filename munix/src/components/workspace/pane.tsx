/**
 * Pane — split tree 안에서 한 PaneNode 를 그리는 컴포넌트.
 * (workspace-split-spec §5, §6)
 *
 * - active pane: children(=글로벌 TabBar+EditorView) 그대로 렌더. 글로벌
 *   tabs/activeId 와 active pane 의 PaneNode 는 mirror 정책으로 동기 (B.1).
 * - 비활성 pane: 자체 TabBar (paneNode.tabs) + editable editor surface.
 *   탭 클릭 → activatePaneTab → 그 탭이 active 가 됨과 동시에 setActivePane.
 *   pane 영역(탭 외) 클릭 → setActivePane 만.
 *
 * Phase B.3 — outer div 가 spec MIME (`application/munix-tab`) 의 drop target.
 * Phase C — outer dragover 가 mouse 위치를 5 zone (center / left / right /
 * top / bottom) 으로 분류. center → movePaneTab (끝에 추가). edge → splitPaneMove
 * (해당 방향으로 새 분할 + 탭 이동). edge 임계값 25%, center 50%+. TabBar 내부
 * (data-no-edge-drop) 는 항상 center 로 강제 — TabBar 자체 reorder 와 충돌
 * 방지. drop overlay 는 zone 별 시각화.
 *
 * vault 경계 검증 — payload.vaultId 가 현재 vault 와 다르면 drop 거부
 * (workspace-split-spec §6.1 ADR-031).
 */

import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { cn } from "@/lib/cn";
import { makeTabId } from "@/store/slices/tab-slice";
import {
  TAB_DND_MIME,
  parseTabPayload,
} from "@/lib/dnd-mime";
import { useVaultDockStore } from "@/store/vault-dock-store";
import type { DropZone, PaneNode } from "@/store/workspace-types";
import { ipc } from "@/lib/ipc";
import {
  PaneActionsButton,
  PaneActionsMenu,
  TabActionsMenu,
} from "@/components/workspace/pane/pane-context-menu";
import {
  classifyDropZone,
  dropZoneLabelKey,
} from "./drop-zone";
import { EmptyPanePlaceholder } from "./pane/empty-pane-placeholder";
import { InactivePaneEditor } from "./pane/inactive-pane-editor";
import { MiniPaneTabStrip } from "./pane/mini-pane-tab-strip";

interface PaneProps {
  pane: PaneNode;
  isActive: boolean;
  /** active pane 일 때 보여줄 영역 — TabBar + EditorView 등. */
  activeContent: React.ReactNode;
  onNewFile: () => void;
  onQuickOpen: () => void;
}

interface PaneMenuState {
  x: number;
  y: number;
}

interface TabMenuState {
  x: number;
  y: number;
  tabId: string;
}

const PANE_CHROME_SELECTOR =
  "[data-pane-tab],[data-pane-tab-close],[data-pane-tab-new],[data-pane-menu]";

export function Pane({
  pane,
  isActive,
  activeContent,
  onNewFile,
  onQuickOpen,
}: PaneProps) {
  const { t } = useTranslation(["app", "tabs"]);
  const ws = useActiveWorkspaceStore();
  const setActivePane = useStore(ws, (s) => s.setActivePane);
  const activatePaneTab = useStore(ws, (s) => s.activatePaneTab);
  const closePaneTab = useStore(ws, (s) => s.closePaneTab);
  const closeOtherPaneTabs = useStore(ws, (s) => s.closeOtherPaneTabs);
  const closePaneTabsAfter = useStore(ws, (s) => s.closePaneTabsAfter);
  const closeAllPaneTabs = useStore(ws, (s) => s.closeAllPaneTabs);
  const togglePaneTabPinned = useStore(ws, (s) => s.togglePaneTabPinned);
  const closePane = useStore(ws, (s) => s.closePane);
  const createPaneTab = useStore(ws, (s) => s.createPaneTab);
  const splitPane = useStore(ws, (s) => s.splitPane);
  const movePaneTab = useStore(ws, (s) => s.movePaneTab);
  const splitPaneMove = useStore(ws, (s) => s.splitPaneMove);
  const vaultId = useVaultDockStore((s) => s.activeVaultId);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const [paneMenu, setPaneMenu] = useState<PaneMenuState | null>(null);
  const [tabMenu, setTabMenu] = useState<TabMenuState | null>(null);
  const reorderPaneTab = useStore(ws, (s) => s.reorderPaneTab);

  useEffect(() => {
    if (!paneMenu && !tabMenu) return;
    const close = () => {
      setPaneMenu(null);
      setTabMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close, { once: true });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [paneMenu, tabMenu]);

  const splitThisPane = (zone: "right" | "bottom") => {
    const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId);
    splitPane(
      pane.id,
      zone,
      activeTab
        ? {
            ...activeTab,
            id: makeTabId(),
          }
        : undefined,
    );
  };

  const splitPaneTab = (tabId: string, zone: "right" | "bottom") => {
    const tab = pane.tabs.find((t) => t.id === tabId);
    splitPane(
      pane.id,
      zone,
      tab
        ? {
            ...tab,
            id: makeTabId(),
          }
        : undefined,
    );
  };

  const copyTabPath = async (tabId: string) => {
    const tab = pane.tabs.find((t) => t.id === tabId);
    if (!tab?.path) return;
    try {
      const abs = await ipc.absPath(tab.path);
      await ipc.copyText(abs);
    } catch (e) {
      console.error("copy pane tab path failed", e);
    }
  };

  const copyTabRelativePath = async (tabId: string) => {
    const tab = pane.tabs.find((t) => t.id === tabId);
    if (!tab?.path) return;
    try {
      await ipc.copyText(tab.path);
    } catch (e) {
      console.error("copy pane tab relative path failed", e);
    }
  };

  const copyTabLink = async (tabId: string) => {
    const tab = pane.tabs.find((t) => t.id === tabId);
    if (!tab?.path) return;
    try {
      const target = tab.path.replace(/\.md$/i, "");
      await ipc.copyText(`[[${target}]]`);
    } catch (e) {
      console.error("copy pane tab link failed", e);
    }
  };

  const revealInFileTree = (tabId: string) => {
    const tab = pane.tabs.find((t) => t.id === tabId);
    if (!tab?.path) return;
    window.dispatchEvent(
      new CustomEvent("munix:reveal-file-tree", {
        detail: { path: tab.path },
      }),
    );
  };

  const revealTab = async (tabId: string) => {
    const tab = pane.tabs.find((t) => t.id === tabId);
    if (!tab?.path) return;
    try {
      await ipc.revealInSystem(tab.path);
    } catch (e) {
      console.error("reveal pane tab failed", e);
    }
  };

  const computeZone = useCallback((e: React.DragEvent): DropZone => {
    const targetEl = e.target as HTMLElement | null;
    // TabBar / mini TabBar 위에서는 항상 center — TabBar 자체 reorder 와 충돌 방지.
    if (targetEl && targetEl.closest?.("[data-no-edge-drop]")) {
      return "center";
    }
    const rect = e.currentTarget.getBoundingClientRect();
    return classifyDropZone(rect, e.clientX, e.clientY);
  }, []);

  const isTabDragOverPaneContent = useCallback(
    (e: React.DragEvent): boolean => {
      if (!e.dataTransfer.types.includes(TAB_DND_MIME)) return false;
      const targetEl = e.target as HTMLElement | null;
      return !targetEl?.closest?.("[data-no-edge-drop]");
    },
    [],
  );

  const updateDropZone = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const zone = computeZone(e);
      if (zone !== dropZone) setDropZone(zone);
    },
    [computeZone, dropZone],
  );

  const handleOuterDragEnterCapture = useCallback(
    (e: React.DragEvent) => {
      if (!isTabDragOverPaneContent(e)) return;
      e.stopPropagation();
      updateDropZone(e);
    },
    [isTabDragOverPaneContent, updateDropZone],
  );

  const handleOuterDragOverCapture = useCallback(
    (e: React.DragEvent) => {
      if (!isTabDragOverPaneContent(e)) return;
      e.stopPropagation();
      updateDropZone(e);
    },
    [isTabDragOverPaneContent, updateDropZone],
  );

  const handleOuterDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(TAB_DND_MIME)) return;
      updateDropZone(e);
    },
    [updateDropZone],
  );

  const handleOuterDragLeave = useCallback(
    (e: React.DragEvent) => {
      // 자식으로 이동할 때도 dragleave 가 발생 — relatedTarget 이 outer 안이면 무시.
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      if (dropZone !== null) setDropZone(null);
    },
    [dropZone],
  );

  const handleOuterDrop = useCallback(
    (e: React.DragEvent) => {
      const zone = dropZone ?? computeZone(e);
      setDropZone(null);
      if (!e.dataTransfer.types.includes(TAB_DND_MIME)) return;
      const payload = parseTabPayload(e.dataTransfer.getData(TAB_DND_MIME));
      if (!payload) return;
      // vault 경계 검증
      if (payload.vaultId && vaultId && payload.vaultId !== vaultId) return;
      if (!payload.fromPaneId) return; // 단일 pane 모드 페이로드 — 무시

      e.preventDefault();
      e.stopPropagation();

      if (zone === "center") {
        if (payload.fromPaneId === pane.id) return; // 같은 pane center = no-op
        movePaneTab(payload.fromPaneId, payload.tabId, pane.id);
        return;
      }
      // edge drop — 새 분할 생성 + 탭 이동
      splitPaneMove(payload.fromPaneId, payload.tabId, pane.id, zone);
    },
    [dropZone, computeZone, vaultId, pane.id, movePaneTab, splitPaneMove],
  );

  const handleOuterDropCapture = useCallback(
    (e: React.DragEvent) => {
      if (!isTabDragOverPaneContent(e)) return;
      e.stopPropagation();
      handleOuterDrop(e);
    },
    [handleOuterDrop, isTabDragOverPaneContent],
  );

  const overlayClass =
    dropZone === null
      ? null
      : "pointer-events-none absolute z-10 bg-[var(--color-accent)]/22 border border-[var(--color-accent)]";
  const overlayStyle: React.CSSProperties | undefined = (() => {
    if (dropZone === null) return undefined;
    if (dropZone === "center") {
      return { inset: 0 };
    }
    if (dropZone === "left") {
      return { top: 0, bottom: 0, left: 0, width: "50%" };
    }
    if (dropZone === "right") {
      return { top: 0, bottom: 0, right: 0, width: "50%" };
    }
    if (dropZone === "top") {
      return { left: 0, right: 0, top: 0, height: "50%" };
    }
    return { left: 0, right: 0, bottom: 0, height: "50%" };
  })();
  const overlayLabel = dropZone === null ? null : t(dropZoneLabelKey(dropZone));

  if (isActive) {
    return (
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-bg-primary)]",
          "shadow-[inset_0_0_0_1px_var(--color-accent-muted-hover)]",
        )}
        data-pane-id={pane.id}
        data-pane-active="true"
        onDragEnterCapture={handleOuterDragEnterCapture}
        onDragOverCapture={handleOuterDragOverCapture}
        onDropCapture={handleOuterDropCapture}
        onDragOver={handleOuterDragOver}
        onDragLeave={handleOuterDragLeave}
        onDrop={handleOuterDrop}
      >
        {activeContent}
        {overlayClass && (
          <DropZoneOverlay
            className={overlayClass}
            style={overlayStyle}
            label={overlayLabel}
          />
        )}
      </div>
    );
  }

  const onPaneMouseDown = (e: React.MouseEvent) => {
    const clickedPaneChrome = (e.target as HTMLElement).closest(
      PANE_CHROME_SELECTOR,
    );
    if (clickedPaneChrome) {
      return;
    }
    setActivePane(pane.id);
  };

  const tabMenuTab =
    tabMenu === null
      ? null
      : (pane.tabs.find((tab) => tab.id === tabMenu.tabId) ?? null);
  const tabMenuHasPath = Boolean(tabMenuTab?.path);
  const tabMenuPinned = tabMenuTab?.pinned === true;

  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 cursor-pointer flex-col bg-[var(--color-bg-primary)] opacity-[0.92] transition-opacity hover:opacity-100",
        "shadow-[inset_0_0_0_1px_var(--color-border-primary)]",
        dropZone !== null && "opacity-100",
      )}
      data-pane-id={pane.id}
      data-pane-active="false"
      onMouseDown={onPaneMouseDown}
      onDragEnterCapture={handleOuterDragEnterCapture}
      onDragOverCapture={handleOuterDragOverCapture}
      onDropCapture={handleOuterDropCapture}
      onDragOver={handleOuterDragOver}
      onDragLeave={handleOuterDragLeave}
      onDrop={handleOuterDrop}
    >
      <div
        data-no-edge-drop="true"
        className="flex h-10 shrink-0 items-center gap-0 border-b border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] pl-2 pr-1 shadow-[inset_0_-1px_0_var(--color-border-primary)]"
      >
        <MiniPaneTabStrip
          pane={pane}
          vaultId={vaultId ?? null}
          emptyTabTitle={t("tabs:emptyTab.title")}
          newTabLabel={t("tabs:aria.newTab")}
          newTabTooltip={t("tabs:tooltip.newTab")}
          onActivateTab={activatePaneTab}
          onCloseTab={closePaneTab}
          onCreateTab={createPaneTab}
          onReorderTab={reorderPaneTab}
          onOpenTabMenu={setTabMenu}
        />
        <PaneActionsButton
          label={t("tabs:paneMenu.label")}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setPaneMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
        />
      </div>
      {paneMenu && (
        <PaneActionsMenu
          x={paneMenu.x}
          y={paneMenu.y}
          t={t}
          onSplitRight={() => {
            splitThisPane("right");
            setPaneMenu(null);
          }}
          onSplitDown={() => {
            splitThisPane("bottom");
            setPaneMenu(null);
          }}
          onClosePane={() => {
            closePane(pane.id);
            setPaneMenu(null);
          }}
        />
      )}
      {tabMenu && (
        <TabActionsMenu
          x={tabMenu.x}
          y={tabMenu.y}
          t={t}
          onSplitRight={() => {
            splitPaneTab(tabMenu.tabId, "right");
            setTabMenu(null);
          }}
          onSplitDown={() => {
            splitPaneTab(tabMenu.tabId, "bottom");
            setTabMenu(null);
          }}
          onClose={() => {
            closePaneTab(pane.id, tabMenu.tabId);
            setTabMenu(null);
          }}
          onCloseOthers={() => {
            closeOtherPaneTabs(pane.id, tabMenu.tabId);
            setTabMenu(null);
          }}
          onCloseTabsAfter={() => {
            closePaneTabsAfter(pane.id, tabMenu.tabId);
            setTabMenu(null);
          }}
          onTogglePinned={() => {
            togglePaneTabPinned(pane.id, tabMenu.tabId);
            setTabMenu(null);
          }}
          onCopyLink={() => {
            void copyTabLink(tabMenu.tabId);
            setTabMenu(null);
          }}
          onCopyPath={() => {
            void copyTabPath(tabMenu.tabId);
            setTabMenu(null);
          }}
          onCopyRelativePath={() => {
            void copyTabRelativePath(tabMenu.tabId);
            setTabMenu(null);
          }}
          onRevealInFileTree={() => {
            revealInFileTree(tabMenu.tabId);
            setTabMenu(null);
          }}
          onRevealInSystem={() => {
            void revealTab(tabMenu.tabId);
            setTabMenu(null);
          }}
          onCloseAll={() => {
            closeAllPaneTabs(pane.id);
            setTabMenu(null);
          }}
          hasPath={tabMenuHasPath}
          pinned={tabMenuPinned}
        />
      )}
      <InactivePaneBody
        pane={pane}
        onNewFile={onNewFile}
        onQuickOpen={onQuickOpen}
        onClose={() => closePane(pane.id)}
      />
      {overlayClass && (
        <DropZoneOverlay
          className={overlayClass}
          style={overlayStyle}
          label={overlayLabel}
        />
      )}
    </div>
  );
}

function DropZoneOverlay({
  className,
  style,
  label,
}: {
  className: string;
  style: React.CSSProperties | undefined;
  label: string | null;
}) {
  return (
    <div className={className} style={style}>
      {label && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--color-accent)] px-2 py-1 text-xs font-medium text-[var(--color-text-on-accent)] shadow-lg">
          {label}
        </span>
      )}
    </div>
  );
}

function InactivePaneBody({
  pane,
  onNewFile,
  onQuickOpen,
  onClose,
}: {
  pane: PaneNode;
  onNewFile: () => void;
  onQuickOpen: () => void;
  onClose: () => void;
}) {
  const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId);
  if (pane.tabs.length === 0 || activeTab?.path === "") {
    return (
      <EmptyPanePlaceholder
        onNewFile={onNewFile}
        onQuickOpen={onQuickOpen}
        onClose={onClose}
      />
    );
  }

  if (!activeTab?.path) return null;
  return (
    <InactivePaneEditor
      path={activeTab.path}
      titleDraft={activeTab.titleDraft}
    />
  );
}
