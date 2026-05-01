import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FitAddon, Ghostty, Terminal } from "ghostty-web";
import ghosttyWasmUrl from "ghostty-web/ghostty-vt.wasm?url";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ipc, type NativeTerminalAvailability } from "@/lib/ipc";
import {
  appendTerminalOutputToScreenState,
  ensureTerminalScreenState,
  getTerminalScreenState,
  getTerminalSessionId,
  hasTerminalExited,
  markTerminalSessionExited,
  resetTerminalSessionState,
  resizeTerminalScreenState,
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

interface NativeTerminalEventPayload extends TerminalEventPayload {
  kind: "closed" | "childExited" | "commandFinished" | string;
  detail?: string | null;
}

const TERMINAL_FONT_SIZE_KEY = "munix:terminalFontSize";
const DEFAULT_TERMINAL_FONT_SIZE = 13;
const MIN_TERMINAL_FONT_SIZE = 10;
const MAX_TERMINAL_FONT_SIZE = 24;
const TERMINAL_FONT_FAMILY =
  '"JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font", "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';
const TERMINAL_BUNDLED_FONT = "JetBrainsMono Nerd Font Mono";
const TERMINAL_LAYOUT_SETTLE_FRAMES = 2;
const LEGACY_TERMINAL_FALLBACK_KEY = "munix:terminalLegacyWebviewFallback";

let ghosttyReady: Promise<Ghostty> | null = null;

function loadGhostty(): Promise<Ghostty> {
  ghosttyReady ??= Ghostty.load(ghosttyWasmUrl);
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

function shouldUseNativeTerminal(
  availability: NativeTerminalAvailability,
): boolean {
  const forceWebFallback =
    localStorage.getItem(LEGACY_TERMINAL_FALLBACK_KEY) === "true";
  return availability.available && !forceWebFallback;
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

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.style.visibility = "hidden";
      container.replaceChildren();
    }
    sessionIdRef.current = null;
    setError(null);
    setReady(false);
  }, [terminalTabId]);

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
      if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;
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
    const host: HTMLElement = container;
    host.replaceChildren();

    let cancelled = false;
    let unlistenData: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;
    let unlistenNativeEvent: UnlistenFn | null = null;
    let terminalMount: HTMLDivElement | null = null;
    let nativeTerminalId: string | null = null;
    let nativeBoundsObserver: ResizeObserver | null = null;
    const existingSessionId = getTerminalSessionId(terminalTabId);
    if (!existingSessionId) {
      resetTerminalSessionState(terminalTabId);
    }

    const createTerminalMount = () => {
      const rect = host.getBoundingClientRect();
      const mount = document.createElement("div");
      mount.dataset.munixTerminalMount = "true";
      Object.assign(mount.style, {
        boxSizing: "border-box",
        fontFamily: "monospace",
        height: `${Math.max(rect.height, 1)}px`,
        left: "-10000px",
        overflow: "hidden",
        padding: "0 0 16px 12px",
        position: "fixed",
        top: "0",
        visibility: "hidden",
        width: `${Math.max(rect.width, 1)}px`,
      });
      document.body.appendChild(mount);
      return mount;
    };

    const revealTerminal = (terminal: Terminal) => {
      requestAnimationFrame(() => {
        if (terminalRef.current !== terminal || !terminalMount) return;
        if (terminalMount.parentElement !== host) {
          host.replaceChildren(terminalMount);
        }
        Object.assign(terminalMount.style, {
          height: "100%",
          left: "",
          position: "relative",
          top: "",
          visibility: "visible",
          width: "100%",
        });
        setReady(true);
      });
    };

    const clearSurface = () => {
      const terminal = terminalRef.current;
      try {
        terminal?.reset();
      } catch {
        // Terminal may already be disposed while React is tearing down.
      }
      terminalMount?.remove();
      terminalMount = null;
      host.replaceChildren();
    };

    const handleNativeExited = (id: string) => {
      if (nativeTerminalId !== id) return;
      nativeTerminalId = null;
      nativeBoundsObserver?.disconnect();
      nativeBoundsObserver = null;
      window.removeEventListener("resize", handleNativeWindowResize);
      host.replaceChildren();
      setReady(false);
      requestAnimationFrame(() => onExitedRef.current?.());
    };

    const syncNativeBounds = (id: string) => {
      const rect = host.getBoundingClientRect();
      const x = rect.left;
      const y = window.innerHeight - rect.bottom;
      void ipc.terminalNativeSetBounds(
        id,
        x,
        y,
        Math.max(rect.width, 1),
        Math.max(rect.height, 1),
      );
    };

    async function start() {
      try {
        setReady(false);
        const nativeAvailability = await ipc.terminalNativeIsAvailable();
        if (cancelled) return;

        if (shouldUseNativeTerminal(nativeAvailability)) {
          const nativeTerminal = await ipc.terminalNativeOpen();
          if (cancelled) {
            void ipc.terminalNativeClose(nativeTerminal.id).catch(() => {});
            return;
          }

          nativeTerminalId = nativeTerminal.id;
          unlistenNativeEvent = await listen<NativeTerminalEventPayload>(
            "terminal:native-event",
            (event) => {
              if (event.payload.id !== nativeTerminal.id) return;
              if (
                event.payload.kind === "closed" ||
                event.payload.kind === "childExited"
              ) {
                handleNativeExited(event.payload.id);
              }
            },
          );
          if (cancelled) {
            unlistenNativeEvent?.();
            void ipc.terminalNativeClose(nativeTerminal.id).catch(() => {});
            return;
          }
          syncNativeBounds(nativeTerminal.id);
          nativeBoundsObserver = new ResizeObserver(() => {
            if (nativeTerminalId) syncNativeBounds(nativeTerminalId);
          });
          nativeBoundsObserver.observe(host);
          window.addEventListener("resize", handleNativeWindowResize);
          void ipc.terminalNativeFocus(nativeTerminal.id);
          setReady(true);
          return;
        }

        await loadTerminalFont(initialFontSizeRef.current);
        if (cancelled) return;
        const ghostty = await loadGhostty();
        if (cancelled) return;

        const terminal = new Terminal({
          cursorBlink: true,
          fontFamily: TERMINAL_FONT_FAMILY,
          fontSize: initialFontSizeRef.current,
          scrollback: 10000,
          smoothScrollDuration: 80,
          ghostty,
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
        terminalMount = createTerminalMount();
        terminal.open(terminalMount);
        terminal.reset();
        fit.fit();
        fit.observeResize();

        terminalRef.current = terminal;
        fitRef.current = fit;

        await waitForSettledFit();
        if (cancelled) return;

        const cols = Math.max(terminal.cols, 20);
        const rows = Math.max(terminal.rows, 6);
        const session = hasTerminalExited(terminalTabId)
          ? null
          : existingSessionId
            ? { id: existingSessionId }
            : await ipc.terminalSpawn(cols, rows);
        if (cancelled) {
          if (session && !existingSessionId) {
            void ipc.terminalKill(session.id).catch(() => {});
          }
          return;
        }

        if (session && !existingSessionId) {
          setTerminalSessionId(terminalTabId, session.id, cols, rows);
        } else if (session) {
          ensureTerminalScreenState(terminalTabId, session.id, cols, rows);
        }
        sessionIdRef.current = session?.id ?? null;
        if (!session) {
          revealTerminal(terminal);
          setReady(true);
          return;
        }
        const screenState = getTerminalScreenState(terminalTabId, session.id);
        if (screenState) {
          terminal.clear();
          terminal.write(screenState, () => revealTerminal(terminal));
        } else if (existingSessionId) {
          revealTerminal(terminal);
        }

        if (existingSessionId) void ipc.terminalResize(session.id, cols, rows);
        terminal.onData((data) => {
          const id = sessionIdRef.current;
          if (id) void ipc.terminalWrite(id, data);
        });
        terminal.onResize(({ cols, rows }) => {
          const id = sessionIdRef.current;
          if (!id) return;
          resizeTerminalScreenState(terminalTabId, id, cols, rows);
          void ipc.terminalResize(id, cols, rows);
        });

        unlistenData = await listen<TerminalDataPayload>(
          "terminal:data",
          (event) => {
            if (event.payload.id !== session.id) return;
            appendTerminalOutputToScreenState(
              terminalTabId,
              session.id,
              event.payload.data,
            );
            terminal.write(event.payload.data, () => revealTerminal(terminal));
          },
        );
        unlistenExit = await listen<TerminalEventPayload>(
          "terminal:exit",
          (event) => {
            if (event.payload.id !== session.id) return;
            markTerminalSessionExited(terminalTabId, session.id);
            sessionIdRef.current = null;
            clearSurface();
            setReady(false);
            requestAnimationFrame(() => onExitedRef.current?.());
          },
        );
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
      unlistenNativeEvent?.();
      nativeBoundsObserver?.disconnect();
      nativeBoundsObserver = null;
      window.removeEventListener("resize", handleNativeWindowResize);
      if (nativeTerminalId) {
        void ipc.terminalNativeClose(nativeTerminalId).catch(() => {});
        nativeTerminalId = null;
      }

      sessionIdRef.current = null;

      if (settleFrameRef.current !== null) {
        cancelAnimationFrame(settleFrameRef.current);
        settleFrameRef.current = null;
      }

      fitRef.current?.dispose();
      fitRef.current = null;
      clearSurface();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      terminalMount?.remove();
      terminalMount = null;
      host.replaceChildren();
    };
    function handleNativeWindowResize() {
      if (nativeTerminalId) syncNativeBounds(nativeTerminalId);
    }
  }, [t, terminalTabId, waitForSettledFit]);

  return (
    <div
      onKeyDownCapture={handleKeyDownCapture}
      className={cn(
        "relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg-primary)]",
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
            key={terminalTabId}
            ref={containerRef}
            data-munix-terminal-viewport="true"
            className={cn(
              "relative z-0 min-h-0 h-full overflow-hidden font-mono",
            )}
          />
          {!ready ? (
            <div className="pointer-events-none absolute inset-0 z-50 bg-[var(--color-bg-primary)]" />
          ) : null}
        </div>
      )}
    </div>
  );
}
