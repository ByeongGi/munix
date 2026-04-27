import { type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function handleWindowTitleMouseDown(e: MouseEvent<HTMLElement>): void {
  if (e.button !== 0) return;
  if (e.detail === 2) {
    e.preventDefault();
    void getCurrentWindow()
      .toggleMaximize()
      .catch(() => undefined);
    return;
  }

  if (e.detail > 2) return;
  e.preventDefault();
  void getCurrentWindow()
    .startDragging()
    .catch(() => undefined);
}
