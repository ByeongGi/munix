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

import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { cn } from "@/lib/cn";
import { useVaultDockStore } from "@/store/vault-dock-store";
import type { PaneNode } from "@/store/workspace-types";
import { PaneActionsButton } from "./pane-context-menu";
import { DropZoneOverlay } from "../dnd/drop-zone-overlay";
import { InactivePaneBody } from "./inactive-pane-body";
import { MiniPaneTabStrip } from "./mini-pane-tab-strip";
import { usePaneMenus } from "./use-pane-menus";
import { usePaneDropTarget } from "./use-pane-drop-target";

interface PaneProps {
  pane: PaneNode;
  isActive: boolean;
  /** active pane 일 때 보여줄 영역 — TabBar + EditorView 등. */
  activeContent: React.ReactNode;
  onNewFile: () => void;
  onQuickOpen: () => void;
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
  const reorderPaneTab = useStore(ws, (s) => s.reorderPaneTab);
  const {
    dropZone,
    dropTargetHandlers,
    overlayLabel,
    overlayStyle,
  } = usePaneDropTarget({
    movePaneTab,
    paneId: pane.id,
    splitPaneMove,
    t,
    vaultId: vaultId ?? null,
  });
  const { menus, openPaneMenu, openTabMenu } = usePaneMenus({
    closeAllPaneTabs,
    closeOtherPaneTabs,
    closePane,
    closePaneTab,
    closePaneTabsAfter,
    pane,
    splitPane,
    t,
    togglePaneTabPinned,
  });

  if (isActive) {
    return (
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-bg-primary)]",
          "shadow-[inset_0_0_0_1px_var(--color-accent-muted-hover)]",
        )}
        data-pane-id={pane.id}
        data-pane-active="true"
        {...dropTargetHandlers}
      >
        {activeContent}
        {dropZone !== null ? (
          <DropZoneOverlay
            style={overlayStyle}
            label={overlayLabel}
          />
        ) : null}
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
      {...dropTargetHandlers}
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
          onOpenTabMenu={openTabMenu}
        />
        <PaneActionsButton
          label={t("tabs:paneMenu.label")}
          onClick={openPaneMenu}
        />
      </div>
      {menus}
      <InactivePaneBody
        pane={pane}
        onNewFile={onNewFile}
        onQuickOpen={onQuickOpen}
        onClose={() => closePane(pane.id)}
      />
      {dropZone !== null ? (
        <DropZoneOverlay
          style={overlayStyle}
          label={overlayLabel}
        />
      ) : null}
    </div>
  );
}
