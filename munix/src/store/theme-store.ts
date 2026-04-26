import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "munix:theme";

function readPersisted(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // ignore
  }
  return "system";
}

function persist(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // ignore
  }
}

function apply(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", mode);
  }
}

interface ThemeStore {
  mode: ThemeMode;
  set: (mode: ThemeMode) => void;
  cycle: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: readPersisted(),
  set: (mode) => {
    apply(mode);
    persist(mode);
    set({ mode });
  },
  cycle: () => {
    const order: ThemeMode[] = ["system", "light", "dark"];
    const cur = get().mode;
    const next = order[(order.indexOf(cur) + 1) % order.length] ?? "system";
    apply(next);
    persist(next);
    set({ mode: next });
  },
}));

// 앱 로드 즉시 초기 테마 적용
apply(readPersisted());
