/**
 * SplitDivider — pane 사이의 시각적 구분선 + 드래그 리사이즈.
 * (workspace-split-spec §8 / Phase D)
 *
 * - 1px 시각 라인 + 좌우/상하 ±4px hit area (overlay) 로 클릭 영역 확장.
 * - mousedown → 부모 flex 컨테이너 rect 캡처 → mousemove 마다 비율 계산 →
 *   `setSplitRatio(splitId, clamped)` 디스패치 (clamp 0.2~0.8 슬라이스 내부).
 * - persist subscribe 가 workspaceTree 변경을 감지 → 500ms debounce 저장.
 * - 드래그 중 body cursor + selection 비활성화.
 */

import { useStore } from "zustand";

import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { cn } from "@/lib/cn";
import type { SplitDirection } from "@/store/workspace-types";

interface SplitDividerProps {
  direction: SplitDirection;
  splitId: string;
}

export function SplitDivider({ direction, splitId }: SplitDividerProps) {
  const ws = useActiveWorkspaceStore();
  const setSplitRatio = useStore(ws, (s) => s.setSplitRatio);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const onMove = (ev: MouseEvent) => {
      const ratio =
        direction === "row"
          ? (ev.clientX - rect.left) / rect.width
          : (ev.clientY - rect.top) / rect.height;
      setSplitRatio(splitId, ratio);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor =
      direction === "row" ? "col-resize" : "row-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const baseClass =
    direction === "row"
      ? "w-[7px] shrink-0 cursor-col-resize bg-[var(--color-bg-secondary)]"
      : "h-[7px] shrink-0 cursor-row-resize bg-[var(--color-bg-secondary)]";
  const lineClass =
    direction === "row"
      ? "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--color-border-primary)] transition-colors group-hover:bg-[var(--color-accent)]"
      : "absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[var(--color-border-primary)] transition-colors group-hover:bg-[var(--color-accent)]";

  return (
    <div
      className={cn(
        baseClass,
        "group relative transition-colors hover:bg-[var(--color-accent-muted)]",
      )}
      role="separator"
      aria-orientation={direction === "row" ? "vertical" : "horizontal"}
      onMouseDown={onMouseDown}
    >
      <div className={lineClass} />
    </div>
  );
}
