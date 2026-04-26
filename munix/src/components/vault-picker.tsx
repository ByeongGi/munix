import { useEffect, useState } from "react";
import {
  FolderOpen,
  Folder,
  FolderX,
  X,
  Trash2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVaultStore } from "@/store/vault-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { useTabStore } from "@/store/tab-store";
import {
  listClosedVaults,
  type VaultRegistryEntry,
} from "@/lib/vault-registry";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/cn";

interface VaultPickerProps {
  onPick: () => void;
}

interface HistoryRow {
  id: string;
  entry: VaultRegistryEntry;
}

function basenameOf(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

function isVaultErrorType(error: unknown, type: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === type
  );
}

export function VaultPicker({ onPick }: VaultPickerProps) {
  const open = useVaultStore((s) => s.open);
  const error = useVaultStore((s) => s.error);
  const refresh = useVaultStore((s) => s.refresh);
  const openTab = useTabStore((s) => s.openTab);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [brokenPaths, setBrokenPaths] = useState<Set<string>>(new Set());
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const { t } = useTranslation(["vault", "common"]);

  useEffect(() => {
    let cancelled = false;
    void listClosedVaults().then(async (rows) => {
      if (cancelled) return;
      setHistory(rows);
      // 비동기 broken 검사 — 실패해도 UI 그대로 (false negative 가 안전)
      const broken = new Set<string>();
      await Promise.all(
        rows.map(async ({ entry }) => {
          try {
            const ok = await ipc.pathExists(entry.path);
            if (!ok) broken.add(entry.path);
          } catch {
            // ignore
          }
        }),
      );
      if (!cancelled) setBrokenPaths(broken);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenRecent = (path: string) => {
    if (brokenPaths.has(path)) return;
    void open(path);
  };

  const handleRemove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ipc.vaultRegistryRemove(id);
      const rows = await listClosedVaults();
      setHistory(rows);
    } catch {
      // ignore
    }
  };

  const handleClearHistory = async () => {
    try {
      // backend 에 묶음 IPC — closed entry 제거 + 더 이상 참조 안 되는 path 의
      // trusted-vaults.json 항목도 같이 정리 (ADR-031 C-6 후속).
      await ipc.vaultRegistryClearClosed();
      const rows = await listClosedVaults();
      setHistory(rows);
    } catch {
      // ignore
    }
  };

  const handleResetAll = async () => {
    const ok = window.confirm(t("vault:reset.confirm"));
    if (!ok) return;
    try {
      const dock = useVaultDockStore.getState();
      const ids = dock.vaults.map((v) => v.id);
      for (const id of ids) {
        try {
          await dock.closeVault(id);
        } catch {
          // ignore
        }
      }
      await ipc.vaultRegistryClear();
      setHistory([]);
    } catch {
      // ignore
    }
  };

  const createSampleFile = async (relPath: string, content: string) => {
    try {
      await ipc.createFile(relPath, content);
    } catch (e) {
      if (isVaultErrorType(e, "AlreadyExists")) return;
      throw e;
    }
  };

  const createSampleFolder = async (relPath: string) => {
    try {
      await ipc.createFolder(relPath);
    } catch (e) {
      if (isVaultErrorType(e, "AlreadyExists")) return;
      throw e;
    }
  };

  const handleCreateSampleVault = async () => {
    setSampleLoading(true);
    setSampleError(null);
    try {
      const defaultPath = await ipc.defaultSampleVaultPath();
      const path = await ipc.createDir(defaultPath);
      await open(path);

      const openedRoot = useVaultStore.getState().info?.root;
      if (openedRoot !== path) return;

      await createSampleFolder("Guides");
      await createSampleFolder("Projects");
      await createSampleFile("Welcome.md", t("vault:sample.files.welcome"));
      await createSampleFile(
        "Guides/Markdown basics.md",
        t("vault:sample.files.markdown"),
      );
      await createSampleFile(
        "Projects/Munix roadmap.md",
        t("vault:sample.files.roadmap"),
      );
      await refresh();
      openTab("Welcome.md");
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : String(e));
    } finally {
      setSampleLoading(false);
    }
  };

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold tracking-tight">
        Munix <span className="text-[var(--color-accent)]">▪</span>
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)]">
        {t("vault:description.choosePrompt")}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onPick}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm",
            "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
            "hover:bg-[var(--color-bg-hover)]",
          )}
        >
          <FolderOpen className="h-4 w-4" />
          {t("vault:button.openFolder")}
        </button>
        <button
          type="button"
          onClick={() => void handleCreateSampleVault()}
          disabled={sampleLoading}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm",
            "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-text-on-accent)]",
            "hover:brightness-110 disabled:cursor-wait disabled:opacity-70",
          )}
        >
          <Sparkles className="h-4 w-4" />
          {sampleLoading
            ? t("vault:sample.creating")
            : t("vault:sample.create")}
        </button>
      </div>

      {(error || sampleError) && (
        <p className="text-xs text-[var(--color-danger)]" role="alert">
          {sampleError ?? error}
        </p>
      )}

      {history.length > 0 && (
        <section className="mt-2 w-full max-w-md">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              {t("vault:history.heading")}
            </h2>
            <button
              type="button"
              onClick={() => void handleClearHistory()}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px]",
                "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
              )}
              title={t("vault:history.clearTitle")}
            >
              <Trash2 className="h-3 w-3" />
              {t("vault:history.clear")}
            </button>
          </div>
          <ul
            className={cn(
              "divide-y rounded-md border",
              "divide-[var(--color-border-secondary)]",
              "border-[var(--color-border-primary)]",
              "bg-[var(--color-bg-secondary)]",
            )}
          >
            {history.map(({ id, entry }) => {
              const isBroken = brokenPaths.has(entry.path);
              return (
                <li key={id} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => handleOpenRecent(entry.path)}
                    disabled={isBroken}
                    className={cn(
                      "flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm",
                      isBroken
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-[var(--color-bg-hover)]",
                    )}
                    title={
                      isBroken
                        ? t("vault:history.brokenTitle", {
                            defaultValue: "경로를 찾을 수 없음",
                          }) + ` — ${entry.path}`
                        : entry.path
                    }
                  >
                    {isBroken ? (
                      <FolderX className="h-4 w-4 shrink-0 text-[var(--color-warning,_#FB923C)]" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                    )}
                    <span className="flex flex-1 flex-col overflow-hidden">
                      <span className="truncate font-medium">
                        {basenameOf(entry.path)}
                        {isBroken && (
                          <span className="ml-1.5 rounded bg-[var(--color-bg-tertiary)] px-1 py-0.5 text-[9px] font-mono uppercase text-[var(--color-warning,_#FB923C)]">
                            {t("vault:history.brokenTag", {
                              defaultValue: "missing",
                            })}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-[10px] text-[var(--color-text-tertiary)]">
                        {entry.path}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => void handleRemove(id, e)}
                    className="mr-1 hidden rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] group-hover:block"
                    aria-label={t("vault:history.removeAria", {
                      name: basenameOf(entry.path),
                    })}
                    title={t("vault:history.removeTitle")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => void handleResetAll()}
        className={cn(
          "mt-4 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px]",
          "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
        )}
        title={t("vault:reset.title")}
      >
        <RotateCcw className="h-3 w-3" />
        {t("vault:reset.action")}
      </button>
    </main>
  );
}
