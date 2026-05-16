import { parseDocument, serializeDocument } from "@/lib/markdown";
import type { IpcClient, VaultRegistry } from "@/lib/ipc";
import type {
  FileContent,
  FileNode,
  MarkdownBatchItem,
  MarkdownFileContent,
  VaultInfo,
  WriteResult,
} from "@/types/ipc";
import type { TerminalCompletionSuggestion } from "@/types/terminal-completion";

interface MockIpcOptions {
  root?: string;
  docs?: Record<string, string>;
  registry?: VaultRegistry;
}

interface TreeDirectory {
  path: string;
  name: string;
  children: Map<string, TreeDirectory | FileNode>;
}

const DEFAULT_ROOT = "/tmp/munix-render-vault";
const DEFAULT_VAULT_ID = "mock-vault";
const DEFAULT_DOCS: Record<string, string> = {
  "Welcome.md": [
    "---",
    "tags:",
    "  - test",
    "---",
    "# Welcome",
    "",
    "This note is served by the Munix mock IPC client.",
  ].join("\n"),
  "Guides/Markdown basics.md": "# Markdown basics\n\n- Lists\n- Links\n",
  "Projects/Munix roadmap.md": "# Munix roadmap\n\n[[Welcome]]\n",
};

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function directoryName(path: string): string {
  return path.split("/").pop() ?? path;
}

function countFiles(nodes: FileNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === "file") count += 1;
    else count += countFiles(node.children ?? []);
  }
  return count;
}

function toFileNode(path: string, content: string, modified: number): FileNode {
  return {
    path,
    name: fileName(path),
    kind: "file",
    size: content.length,
    modified,
    children: null,
  };
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function buildTree(
  docs: Map<string, string>,
  modifiedByPath: Map<string, number>,
): FileNode[] {
  const root: TreeDirectory = {
    path: "",
    name: "",
    children: new Map(),
  };

  for (const [path, content] of docs) {
    const parts = path.split("/");
    let cursor = root;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!part) continue;
      const currentPath = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1;
      if (isFile) {
        cursor.children.set(
          part,
          toFileNode(path, content, modifiedByPath.get(path) ?? Date.now()),
        );
      } else {
        const existing = cursor.children.get(part);
        if (existing && !("kind" in existing)) {
          cursor = existing;
        } else {
          const dir: TreeDirectory = {
            path: currentPath,
            name: directoryName(currentPath),
            children: new Map(),
          };
          cursor.children.set(part, dir);
          cursor = dir;
        }
      }
    }
  }

  const normalize = (dir: TreeDirectory): FileNode[] =>
    sortNodes(
      Array.from(dir.children.values()).map((entry) => {
        if ("kind" in entry) return entry;
        return {
          path: entry.path,
          name: entry.name,
          kind: "directory",
          size: null,
          modified: null,
          children: normalize(entry),
        };
      }),
    );

  return normalize(root);
}

function notFound(path: string): Error {
  return Object.assign(new Error(`Not found: ${path}`), {
    type: "NotFound",
  });
}

