import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FitAddon, init, Terminal } from "ghostty-web";
import { TerminalIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ipc } from "@/lib/ipc";
import {
  getTerminalSessionId,
  setTerminalSessionId,
} from "@/lib/terminal-session-registry";

interface TerminalViewProps {
  terminalTabId: string;
  className?: string;
}

interface TerminalEventPayload {
  id: string;
}

interface TerminalDataPayload extends TerminalEventPayload {
  data: string;
}

let ghosttyReady: Promise<void> | null = null;

function initGhostty(): Promise<void> {
  ghosttyReady ??= init();
  return ghosttyReady;
}

export function TerminalView({ terminalTabId, className }: TerminalViewProps) {
  const { t } = useTranslation(["app"]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const parent: HTMLElement = container;

    let cancelled = false;
    let unlistenData: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;

    async function start() {
      try {
        await initGhostty();
        if (cancelled) return;

        const terminal = new Terminal({
          cursorBlink: true,
          fontFamily:
            'JetBrains Mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace',
          fontSize: 13,
          scrollback: 10000,
          theme: {
            background: "#0a0f0f",
            foreground: "#d6e3e1",
            cursor: "#5eead4",
            selectionBackground: "#0f766e",
            black: "#0a0f0f",
            red: "#ef4444",
            green: "#22c55e",
            yellow: "#eab308",
            blue: "#3b82f6",
            magenta: "#a855f7",
            cyan: "#14b8a6",
            white: "#e5e7eb",
            brightBlack: "#64748b",
            brightRed: "#f87171",
            brightGreen: "#4ade80",
            brightYellow: "#facc15",
            brightBlue: "#60a5fa",
            brightMagenta: "#c084fc",
            brightCyan: "#2dd4bf",
            brightWhite: "#ffffff",
          },
        });
        const fit = new FitAddon();

        terminal.loadAddon(fit);
        terminal.open(parent);
        fit.fit();
        fit.observeResize();

        terminalRef.current = terminal;
        fitRef.current = fit;

        const cols = Math.max(terminal.cols, 20);
        const rows = Math.max(terminal.rows, 6);
        const existingSessionId = getTerminalSessionId(terminalTabId);
        const session = existingSessionId
          ? { id: existingSessionId }
          : await ipc.terminalSpawn(cols, rows);
        if (cancelled) {
          if (!existingSessionId) setTerminalSessionId(terminalTabId, session.id);
          return;
        }

        if (!existingSessionId) setTerminalSessionId(terminalTabId, session.id);
        sessionIdRef.current = session.id;
        terminal.onData((data) => {
          const id = sessionIdRef.current;
          if (id) void ipc.terminalWrite(id, data);
        });
        terminal.onResize(({ cols, rows }) => {
          const id = sessionIdRef.current;
          if (id) void ipc.terminalResize(id, cols, rows);
        });

        unlistenData = await listen<TerminalDataPayload>("terminal:data", (event) => {
          if (event.payload.id !== session.id) return;
          terminal.write(event.payload.data);
        });
        unlistenExit = await listen<TerminalEventPayload>("terminal:exit", (event) => {
          if (event.payload.id !== session.id) return;
          terminal.writeln(`\r\n${t("app:terminal.exited")}`);
        });

        terminal.focus();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      unlistenData?.();
      unlistenExit?.();

      sessionIdRef.current = null;

      fitRef.current?.dispose();
      fitRef.current = null;
      terminalRef.current?.dispose();
      terminalRef.current = null;
    };
  }, [t, terminalTabId]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0f0f]",
        className,
      )}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--color-border-primary)] px-3 text-xs text-[var(--color-text-secondary)]">
        <TerminalIcon className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <span>{t("app:terminal.title")}</span>
      </div>
      {error ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--color-text-secondary)]">
          {t("app:terminal.error")}
        </div>
      ) : (
        <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-2" />
      )}
    </div>
  );
}
