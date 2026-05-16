import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { ipc } from "@/lib/ipc";
import { isTauriRuntime } from "@/lib/tauri-runtime";
import { useEditorStore } from "@/store/editor-store";
import { useSearchStore } from "@/store/search-store";
import { useTabStore } from "@/store/tab-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { useVaultStore } from "@/store/vault-store";
import type { SidebarTab } from "@/components/app-shell/types";
import type { FileNode } from "@/types/ipc";

const CLI_EVENT_NAME = "munix-cli-command";

interface CliInvocation {
  vault?: string | null;
  command: CliCommand;
}

type CliCommand =
  | { type: "open"; target: FileTarget; line?: number | null }
  | {
      type: "create";
      target: FileTarget;
      content?: string | null;
      open: boolean;
      overwrite: boolean;
    }
  | { type: "append"; target: FileTarget; content: string; open: boolean }
  | { type: "prepend"; target: FileTarget; content: string; open: boolean }
  | { type: "search"; query: string; open: boolean }
  | { type: "daily"; action: DailyAction }
  | { type: "tui" | "help" | "version" | "vaults" | "files" | "folders" }
  | { type: "read"; target: FileTarget }
  | { type: "tags" | "backlinks" };

interface FileTarget {
  path?: string | null;
  file?: string | null;
}

type DailyAction =
  | { type: "open" }
  | { type: "read" }
  | { type: "append"; content: string; open: boolean }
  | { type: "prepend"; content: string; open: boolean };

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
  target: FileTarget,
  line?: number | null,
): Promise<void> {
  const path = await resolveTargetPath(target);
  if (line && line > 0) {
    useEditorStore.getState().setPendingJumpLine(line);
  }
  useTabStore.getState().openTab(path);
}

async function createTarget(
  command: Extract<CliCommand, { type: "create" }>,
  options: UseCliCommandListenerOptions,
): Promise<void> {
  const path = command.target.path;
  if (!path) {
    throw new Error("create requires path=...");
  }

  if (command.overwrite) {
    await ipc.writeFile(path, command.content ?? "", null, true);
  } else {
    await ipc.createFile(path, command.content ?? "");
  }
  await options.refreshFiles();

  if (command.open) {
    useTabStore.getState().openTab(path);
  }
}

async function appendTarget(
  command: Extract<CliCommand, { type: "append" | "prepend" }>,
  prepend: boolean,
  options: UseCliCommandListenerOptions,
): Promise<void> {
  const path = await resolveTargetPath(command.target);
  await writeWithInsertedContent(path, command.content, prepend);
  await options.refreshFiles();

  if (command.open) {
    useTabStore.getState().openTab(path);
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
    );
    await options.refreshFiles();
    if (action.open) {
      useTabStore.getState().openTab(path);
    }
    return;
  }

  await ensureFile(path);
  await options.refreshFiles();
  useTabStore.getState().openTab(path);
}

async function ensureFile(path: string): Promise<void> {
  try {
    await ipc.readFile(path);
  } catch {
    await ipc.createFile(path, "");
  }
}

async function writeWithInsertedContent(
  path: string,
  content: string,
  prepend: boolean,
): Promise<void> {
  const current = await ipc.readFile(path);
  const next = prepend
    ? joinBlocks(content, current.content)
    : joinBlocks(current.content, content);
  await ipc.writeFile(path, next, current.modified, true);
}

function joinBlocks(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a.replace(/\s*$/, "")}\n${b.replace(/^\s*/, "")}`;
}

async function resolveTargetPath(target: FileTarget): Promise<string> {
  if (target.path) return target.path;
  if (!target.file) {
    throw new Error("expected path=... or file=...");
  }

  const files = useVaultStore.getState().files;
  const match = flattenFiles(files).find((node) => {
    if (node.kind !== "file") return false;
    const withoutExtension = node.name.replace(/\.md$/i, "");
    return node.name === target.file || withoutExtension === target.file;
  });

  if (!match) {
    throw new Error(`File not found: ${target.file}`);
  }
  return match.path;
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) continue;
    out.push(node);
    if (node.children) {
      stack.unshift(...node.children);
    }
  }
  return out;
}

function localDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