export function createMockIpcClient(options: MockIpcOptions = {}): IpcClient {
  const root = options.root ?? DEFAULT_ROOT;
  const docs = new Map(Object.entries(options.docs ?? DEFAULT_DOCS));
  const modifiedByPath = new Map<string, number>(
    Array.from(docs.keys()).map((path, index) => [path, 1_800_000_000 + index]),
  );
  let activeVaultId: string | null = DEFAULT_VAULT_ID;
  let registry: VaultRegistry = options.registry ?? {
    version: 1,
    vaults: {},
  };

  const vaultInfo = (): VaultInfo => ({
    id: DEFAULT_VAULT_ID,
    name: directoryName(root),
    root,
    fileCount: countFiles(buildTree(docs, modifiedByPath)),
  });

  const readMarkdown = (path: string): MarkdownFileContent => {
    const raw = docs.get(path);
    if (raw === undefined) throw notFound(path);
    const parsed = parseDocument(raw);
    return {
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      modified: modifiedByPath.get(path) ?? 0,
      size: raw.length,
    };
  };

  const writeMarkdown = (path: string, raw: string): WriteResult => {
    const modified = Date.now();
    docs.set(path, raw);
    modifiedByPath.set(path, modified);
    return {
      modified,
      size: raw.length,
      conflict: false,
    };
  };

  return {
    openVault: async (path: string) => {
      activeVaultId = DEFAULT_VAULT_ID;
      registry = {
        version: registry.version,
        vaults: {
          ...registry.vaults,
          [DEFAULT_VAULT_ID]: {
            path,
            ts: Date.now(),
            open: true,
            active: true,
          },
        },
      };
      return { ...vaultInfo(), root: path };
    },
    closeVault: async () => {
      activeVaultId = null;
    },
    getVaultInfo: async () => (activeVaultId ? vaultInfo() : null),
    listOpenVaults: async () => (activeVaultId ? [vaultInfo()] : []),
    setActiveVault: async (vaultId: string) => {
      activeVaultId = vaultId;
    },
    pathExists: async (path: string) => path === root,
    defaultSampleVaultPath: async () => root,
    createDir: async (path: string) => path,
    isPathTrusted: async () => true,
    trustPath: async () => {},
    listFiles: async () => buildTree(docs, modifiedByPath),
    readFile: async (relPath: string): Promise<FileContent> => {
      const content = docs.get(relPath);
      if (content === undefined) throw notFound(relPath);
      return {
        content,
        modified: modifiedByPath.get(relPath) ?? 0,
        size: content.length,
      };
    },
    readMarkdownFile: async (relPath: string) => readMarkdown(relPath),
    readMarkdownBatch: async (relPaths: string[]) =>
      relPaths
        .filter((path) => /\.md$/i.test(path) && docs.has(path))
        .map<MarkdownBatchItem>((path) => ({
          path,
          ...readMarkdown(path),
        })),
    writeFile: async (
      relPath: string,
      content: string,
      _expectedModified: number | null,
      _force = false,
    ) => writeMarkdown(relPath, content),
    createFile: async (relPath: string, content = "") => {
      if (docs.has(relPath)) {
        throw Object.assign(new Error(`Already exists: ${relPath}`), {
          type: "AlreadyExists",
        });
      }
      writeMarkdown(relPath, content);
      return toFileNode(relPath, content, modifiedByPath.get(relPath) ?? 0);
    },
    createFolder: async (relPath: string) => ({
      path: relPath,
      name: directoryName(relPath),
      kind: "directory",
      size: null,
      modified: null,
      children: [],
    }),
    renameEntry: async (oldRel: string, newRel: string) => {
      const raw = docs.get(oldRel);
      if (raw === undefined) throw notFound(oldRel);
      docs.delete(oldRel);
      modifiedByPath.delete(oldRel);
      writeMarkdown(newRel, raw);
      return toFileNode(newRel, raw, modifiedByPath.get(newRel) ?? 0);
    },
    deleteEntry: async (relPath: string) => {
      docs.delete(relPath);
      modifiedByPath.delete(relPath);
    },
    saveAsset: async (_bytes: Uint8Array, ext: string) =>
      `assets/mock-asset.${ext.replace(/^\./, "")}`,
    absPath: async (relPath: string) => `${root}/${relPath}`,
    isCurrentVaultTrusted: async () => true,
    trustCurrentVault: async () => {},
    revealInSystem: async () => {},
    getThumbnail: async (relPath: string) => `${root}/${relPath}`,
    loadSettings: async () => "{}",
    saveSettings: async () => {},
    copyText: async () => {},
    loadPropertyTypes: async () => ({}),
    savePropertyTypes: async () => {},
    workspaceLoad: async () => null,
    workspaceSave: async () => {},
    vaultSettingsLoad: async () => null,
    vaultSettingsSave: async () => {},
    vaultRegistryLoad: async () => registry,
    vaultRegistrySave: async (nextRegistry: VaultRegistry) => {
      registry = structuredClone(nextRegistry);
    },
    vaultRegistryRemove: async (id: string) => {
      const next = { ...registry.vaults };
      delete next[id];
      registry = { ...registry, vaults: next };
    },
    vaultRegistryClear: async () => {
      registry = { version: registry.version, vaults: {} };
    },
    vaultRegistryClearClosed: async () => {
      registry = {
        version: registry.version,
        vaults: Object.fromEntries(
          Object.entries(registry.vaults).filter(([, entry]) => entry.open),
        ),
      };
    },
    terminalSpawn: async () => ({ id: "mock-terminal" }),
    terminalWrite: async () => {},
    terminalResize: async () => {},
    terminalKill: async () => {},
    terminalComplete: async (): Promise<TerminalCompletionSuggestion[]> => [],
    startCliIpcServer: async () => {},
  };
}

export function createMockRegistryWithClosedVault(
  path = DEFAULT_ROOT,
): VaultRegistry {
  return {
    version: 1,
    vaults: {
      [DEFAULT_VAULT_ID]: {
        path,
        ts: Date.now(),
        open: false,
        active: false,
      },
    },
  };
}

export function serializeMockDocument(
  frontmatter: Record<string, unknown> | null,
  body: string,
): string {
  return serializeDocument({ frontmatter, body });
}
