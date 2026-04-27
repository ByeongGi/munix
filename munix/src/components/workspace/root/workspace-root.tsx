/**
 * WorkspaceRoot — workspace tree 의 최상위 렌더러.
 * (workspace-split-spec §5)
 *
 * `workspaceTree === null` 이면 children 을 그대로 렌더 → 단일 pane 모드.
 * tree 가 있으면 SplitNode/PaneNode 를 재귀 렌더하고, active pane 자리에는
 * children (= 기존 TabBar + EditorView 등) 을 그대로 꽂아 둔다.
 *
 * 비활성 pane 은 자체 TabBar 와 editable editor surface 를 렌더한다. full editor
 * chrome/title/properties 는 active pane 한 곳에만 둔다.
 */

import { useStore } from "zustand";

import { useActiveWorkspaceStore } from "@/lib/active-vault";
import type { WorkspaceNode } from "@/store/workspace-types";

import { Pane } from "../pane/pane";
import { SinglePaneDropTarget } from "./single-pane-drop-target";
import { SplitDivider } from "./split-divider";

interface WorkspaceRootProps {
  /** 단일 pane 모드 또는 active pane 위치에 꽂힐 콘텐츠. */
  children: React.ReactNode;
  onNewFile: () => void;
  onQuickOpen: () => void;
}

export function WorkspaceRoot({
  children,
  onNewFile,
  onQuickOpen,
}: WorkspaceRootProps) {
  const ws = useActiveWorkspaceStore();
  const tree = useStore(ws, (s) => s.workspaceTree);
  const activePaneId = useStore(ws, (s) => s.activePaneId);

  if (tree === null) {
    return <SinglePaneDropTarget>{children}</SinglePaneDropTarget>;
  }

  return (
    <RenderNode
      node={tree}
      activePaneId={activePaneId}
      activeContent={children}
      onNewFile={onNewFile}
      onQuickOpen={onQuickOpen}
    />
  );
}

interface RenderNodeProps {
  node: WorkspaceNode;
  activePaneId: string | null;
  activeContent: React.ReactNode;
  onNewFile: () => void;
  onQuickOpen: () => void;
}

function RenderNode({
  node,
  activePaneId,
  activeContent,
  onNewFile,
  onQuickOpen,
}: RenderNodeProps) {
  if (node.type === "pane") {
    return (
      <Pane
        pane={node}
        isActive={node.id === activePaneId}
        activeContent={activeContent}
        onNewFile={onNewFile}
        onQuickOpen={onQuickOpen}
      />
    );
  }

  const flexClass = node.direction === "row" ? "flex-row" : "flex-col";
  const firstStyle: React.CSSProperties =
    node.direction === "row"
      ? { flexBasis: `${node.ratio * 100}%` }
      : { flexBasis: `${node.ratio * 100}%` };
  const secondStyle: React.CSSProperties =
    node.direction === "row"
      ? { flexBasis: `${(1 - node.ratio) * 100}%` }
      : { flexBasis: `${(1 - node.ratio) * 100}%` };

  return (
    <div className={`flex min-h-0 min-w-0 flex-1 ${flexClass}`}>
      <div className="flex min-h-0 min-w-0 shrink grow" style={firstStyle}>
        <RenderNode
          node={node.first}
          activePaneId={activePaneId}
          activeContent={activeContent}
          onNewFile={onNewFile}
          onQuickOpen={onQuickOpen}
        />
      </div>
      <SplitDivider direction={node.direction} splitId={node.id} />
      <div className="flex min-h-0 min-w-0 shrink grow" style={secondStyle}>
        <RenderNode
          node={node.second}
          activePaneId={activePaneId}
          activeContent={activeContent}
          onNewFile={onNewFile}
          onQuickOpen={onQuickOpen}
        />
      </div>
    </div>
  );
}
