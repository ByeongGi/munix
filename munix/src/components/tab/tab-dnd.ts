export type TabHoverSide = "left" | "right";

export function getTabHoverSide(rect: DOMRect, clientX: number): TabHoverSide {
  return clientX - rect.left < rect.width / 2 ? "left" : "right";
}

export function getTabDropTargetIndex(
  targetIndex: number,
  hoverSide: TabHoverSide,
): number {
  return hoverSide === "left" ? targetIndex : targetIndex + 1;
}

export function getReorderIndex(
  fromIndex: number,
  targetIndex: number,
): number {
  return fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
}

export function shouldShowLeftDropIndicator({
  isHovered,
  hoverSide,
  dragIndex,
  index,
}: {
  isHovered: boolean;
  hoverSide: TabHoverSide;
  dragIndex: number | null;
  index: number;
}): boolean {
  return (
    isHovered &&
    hoverSide === "left" &&
    dragIndex !== index &&
    dragIndex !== index - 1
  );
}

export function shouldShowRightDropIndicator({
  isHovered,
  hoverSide,
  dragIndex,
  index,
}: {
  isHovered: boolean;
  hoverSide: TabHoverSide;
  dragIndex: number | null;
  index: number;
}): boolean {
  return (
    isHovered &&
    hoverSide === "right" &&
    dragIndex !== index &&
    dragIndex !== index + 1
  );
}
