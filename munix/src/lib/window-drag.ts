import { type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function startWindowDrag(e: MouseEvent<HTMLElement>): void {
  if (e.button !== 0) return;
  e.preventDefault();
  void getCurrentWindow()
    .startDragging()
    .catch(() => undefined);
}
