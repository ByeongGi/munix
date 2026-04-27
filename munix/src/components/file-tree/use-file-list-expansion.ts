import { useCallback, useEffect, useState } from "react";

export function useFileListExpansion(revealPath: string | null) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleFolder = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandFolder = useCallback((path: string) => {
    setExpanded((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!revealPath) return;
    const ancestors: string[] = [];
    const parts = revealPath.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      ancestors.push(parts.slice(0, i).join("/"));
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const path of ancestors) next.add(path);
      return next;
    });
  }, [revealPath]);

  return {
    expanded,
    setExpanded,
    toggleFolder,
    expandFolder,
  };
}
