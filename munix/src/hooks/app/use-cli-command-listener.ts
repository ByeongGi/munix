import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { ipc } from "@/lib/ipc";
import { isTauriRuntime } from "@/lib/tauri-runtime";
import { useEditorStore } from "@/store/editor-store";
import { useSearchStore } from "@/store/search-store";
import { useTabStore } from "@/store/tab-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { useVaultStore } from "@/store/vault-store";
import { applyWorkspaceFileChange } from "@/lib/workspace-file-change";
import {
  appendContent,
  prependContent,
  resolveCreatePathFromNodes,
  resolveFileTargetPathFromNodes,
  type CliCreateTarget,
  type CliFileTarget,
} from "./cli-target-utils";
import type { SidebarTab } from "@/components/app-shell/types";

const CLI_EVENT_NAME = "munix-cli-command";

interface CliInvocation {
  vault?: string | null;
  command: CliCommand;
}

type CliCommand =
  | { type: "open"; target: CliFileTarget; line?: number | null }
  | {
      type: "create";
      target: CliCreateTarget;
      content?: string | null;
      open: boolean;
      overwrite: boolean;
    }
  | {
      type: "append";
      target: CliFileTarget;
      content: string;
      open: boolean;
      inline: boolean;
    }
  | {
      type: "prepend";
      target: CliFileTarget;
      content: string;
      open: boolean;
      inline: boolean;
    }
  | { type: "search"; query: string; open: boolean }
  | { type: "daily"; action: DailyAction }
  | { type: "tui" | "help" | "version" | "vaults" | "files" | "folders" }
  | { type: "read"; target: CliFileTarget }
  | { type: "tags" | "backlinks" };

type DailyAction =
  | { type: "open" }
  | { type: "read" }
  | { type: "append"; content: string; open: boolean; inline: boolean }
  | { type: "prepend"; content: string; open: boolean; inline: boolean };

interface UseCliCommandListenerOptions {
  refreshFiles: () => Promise<void>;
  setSidebarTab: (tab: SidebarTab) => void;
}

export function useCliCommandListener({
  refreshFiles,
  setSidebarTab,
}: UseCliCommandListenerOptions): void {
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    const unlisten = listen<CliInvocation>(CLI_EVENT_NAME, (event) => {
      if (disposed) return;
      void runCliInvocation(event.payload, { refreshFiles, setSidebarTab });
    });
    void unlisten
      .then(() => ipc.startCliIpcServer())
      .catch((e: unknown) => {
        console.warn("[cli] failed to start IPC server", e);
      });

    return () => {
      disposed = true;
      void unlisten.then((dispose) => dispose());
    };
  }, [refreshFiles, setSidebarTab]);
}

async function runCliInvocation(
  invocation: CliInvocation,
  options: UseCliCommandListenerOptions,
): Promise<void> {
  try {
    await ensureVault(invocation.vault);

    switch (invocation.command.type) {
      case "open":
        await openTarget(invocation.command.target, invocation.command.line);
        break;
      case "create":
        await createTarget(invocation.command, options);
        break;
      case "append":
        await appendTarget(invocation.command, false, options);
        break;
      case "prepend":
        await appendTarget(invocation.command, true, options);
        break;
      case "search":
        useSearchStore.getState().setQuery(invocation.command.query);
        options.setSidebarTab("search");
        break;
      case "daily":
        await runDailyAction(invocation.command.action, options);
        break;
      default:
        if (import.meta.env.DEV) {
          console.warn("[cli] unsupported command", invocation.command);
        }
    }
  } catch (e) {
    console.warn("[cli] command failed", e);
  }
}

async function ensureVault(vault: string | null | undefined): Promise<void> {
  if (!vault) return;

  const dock = useVaultDockStore.getState();
  const opened = dock.vaults.find(
    (item) => item.id === vault || item.name === vault || item.root === vault,
  );

  if (opened) {
    if (dock.activeVaultId !== opened.id) {
      await dock.setActive(opened.id);
    }
    return;
  }

  if (looksLikePath(vault)) {
    await useVaultStore.getState().open(vault);
    return;
  }

  throw new Error(`Vault is not open: ${vault}`);
}

function looksLikePath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("~") ||
    value.startsWith(".") ||
    /^[A-Za-z]:[\\/]/.test(value)
  );
}

async function openTarget(
  target: CliFileTarget,
  line?: number | null,
): Promise<void> {
  const path = resolveTargetPath(target);
  await ipc.readFile(path);
  if (line && line > 0) {
    useEditorStore.getState().setPendingJumpLine(line);
  }
  useTabStore.getState().openTab(path);
}

async function createTarget(
  command: Extract<CliCommand, { type: "create" }>,
  options: UseCliCommandListenerOptions,
): Promise<void> {
  const path = resolveCreatePathFromNodes(
    command.target,
    useVaultStore.getState().files,
  );

  const kind = command.overwrite ? "modified" : "created";
  if (command.overwrite) {
    await ipc.writeFile(path, command.content ?? "", null, true);
  } else {
    await ipc.createFile(path, command.content ?? "");
  }
  await refreshAndApplyChange(path, kind, options);

  if (command.open) {
    useTabStore.getState().openTab(path);
  }
}

async function appendTarget(
  command: Extract<CliCommand, { type: "append" | "prepend" }>,
  prepend: boolean,
  options: UseCliCommandListenerOptions,
): Promise<void> {
  const path = resolveTargetPath(command.target);
  await writeWithInsertedContent(
    path,
    command.content,
    prepend,
    command.inline ?? false,
  );
  await refreshAndApplyChange(path, "modified", options);

  if (command.open) {
    openTabIfNotCurrent(path);
  }
}

async function runDailyAction(
  action: DailyAction,
  options: UseCliCommandListenerOptions,
): Promise<void> {
  const path = `daily/${localDateString()}.md`;

  if (action.type === "append" || action.type === "prepend") {
    await ensureFile(path);
    await writeWithInsertedContent(
      path,
      action.content,
      action.type === "prepend",
      action.inline ?? false,
    );
    await refreshAndApplyChange(path, "modified", options);
    if (action.open) {
      openTabIfNotCurrent(path);
    }
    return;
  }

  const created = await ensureFile(path);
  if (created) {
    await refreshAndApplyChange(path, "created", options);
  } else {
    await options.refreshFiles();
  }
  useTabStore.getState().openTab(path);
}

async function ensureFile(path: string): Promise<boolean> {
  try {
    await ipc.readFile(path);
    return false;
  } catch {
    await ipc.createFile(path, "");
    return true;
  }
}

async function writeWithInsertedContent(
  path: string,
  content: string,
  prepend: boolean,
  inline: boolean,
): Promise<void> {
  const current = await ipc.readFile(path);
  const next = prepend
    ? prependContent(current.content, content, inline)
    : appendContent(current.content, content, inline);
  await ipc.writeFile(path, next, current.modified, true);
}

async function refreshAndApplyChange(
  path: string,
  kind: "created" | "modified",
  options: UseCliCommandListenerOptions,
): Promise<void> {
  await options.refreshFiles();
  const vaultId = useVaultDockStore.getState().activeVaultId;
  if (!vaultId) return;
  applyWorkspaceFileChange(vaultId, kind, path);
}

function openTabIfNotCurrent(path: string): void {
  if (useEditorStore.getState().currentPath === path) return;
  useTabStore.getState().openTab(path);
}

function resolveTargetPath(target: CliFileTarget): string {
  return resolveFileTargetPathFromNodes(target, useVaultStore.getState().files);
}

function localDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
