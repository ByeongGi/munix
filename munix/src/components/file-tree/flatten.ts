import type { FileNode } from "@/types/ipc";

export interface FlatNode {
  node: FileNode;
  depth: number;
  parentPath: string | null;
}

export function flatten(
  nodes: FileNode[],
  expanded: Set<string>,
  depth = 0,
  parentPath: string | null = null,
  out: FlatNode[] = [],
): FlatNode[] {
  for (const n of nodes) {
    out.push({ node: n, depth, parentPath });
    if (n.kind === "directory" && expanded.has(n.path) && n.children) {
      flatten(n.children, expanded, depth + 1, n.path, out);
    }
  }
  return out;
}
