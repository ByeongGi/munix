/**
 * Workspace 명령 — split/close pane 액션을 명령 팔레트와 키맵 디스패처에서
 * 공유하기 위한 thin wrapper. (workspace-split-spec §10, Phase A)
 *
 * 모두 active vault 의 workspace store 에 위임. vault 가 없으면 no-op.
 */

import type { Tab } from "@/store/slices/tab-slice";
import type { DropZone, PaneNode } from "@/store/workspace-types";
import { useVaultDockStore } from "@/store/vault-dock-store";
import {
  getWorkspaceStore,
  type WorkspaceStore,
} from "@/store/workspace-registry";

type EdgeZone = Exclude<DropZone, "center">;

function makeTabId(): string {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getActiveStore(): WorkspaceStore | null {
  const id = useVaultDockStore.getState().activeVaultId;
  if (!id) return null;
  return getWorkspaceStore(id).getState();
}

/** 현재 active pane 또는 단일 pane 모드의 active tab 을 가져온다. */
function readActiveTab(ws: WorkspaceStore): Tab | undefined {
  if (ws.workspaceTree === null) {
    return ws.tabs.find((t) => t.id === ws.activeId);
  }
  const pane: PaneNode | null = ws.getActivePane();
  if (!pane) return undefined;
  return pane.tabs.find((t) => t.id === pane.activeTabId);
}

export function splitActivePane(zone: EdgeZone): void {
  const ws = getActiveStore();
  if (!ws) return;
  const cur = readActiveTab(ws);
  const initialTab: Tab | undefined = cur
    ? { id: makeTabId(), path: cur.path, title: cur.title }
    : undefined;
  ws.splitPane(ws.activePaneId, zone, initialTab);
}

export function openPathInSplit(path: string, zone: EdgeZone = "right"): void {
  const ws = getActiveStore();
  if (!ws) return;
  const title = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  ws.splitPane(ws.activePaneId, zone, {
    id: makeTabId(),
    path,
    title,
  });
}

export function openPathInActivePane(path: string): void {
  const ws = getActiveStore();
  if (!ws) return;
  if (!ws.promoteActiveEmptyTab(path)) {
    ws.openTab(path);
  }
}

export function closeActivePane(): void {
  const ws = getActiveStore();
  if (!ws) return;
  if (ws.workspaceTree === null) return; // 단일 pane 모드는 no-op
  if (ws.activePaneId) ws.closePane(ws.activePaneId);
}
