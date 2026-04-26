import type { FileNode } from "@/types/ipc";

export type Action =
  | "new-file"
  | "new-folder"
  | "rename"
  | "delete"
  | "copy-path"
  | "reveal";

export interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode;
  selectedCount?: number;
}

export interface FileListProps {
  files: FileNode[];
  currentPath: string | null;
  onSelect: (relPath: string) => void;
  onAction: (action: Action, node: FileNode) => void;
  onMove: (fromPath: string, toFolderPath: string) => void;
  onDeleteMany: (nodes: FileNode[]) => void;
  onMoveMany: (fromPaths: string[], toFolderPath: string) => void;
  renaming: string | null;
  revealPath: string | null;
  onRenameSubmit: (node: FileNode, newName: string) => void;
  onRenameCancel: () => void;
}

export const DND_MIME = "application/x-munix-path";
