import type { FileNode } from "@/types/ipc";

export function parentDir(relPath: string): string {
  const i = relPath.lastIndexOf("/");
  return i < 0 ? "" : relPath.slice(0, i);
}

export function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export function titleFromPath(path: string | null): string {
  if (!path) return "Munix";
  const slashIdx = path.lastIndexOf("/");
  const name = slashIdx < 0 ? path : path.slice(slashIdx + 1);
  return name.replace(/\.md$/i, "");
}

export function getMoveTarget(
  fromPath: string,
  toFolderPath: string,
): {
  name: string;
  newRel: string;
} {
  const slashIdx = fromPath.lastIndexOf("/");
  const name = slashIdx < 0 ? fromPath : fromPath.slice(slashIdx + 1);
  const newRel = toFolderPath ? `${toFolderPath}/${name}` : name;
  return { name, newRel };
}

export function isMoveIntoOwnDescendant(
  fromPath: string,
  toFolderPath: string,
): boolean {
  return toFolderPath === fromPath || toFolderPath.startsWith(`${fromPath}/`);
}

export function dedupeNestedPaths(paths: string[]): string[] {
  const sorted = [...new Set(paths)].sort((a, b) => a.length - b.length);
  const result: string[] = [];
  for (const path of sorted) {
    if (result.some((parent) => path.startsWith(`${parent}/`))) continue;
    result.push(path);
  }
  return result;
}

export function findNodeByPath(
  nodes: FileNode[],
  path: string,
): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function uniqueName(
  files: FileNode[],
  parent: string,
  base: string,
  ext: string,
): string {
  const existing = new Set<string>();
  const collect = (nodes: FileNode[]) => {
    for (const n of nodes) {
      if (parentDir(n.path) === parent) existing.add(n.name);
      if (n.children) collect(n.children);
    }
  };
  collect(files);

  let name = `${base}${ext}`;
  let i = 2;
  while (existing.has(name)) {
    name = `${base} ${i}${ext}`;
    i += 1;
  }
  return name;
}
