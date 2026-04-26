export interface VaultInfo {
  /** ADR-031: VaultManager가 부여한 UUID v4. */
  id: string;
  name: string;
  root: string;
  fileCount: number;
}

export type FileKind = "file" | "directory";

export interface FileNode {
  path: string;
  name: string;
  kind: FileKind;
  size: number | null;
  modified: number | null;
  children: FileNode[] | null;
}

export interface FileContent {
  content: string;
  modified: number;
  size: number;
}

export interface WriteResult {
  modified: number;
  size: number;
  conflict: boolean;
}

export type VaultErrorType =
  | "NotADirectory"
  | "PathTraversal"
  | "NotOpen"
  | "NotFound"
  | "PermissionDenied"
  | "PermissionRequired"
  | "Io"
  | "InvalidName"
  | "AlreadyExists"
  | "InvalidUtf8";

export interface VaultError {
  type: VaultErrorType;
  message?: string;
}
