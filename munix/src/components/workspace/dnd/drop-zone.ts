import type { DropZone } from "@/store/workspace-types";
import type { CSSProperties } from "react";

export type EdgeZone = Exclude<DropZone, "center">;

/** edge 25% / center 50%+ 임계값 (workspace-split-spec §6.2). */
const EDGE_THRESHOLD = 0.25;

export function classifyDropZone(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): DropZone {
  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;
  const distLeft = relX;
  const distRight = 1 - relX;
  const distTop = relY;
  const distBottom = 1 - relY;
  const minDist = Math.min(distLeft, distRight, distTop, distBottom);
  if (minDist > EDGE_THRESHOLD) return "center";
  if (minDist === distLeft) return "left";
  if (minDist === distRight) return "right";
  if (minDist === distTop) return "top";
  return "bottom";
}

export function dropZoneLabelKey(zone: DropZone): string {
  if (zone === "center") return "tabs:dropZone.moveTab";
  if (zone === "left") return "tabs:dropZone.splitLeft";
  if (zone === "right") return "tabs:dropZone.splitRight";
  if (zone === "top") return "tabs:dropZone.splitTop";
  return "tabs:dropZone.splitBottom";
}

export function toEdgeZone(zone: DropZone): EdgeZone | null {
  return zone === "center" ? null : zone;
}

export function getDropZoneOverlayStyle(zone: DropZone): CSSProperties {
  if (zone === "center") {
    return { inset: 0 };
  }
  if (zone === "left") {
    return { top: 0, bottom: 0, left: 0, width: "50%" };
  }
  if (zone === "right") {
    return { top: 0, bottom: 0, right: 0, width: "50%" };
  }
  if (zone === "top") {
    return { left: 0, right: 0, top: 0, height: "50%" };
  }
  return { left: 0, right: 0, bottom: 0, height: "50%" };
}
