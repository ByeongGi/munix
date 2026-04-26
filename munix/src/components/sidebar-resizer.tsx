import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface SidebarResizerProps {
  width: number;
  onWidthChange: (width: number) => void;
  min?: number;
  max?: number;
}

export function SidebarResizer({
  width,
  onWidthChange,
  min = 200,
  max = 500,
}: SidebarResizerProps) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const next = Math.max(min, Math.min(max, startWidth.current + delta));
      onWidthChange(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [min, max, onWidthChange]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className={cn(
        "group relative z-20 w-0 shrink-0 cursor-col-resize bg-transparent",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 -left-2 w-4",
          "bg-transparent",
        )}
      />
      <div
        className={cn(
          "absolute inset-y-3 left-0 w-px -translate-x-1/2 rounded-full",
          "bg-transparent transition-colors",
          "group-hover:bg-[var(--color-border-strong)] group-active:bg-[var(--color-accent)]",
        )}
      />
    </div>
  );
}
