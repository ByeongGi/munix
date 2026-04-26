/**
 * Workspace = vault 1개의 작업 상태 묶음. (ADR-031, multi-vault-spec §6.6)
 *
 * Phase B-α — 골격만 정의. tabs/editor/search/backlink 등은 sub-phase
 * B-γ/B-δ 에서 점진적으로 흡수된다. 지금은 신규 store 인프라만 깔고
 * 기존 글로벌 store들은 그대로 동작한다.
 *
 * 영구화는 Phase B-ε 에서 `.munix/workspace.json` 으로 직렬화 (D2 결정).
 *
 * Workspace Split (workspace-split-spec §13 Phase A) — split tree 골격을
 * 추가한다. 단일 pane 모드일 땐 `workspaceTree === null`, `activePaneId === null`
 * 이고 기존 TabSlice 의 `tabs/activeId` 가 그대로 root pane 역할을 한다.
 */

import type { Tab } from "./slices/tab-slice";
import type { VaultId } from "./vault-types";

/**
 * 한 vault 워크스페이스의 메타 상태. EditorSlice / TabSlice 등은 별도 슬라이스로
 * `workspace-registry.ts` 가 합쳐 둔다.
 *
 * 각 영역 진행 상황:
 * - B-γ part 1: EditorSlice 흡수
 * - B-γ part 2: TabSlice 흡수 (tabs, activeTabId)
 * - B-δ: search snapshot, recent files, tag/backlink derived (인덱스는 별도)
 * - B-ε: persisted = workspace.json 으로 영구화
 */
export interface WorkspaceState {
  vaultId: VaultId;

  fileTreeExpanded?: string[];

  // workspace-split-spec §13 Phase A — split tree.
  // null = 단일 pane 모드 (legacy 호환). split 명령 실행 시 트리가 채워진다.
  workspaceTree: WorkspaceNode | null;
  activePaneId: string | null;

  // B-δ 예약 슬롯
  searchState?: unknown;
  recentFiles?: string[];

  // 마지막 active 시각 (idle vault 인덱스 unload 정책 — multi-vault-spec §12.1)
  lastActiveAt?: number;
}

// ---------------------------------------------------------------------------
// Workspace Split (workspace-split-spec §4)
// ---------------------------------------------------------------------------

export type SplitDirection = "row" | "column";

export type WorkspaceNode = SplitNode | PaneNode;

export interface SplitNode {
  type: "split";
  id: string;
  direction: SplitDirection;
  /** first child 비율, 0.2~0.8 clamp */
  ratio: number;
  first: WorkspaceNode;
  second: WorkspaceNode;
}

export interface PaneNode {
  type: "pane";
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
}

/** drop zone — pane 영역을 5개로 나눈 결과. (spec §6.2) */
export type DropZone = "center" | "left" | "right" | "top" | "bottom";

export function createEmptyWorkspace(vaultId: VaultId): WorkspaceState {
  return {
    vaultId,
    fileTreeExpanded: [],
    workspaceTree: null,
    activePaneId: null,
    searchState: undefined,
    recentFiles: [],
    lastActiveAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tree helpers (workspace-tree-slice 와 마이그레이션 코드에서 공용)
// ---------------------------------------------------------------------------

export function makePaneId(): string {
  return `pane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeSplitId(): string {
  return `split-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isPaneNode(node: WorkspaceNode): node is PaneNode {
  return node.type === "pane";
}

export function isSplitNode(node: WorkspaceNode): node is SplitNode {
  return node.type === "split";
}

/** tree 를 순회해 모든 PaneNode 수집. */
export function collectPanes(node: WorkspaceNode | null): PaneNode[] {
  if (!node) return [];
  if (isPaneNode(node)) return [node];
  return [...collectPanes(node.first), ...collectPanes(node.second)];
}

/** id 로 PaneNode lookup. */
export function findPane(
  node: WorkspaceNode | null,
  paneId: string,
): PaneNode | null {
  if (!node) return null;
  if (isPaneNode(node)) return node.id === paneId ? node : null;
  return findPane(node.first, paneId) ?? findPane(node.second, paneId);
}

/** tree 안 paneId 인 PaneNode 의 일부 필드를 immutable 갱신. */
export function patchPaneInTree(
  node: WorkspaceNode,
  paneId: string,
  patch: Partial<Omit<PaneNode, "type" | "id">>,
): WorkspaceNode {
  if (isPaneNode(node)) {
    return node.id === paneId ? { ...node, ...patch } : node;
  }
  const first = patchPaneInTree(node.first, paneId, patch);
  const second = patchPaneInTree(node.second, paneId, patch);
  if (first === node.first && second === node.second) return node;
  return { ...node, first, second };
}

/** SplitNode 의 ratio 만 immutable 갱신. (workspace-split-spec §8 / Phase D) */
export function patchSplitRatio(
  node: WorkspaceNode,
  splitId: string,
  ratio: number,
): WorkspaceNode {
  if (isSplitNode(node)) {
    if (node.id === splitId) {
      if (node.ratio === ratio) return node;
      return { ...node, ratio };
    }
    const first = patchSplitRatio(node.first, splitId, ratio);
    const second = patchSplitRatio(node.second, splitId, ratio);
    if (first === node.first && second === node.second) return node;
    return { ...node, first, second };
  }
  return node;
}
