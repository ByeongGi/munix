import { invoke } from "@tauri-apps/api/core";
import type {
  FileContent,
  FileNode,
  MarkdownBatchItem,
  MarkdownFileContent,
  VaultInfo,
  WriteResult,
} from "@/types/ipc";

export const ipc = {
  /**
   * vault 오픈. ADR-031 적용 — 응답에 `id` 포함.
   * `setActive` 기본 true: backend의 active vault 어댑터에 등록되어
   * Phase A 동안 `vault_id` 인자 없이 호출하던 다른 IPC가 자동 라우팅됨.
   */
  openVault: (path: string, setActive = true) =>
    invoke<VaultInfo>("open_vault", { path, setActive }),
  closeVault: (vaultId?: string) =>
    invoke<void>("close_vault", { vaultId: vaultId ?? null }),
  getVaultInfo: (vaultId?: string) =>
    invoke<VaultInfo | null>("get_vault_info", { vaultId: vaultId ?? null }),
  /** ADR-031: 현재 열린 모든 vault. Phase B에서 Vault Dock이 사용. */
  listOpenVaults: () => invoke<VaultInfo[]>("list_open_vaults"),
  /** ADR-031: active vault 변경. Phase B에서 Vault Dock이 사용. */
  setActiveVault: (vaultId: string) =>
    invoke<void>("set_active_vault", { vaultId }),
  /** ADR-031 C-2: 경로가 실제 디렉토리로 존재하는지. Welcome history 의 broken 표시용. */
  pathExists: (path: string) => invoke<boolean>("path_exists", { path }),
  defaultSampleVaultPath: () => invoke<string>("default_sample_vault_path"),
  createDir: (path: string) => invoke<string>("create_dir", { path }),
  /** ADR-031 C-6: vault open 전 trust 검사용 (path 기반). */
  isPathTrusted: (path: string) => invoke<boolean>("is_path_trusted", { path }),
  /** ADR-031 C-6: open 전 prompt 에서 사용자 동의 시 trust 등록. */
  trustPath: (path: string) => invoke<void>("trust_path", { path }),

  listFiles: () => invoke<FileNode[]>("list_files"),
  readFile: (relPath: string, vaultId?: string) =>
    invoke<FileContent>("read_file", {
      relPath,
      vaultId: vaultId ?? null,
    }),
  readMarkdownFile: (relPath: string, vaultId?: string) =>
    invoke<MarkdownFileContent>("read_markdown_file", {
      relPath,
      vaultId: vaultId ?? null,
    }),
  readMarkdownBatch: (relPaths: string[], vaultId?: string) =>
    invoke<MarkdownBatchItem[]>("read_markdown_batch", {
      relPaths,
      vaultId: vaultId ?? null,
    }),
  writeFile: (
    relPath: string,
    content: string,
    expectedModified: number | null,
    force = false,
  ) =>
    invoke<WriteResult>("write_file", {
      relPath,
      content,
      expectedModified,
      force,
    }),
  createFile: (relPath: string, content?: string) =>
    invoke<FileNode>("create_file", {
      relPath,
      content: content ?? null,
    }),
  createFolder: (relPath: string) =>
    invoke<FileNode>("create_folder", { relPath }),
  renameEntry: (oldRel: string, newRel: string) =>
    invoke<FileNode>("rename_entry", { oldRel, newRel }),
  deleteEntry: (relPath: string) => invoke<void>("delete_entry", { relPath }),
  saveAsset: (bytes: Uint8Array, ext: string) =>
    invoke<string>("save_asset", { bytes: Array.from(bytes), ext }),
  absPath: (relPath: string) => invoke<string>("abs_path", { relPath }),
  isCurrentVaultTrusted: () => invoke<boolean>("is_current_vault_trusted"),
  trustCurrentVault: () => invoke<void>("trust_current_vault"),
  revealInSystem: (relPath: string) =>
    invoke<void>("reveal_in_system", { relPath }),
  /** 라스터 이미지의 썸네일 절대 경로를 보장하고 반환한다. (frontend는 convertFileSrc로 사용) */
  getThumbnail: (relPath: string) =>
    invoke<string>("get_thumbnail", { relPath }),

  /** Rust app_config_dir/settings.json 의 raw JSON 문자열을 그대로 돌려준다. */
  loadSettings: () => invoke<string>("settings_load"),
  /** raw JSON 문자열을 그대로 Rust로 보낸다. */
  saveSettings: (json: string) => invoke<void>("settings_save", { json }),
  copyText: (text: string) => invoke<void>("copy_text", { text }),
  /** `.obsidian/types.json` 읽기 — ADR-028. 알려지지 않은 타입 문자열 포함 가능 (TS에서 필터링). */
  loadPropertyTypes: () =>
    invoke<Record<string, string>>("load_property_types"),
  /** `.obsidian/types.json` 쓰기. self-write watcher suppression 적용됨. */
  savePropertyTypes: (types: Record<string, string>) =>
    invoke<void>("save_property_types", { types }),

  /** `.munix/workspace.json` 읽기 — ADR-031 D2. 파일 없으면 null. */
  workspaceLoad: (vaultId?: string) =>
    invoke<string | null>("workspace_load", {
      vaultId: vaultId ?? null,
    }),
  /** `.munix/workspace.json` 쓰기. self-write watcher suppression 적용됨. */
  workspaceSave: (json: string, vaultId?: string) =>
    invoke<void>("workspace_save", { json, vaultId: vaultId ?? null }),

  /** `.munix/settings.json` 읽기 — ADR-031 C-3. 파일 없으면 null. */
  vaultSettingsLoad: (vaultId?: string) =>
    invoke<string | null>("vault_settings_load", {
      vaultId: vaultId ?? null,
    }),
  /** `.munix/settings.json` 쓰기. self-write watcher suppression 적용. */
  vaultSettingsSave: (json: string, vaultId?: string) =>
    invoke<void>("vault_settings_save", {
      json,
      vaultId: vaultId ?? null,
    }),

  /** `munix.json` 글로벌 vault 레지스트리 — ADR-032. 파일 없으면 빈 registry. */
  vaultRegistryLoad: () => invoke<VaultRegistry>("vault_registry_load"),
  vaultRegistrySave: (registry: VaultRegistry) =>
    invoke<void>("vault_registry_save", { registry }),
  vaultRegistryRemove: (id: string) =>
    invoke<void>("vault_registry_remove", { id }),
  vaultRegistryClear: () => invoke<void>("vault_registry_clear"),
  /** ADR-031 C-6 후속: closed entry 만 정리 + 더 이상 참조되지 않는 path 의 trust 도 정리. */
  vaultRegistryClearClosed: () => invoke<void>("vault_registry_clear_closed"),

  terminalSpawn: (cols: number, rows: number, vaultId?: string) =>
    invoke<{ id: string }>("terminal_spawn", {
      cols,
      rows,
      vaultId: vaultId ?? null,
    }),
  terminalWrite: (id: string, data: string) =>
    invoke<void>("terminal_write", { id, data }),
  terminalResize: (id: string, cols: number, rows: number) =>
    invoke<void>("terminal_resize", { id, cols, rows }),
  terminalKill: (id: string) => invoke<void>("terminal_kill", { id }),
};

export interface VaultRegistryEntry {
  path: string;
  ts: number;
  open: boolean;
  active: boolean;
}

export interface VaultRegistry {
  version: number;
  vaults: Record<string, VaultRegistryEntry>;
}
