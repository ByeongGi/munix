import type { CSSProperties } from "react";

const VIEWPORT_MARGIN = 8;
const DEFAULT_ESTIMATED_HEIGHT = 320;

interface ContextMenuSurfaceStyleOptions {
  x: number;
  y: number;
  minWidth: number;
  estimatedHeight?: number;
}

export function getContextMenuSurfaceStyle({
  x,
  y,
  minWidth,
  estimatedHeight = DEFAULT_ESTIMATED_HEIGHT,
}: ContextMenuSurfaceStyleOptions): CSSProperties {
  let left = x;
  let top = y;
  let maxHeight = `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`;

  if (typeof window !== "undefined") {
    const maxLeft = Math.max(
      VIEWPORT_MARGIN,
      window.innerWidth - minWidth - VIEWPORT_MARGIN,
    );
    const maxTop = Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight - estimatedHeight - VIEWPORT_MARGIN,
    );

    left = clamp(x, VIEWPORT_MARGIN, maxLeft);
    top = clamp(y, VIEWPORT_MARGIN, maxTop);
    maxHeight = `calc(100vh - ${top + VIEWPORT_MARGIN}px)`;
  }

  return {
    top,
    left,
    minWidth,
    maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
    maxHeight,
    overflowY: "auto",
    backgroundColor: "var(--color-context-menu-bg)",
    opacity: 1,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
