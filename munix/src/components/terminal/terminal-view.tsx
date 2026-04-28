import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FitAddon, init, Terminal } from "ghostty-web";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ipc } from "@/lib/ipc";
import {
  appendTerminalOutput,
  getTerminalOutput,
  getTerminalSessionId,
  hasTerminalExited,
  markTerminalSessionExited,
  setTerminalSessionId,
} from "@/lib/terminal-session-registry";

interface TerminalViewProps {
  terminalTabId: string;
  className?: string;
  onExited?: () => void;
}

interface TerminalEventPayload {
  id: string;
}

interface TerminalDataPayload extends TerminalEventPayload {
  data: string;
}

const TERMINAL_FONT_SIZE_KEY = "munix:terminalFontSize";
const DEFAULT_TERMINAL_FONT_SIZE = 13;
const MIN_TERMINAL_FONT_SIZE = 10;
const MAX_TERMINAL_FONT_SIZE = 24;
const TERMINAL_FONT_FAMILY =
  '"JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font", "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';
const TERMINAL_BUNDLED_FONT = "JetBrainsMono Nerd Font Mono";
const TERMINAL_LAYOUT_SETTLE_FRAMES = 2;

let ghosttyReady: Promise<void> | null = null;

function initGhostty(): Promise<void> {
  ghosttyReady ??= init();
  return ghosttyReady;
}

async function loadTerminalFont(fontSize: number): Promise<void> {
  if (!("fonts" in document)) return;
  await document.fonts.load(`${fontSize}px "${TERMINAL_BUNDLED_FONT}"`);
  await document.fonts.ready;
}

function readInitialFontSize(): number {
  const raw = localStorage.getItem(TERMINAL_FONT_SIZE_KEY);
  const value = raw ? Number.parseInt(raw, 10) : DEFAULT_TERMINAL_FONT_SIZE;
  if (Number.isNaN(value)) return DEFAULT_TERMINAL_FONT_SIZE;
  return Math.max(
    MIN_TERMINAL_FONT_SIZE,
    Math.min(MAX_TERMINAL_FONT_SIZE, value),
  );
}

