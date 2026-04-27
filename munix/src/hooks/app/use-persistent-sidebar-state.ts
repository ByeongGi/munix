import { useEffect, useState } from "react";

const SIDEBAR_WIDTH_STORAGE_KEY = "munix:sidebarWidth";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "munix:sidebarCollapsed";
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 600;

export function usePersistentSidebarState() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      if (saved) {
        const width = Number(saved);
        if (
          !Number.isNaN(width) &&
          width >= MIN_SIDEBAR_WIDTH &&
          width <= MAX_SIDEBAR_WIDTH
        ) {
          return width;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    } catch {
      // ignore
    }
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
        sidebarCollapsed ? "true" : "false",
      );
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
  };
}
