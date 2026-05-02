import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "@/lib/tauri-runtime";

interface AppWindowControls {
  close: () => Promise<void>;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  startDragging: () => Promise<void>;
}

const noopWindow: AppWindowControls = {
  close: async () => {},
  minimize: async () => {},
  toggleMaximize: async () => {},
  startDragging: async () => {},
};

export function getAppWindow(): AppWindowControls {
  if (!isTauriRuntime()) return noopWindow;
  return getCurrentWindow();
}
