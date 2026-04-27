import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { SidebarTab } from "@/components/app-shell/types";

interface UseFileTreeRevealParams {
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setSidebarTab: Dispatch<SetStateAction<SidebarTab>>;
}

export function useFileTreeReveal({
  setSidebarCollapsed,
  setSidebarTab,
}: UseFileTreeRevealParams) {
  const [revealPath, setRevealPath] = useState<string | null>(null);

  useEffect(() => {
    const onReveal = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string }>).detail;
      if (!detail?.path) return;
      setSidebarCollapsed(false);
      setSidebarTab("files");
      setRevealPath(detail.path);
    };
    window.addEventListener("munix:reveal-file-tree", onReveal);
    return () => {
      window.removeEventListener("munix:reveal-file-tree", onReveal);
    };
  }, [setSidebarCollapsed, setSidebarTab]);

  return revealPath;
}