export function TerminalView({
  terminalTabId,
  className,
  onExited,
}: TerminalViewProps) {
  const { t } = useTranslation(["app"]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const onExitedRef = useRef(onExited);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [fontSize, setFontSize] = useState(readInitialFontSize);
  const initialFontSizeRef = useRef(fontSize);
  const settleFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onExitedRef.current = onExited;
  }, [onExited]);

  const resizeToFit = useCallback(() => {
    const fit = fitRef.current;
    const terminal = terminalRef.current;
    if (!fit || !terminal) return;
    fit.fit();
    const id = sessionIdRef.current;
    if (id) void ipc.terminalResize(id, terminal.cols, terminal.rows);
  }, []);

  const waitForSettledFit = useCallback(() => {
    if (settleFrameRef.current !== null) {
      cancelAnimationFrame(settleFrameRef.current);
    }

    return new Promise<void>((resolve) => {
      let remainingFrames = TERMINAL_LAYOUT_SETTLE_FRAMES;
      const tick = () => {
        remainingFrames -= 1;
        if (remainingFrames > 0) {
          settleFrameRef.current = requestAnimationFrame(tick);
          return;
        }

        settleFrameRef.current = null;
        const fit = fitRef.current;
        if (fit) fit.fit();
        resolve();
      };

      settleFrameRef.current = requestAnimationFrame(tick);
    });
  }, []);

  const updateFontSize = useCallback(
    (nextSize: number) => {
      const next = Math.max(
        MIN_TERMINAL_FONT_SIZE,
        Math.min(MAX_TERMINAL_FONT_SIZE, nextSize),
      );
      setFontSize(next);
      localStorage.setItem(TERMINAL_FONT_SIZE_KEY, String(next));
      const terminal = terminalRef.current;
      if (terminal) {
        terminal.options.fontSize = next;
        requestAnimationFrame(resizeToFit);
      }
    },
    [resizeToFit],
  );

  const handleKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        event.stopPropagation();
        updateFontSize(fontSize + 1);
        return;
      }
      if (event.key === "-") {
        event.preventDefault();
        event.stopPropagation();
        updateFontSize(fontSize - 1);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        event.stopPropagation();
        updateFontSize(DEFAULT_TERMINAL_FONT_SIZE);
      }
    },
    [fontSize, updateFontSize],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const parent: HTMLElement = container;

    let cancelled = false;
    let unlistenData: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;

    async function start() {
      try {
        setReady(false);
        await loadTerminalFont(initialFontSizeRef.current);
        if (cancelled) return;
        await initGhostty();
        if (cancelled) return;

        const terminal = new Terminal({
          cursorBlink: true,
          fontFamily: TERMINAL_FONT_FAMILY,
          fontSize: initialFontSizeRef.current,
          scrollback: 10000,
          smoothScrollDuration: 80,
          theme: {
            background: "#111416",
            foreground: "#e5e7eb",
            cursor: "#5eead4",
            selectionBackground: "#0f766e",
            selectionForeground: "#ffffff",
            black: "#111416",
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

        await waitForSettledFit();
        if (cancelled) return;

        const cols = Math.max(terminal.cols, 20);
        const rows = Math.max(terminal.rows, 6);
        const existingSessionId = getTerminalSessionId(terminalTabId);
        const session = hasTerminalExited(terminalTabId)
          ? null
          : existingSessionId
            ? { id: existingSessionId }
            : await ipc.terminalSpawn(cols, rows);
        if (cancelled) {
          if (session && !existingSessionId) {
            setTerminalSessionId(terminalTabId, session.id);
          }
          return;
        }

        if (session && !existingSessionId) {
          setTerminalSessionId(terminalTabId, session.id);
        }
        sessionIdRef.current = session?.id ?? null;
        const bufferedOutput = getTerminalOutput(terminalTabId);
        if (bufferedOutput) terminal.write(bufferedOutput);
        if (!session) {
          setReady(true);
          return;
        }

        if (existingSessionId) void ipc.terminalResize(session.id, cols, rows);
        terminal.onData((data) => {
          const id = sessionIdRef.current;
          if (id) void ipc.terminalWrite(id, data);
        });
        terminal.onResize(({ cols, rows }) => {
          const id = sessionIdRef.current;
          if (id) void ipc.terminalResize(id, cols, rows);
        });

        unlistenData = await listen<TerminalDataPayload>(
          "terminal:data",
          (event) => {
            if (event.payload.id !== session.id) return;
            appendTerminalOutput(terminalTabId, event.payload.data);
            terminal.write(event.payload.data);
          },
        );
        unlistenExit = await listen<TerminalEventPayload>(
          "terminal:exit",
          (event) => {
            if (event.payload.id !== session.id) return;
            markTerminalSessionExited(terminalTabId);
            sessionIdRef.current = null;
            requestAnimationFrame(() => onExitedRef.current?.());
          },
        );

        setReady(true);
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

      if (settleFrameRef.current !== null) {
        cancelAnimationFrame(settleFrameRef.current);
        settleFrameRef.current = null;
      }

      fitRef.current?.dispose();
      fitRef.current = null;
      terminalRef.current?.dispose();
      terminalRef.current = null;
    };
  }, [t, terminalTabId, waitForSettledFit]);

  return (
    <div
      onKeyDownCapture={handleKeyDownCapture}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg-primary)]",
        className,
      )}
    >
      {error ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--color-text-secondary)]">
          {t("app:terminal.error")}
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--color-bg-primary)]">
          <div
            ref={containerRef}
            data-munix-terminal-viewport="true"
            className={cn(
              "relative min-h-0 h-full overflow-hidden pb-4 pl-3 pr-0 pt-0 font-mono transition-opacity duration-75",
              ready ? "opacity-100" : "opacity-0",
            )}
          />
          {!ready ? (
            <div className="pointer-events-none absolute inset-0 bg-[var(--color-bg-primary)]" />
          ) : null}
        </div>
      )}
    </div>
  );
}
