import { type MouseEvent } from "react";
import { getAppWindow } from "@/lib/tauri-window";

export function handleWindowTitleMouseDown(e: MouseEvent<HTMLElement>): void {
  if (e.button !== 0) return;
  if (e.detail === 2) {
    e.preventDefault();
    void getAppWindow()
      .toggleMaximize()
      .catch(() => undefined);
    return;
  }

  if (e.detail > 2) return;
  e.preventDefault();
  void getAppWindow()
    .startDragging()
    .catch(() => undefined);
}
