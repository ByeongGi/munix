import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal, type IDisposable } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
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
import { ipc } from "@/lib/ipc";
import { useSettingsStore } from "@/store/settings-store";
import { useVaultStore } from "@/store/vault-store";
import type { TerminalCompletionSuggestion } from "@/types/terminal-completion";
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
import { TerminalCompletionPopup } from "./terminal-completion-popup";

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

interface TerminalCompletionAnchor {
  left: number;
  top: number;
  placement: "above" | "below";
}

const DEFAULT_TERMINAL_FONT_SIZE = 13;
const MIN_TERMINAL_FONT_SIZE = 10;
const MAX_TERMINAL_FONT_SIZE = 24;
const TERMINAL_FONT_FAMILY =
  '"JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font", "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';
const TERMINAL_BUNDLED_FONT = "JetBrainsMono Nerd Font Mono";
const TERMINAL_LAYOUT_SETTLE_FRAMES = 2;
const TERMINAL_HISTORY_LIMIT = 80;

function terminalBackgroundColor(opacityPercent: number): string {
  return `rgba(12, 16, 18, ${(opacityPercent / 100).toFixed(2)})`;
}

async function loadTerminalFont(fontSize: number): Promise<void> {
  if (!("fonts" in document)) return;
  await document.fonts.load(`${fontSize}px "${TERMINAL_BUNDLED_FONT}"`);
  await document.fonts.ready;
}

function isPrintableInput(data: string): boolean {
  return /^[\x20-\x7e]+$/.test(data);
}

function updateInputLine(current: string, data: string): string {
  if (data === "\r") return "";
  if (data === "\u0003") return "";
  if (data === "\u0015") return "";
  if (data === "\u007f") return current.slice(0, -1);
  if (data === "\u0017") return current.replace(/\s*\S+$/, "");
  if (data === "\u0001" || data === "\u0005") return current;
  if (data.startsWith("\u001b")) return current;
  if (isPrintableInput(data)) return `${current}${data}`;
  return current;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getTerminalCursorAnchor(
  terminal: Terminal,
  host: HTMLElement,
): TerminalCompletionAnchor | null {
  const screen = host.querySelector(".xterm-screen");
  if (!(screen instanceof HTMLElement)) return null;
  const hostRect = host.getBoundingClientRect();
  const screenRect = screen.getBoundingClientRect();
  if (screenRect.width <= 0 || screenRect.height <= 0) return null;

  const cellWidth = screenRect.width / Math.max(terminal.cols, 1);
  const cellHeight = screenRect.height / Math.max(terminal.rows, 1);
  const cursorX = clamp(
    terminal.buffer.active.cursorX,
    0,
    Math.max(terminal.cols - 1, 0),
  );
  const cursorY = clamp(
    terminal.buffer.active.cursorY,
    0,
    Math.max(terminal.rows - 1, 0),
  );
  const rawLeft = screenRect.left - hostRect.left + cursorX * cellWidth;
  const rawTop = screenRect.top - hostRect.top + cursorY * cellHeight;
  const left = clamp(rawLeft, 12, Math.max(hostRect.width - 536, 12));
  const top = clamp(rawTop, 20, Math.max(hostRect.height - 20, 20));
  return {
    left,
    top,
    placement: top > 220 ? "above" : "below",
  };
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
  const [inputLine, setInputLine] = useState("");
  const [completionOpen, setCompletionOpen] = useState(true);
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [completionSuggestions, setCompletionSuggestions] = useState<
    TerminalCompletionSuggestion[]
  >([]);
  const [completionAnchor, setCompletionAnchor] =
    useState<TerminalCompletionAnchor | null>(null);
  const vaultId = useVaultStore((state) => state.info?.id);
  const terminalFontSize = useSettingsStore((state) => state.terminalFontSize);
  const terminalLineHeight = useSettingsStore(
    (state) => state.terminalLineHeight,
  );
  const terminalCursorBlink = useSettingsStore(
    (state) => state.terminalCursorBlink,
  );
  const terminalScrollback = useSettingsStore(
    (state) => state.terminalScrollback,
  );
  const setSettings = useSettingsStore((state) => state.set);
  const terminalBackgroundOpacity = useSettingsStore(
    (state) => state.terminalBackgroundOpacity,
  );
  const terminalBackground = terminalBackgroundColor(terminalBackgroundOpacity);
  const terminalBackgroundRef = useRef(terminalBackground);
  const terminalFontSizeRef = useRef(terminalFontSize);
  const terminalLineHeightRef = useRef(terminalLineHeight);
  const terminalCursorBlinkRef = useRef(terminalCursorBlink);
  const terminalScrollbackRef = useRef(terminalScrollback);
  const settleFrameRef = useRef<number | null>(null);
  const inputLineRef = useRef(inputLine);
  const completionOpenRef = useRef(completionOpen);
  const commandHistoryRef = useRef(commandHistory);
  const completionPointerInsideRef = useRef(false);
  const completionRequestRef = useRef(0);

  const updateCompletionAnchor = useCallback(() => {
    const terminal = terminalRef.current;
    const host = containerRef.current;
    if (!terminal || !host) return;
    setCompletionAnchor(getTerminalCursorAnchor(terminal, host));
  }, []);

  const selectedCompletion =
    completionSuggestions[
      Math.min(selectedCompletionIndex, completionSuggestions.length - 1)
    ];

  useEffect(() => {
    inputLineRef.current = inputLine;
    setSelectedCompletionIndex(0);
  }, [inputLine]);

  useEffect(() => {
    if (!completionOpen || inputLine.trimStart().length === 0) {
      completionRequestRef.current += 1;
      setCompletionSuggestions([]);
      return;
    }

    const requestId = completionRequestRef.current + 1;
    completionRequestRef.current = requestId;
    const sessionId = sessionIdRef.current ?? undefined;
    void ipc
      .terminalComplete(inputLine, commandHistory, vaultId, sessionId)
      .then((suggestions) => {
        if (completionRequestRef.current !== requestId) return;
        setCompletionSuggestions(suggestions);
      })
      .catch((err) => {
        if (completionRequestRef.current !== requestId) return;
        setCompletionSuggestions([]);
        if (import.meta.env.DEV) {
          console.warn("[terminal] completion failed", err);
        }
      });
  }, [commandHistory, completionOpen, inputLine, vaultId]);

  useEffect(() => {
    setSelectedCompletionIndex((index) =>
      completionSuggestions.length === 0
        ? 0
        : Math.min(index, completionSuggestions.length - 1),
    );
  }, [completionSuggestions.length]);

  useEffect(() => {
    completionOpenRef.current = completionOpen;
  }, [completionOpen]);

  useEffect(() => {
    commandHistoryRef.current = commandHistory;
  }, [commandHistory]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const host = containerRef.current;
      const popup = document.querySelector("[data-terminal-completion-popup]");
      if (popup?.contains(target)) return;
      if (host?.contains(target)) return;
      setCompletionOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

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
    setInputLine("");
    setCompletionOpen(true);
    setCompletionSuggestions([]);
    setSelectedCompletionIndex(0);
    setCompletionAnchor(null);
  }, [terminalTabId]);

  const resizeToFit = useCallback(() => {
    const fit = fitRef.current;
    const terminal = terminalRef.current;
    if (!fit || !terminal) return;
    fit.fit();
    updateCompletionAnchor();
    const id = sessionIdRef.current;
    if (id) void ipc.terminalResize(id, terminal.cols, terminal.rows);
  }, [updateCompletionAnchor]);

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
        fitRef.current?.fit();
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
      setSettings({ terminalFontSize: next });
    },
    [setSettings],
  );

  const writeToTerminal = useCallback((data: string) => {
    const id = sessionIdRef.current;
    if (!id) return;
    void ipc.terminalWrite(id, data);
  }, []);

  const applyCompletion = useCallback(
    (suggestion: TerminalCompletionSuggestion | undefined) => {
      if (!suggestion) return;
      const current = inputLineRef.current;
      const replacement = suggestion.insertValue;
      const next = `${current.slice(
        0,
        suggestion.replacementStart,
      )}${replacement}${current.slice(suggestion.replacementEnd)}`;
      const suffix = next.slice(current.length);
      if (!suffix) return;
      writeToTerminal(suffix);
      inputLineRef.current = next;
      setInputLine(next);
      setCompletionOpen(false);
    },
    [writeToTerminal],
  );

  const handleKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (completionSuggestions.length > 0 && completionOpen) {
        if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          applyCompletion(selectedCompletion);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          setSelectedCompletionIndex(
            (index) => (index + 1) % completionSuggestions.length,
          );
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          setSelectedCompletionIndex(
            (index) =>
              (index - 1 + completionSuggestions.length) %
              completionSuggestions.length,
          );
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setCompletionOpen(false);
          return;
        }
      }

      if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        event.stopPropagation();
        updateFontSize(terminalFontSize + 1);
        return;
      }
      if (event.key === "-") {
        event.preventDefault();
        event.stopPropagation();
        updateFontSize(terminalFontSize - 1);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        event.stopPropagation();
        updateFontSize(DEFAULT_TERMINAL_FONT_SIZE);
      }
    },
    [
      applyCompletion,
      completionOpen,
      completionSuggestions.length,
      selectedCompletion,
      terminalFontSize,
      updateFontSize,
    ],
  );

  useEffect(() => {
    terminalBackgroundRef.current = terminalBackground;
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = {
      ...terminal.options.theme,
      background: terminalBackground,
    };
  }, [terminalBackground]);

  useEffect(() => {
    terminalFontSizeRef.current = terminalFontSize;
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontSize = terminalFontSize;
    requestAnimationFrame(resizeToFit);
  }, [resizeToFit, terminalFontSize]);

  useEffect(() => {
    terminalLineHeightRef.current = terminalLineHeight;
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.lineHeight = terminalLineHeight / 100;
    requestAnimationFrame(resizeToFit);
  }, [resizeToFit, terminalLineHeight]);

  useEffect(() => {
    terminalCursorBlinkRef.current = terminalCursorBlink;
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.cursorBlink = terminalCursorBlink;
  }, [terminalCursorBlink]);

  useEffect(() => {
    terminalScrollbackRef.current = terminalScrollback;
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.scrollback = terminalScrollback;
  }, [terminalScrollback]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const host: HTMLElement = container;
    host.replaceChildren();

    let cancelled = false;
    let unlistenData: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;
    let terminalMount: HTMLDivElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let dataDisposable: IDisposable | null = null;
    let resizeDisposable: IDisposable | null = null;
    let cursorDisposable: IDisposable | null = null;
    let renderDisposable: IDisposable | null = null;
    let writeParsedDisposable: IDisposable | null = null;
    const existingSessionId = getTerminalSessionId(terminalTabId);
    if (!existingSessionId) {
      resetTerminalSessionState(terminalTabId);
    }

    const createTerminalMount = () => {
      const rect = host.getBoundingClientRect();
      const mount = document.createElement("div");
      mount.dataset.munixTerminalMount = "true";
      Object.assign(mount.style, {
        backgroundColor: "transparent",
        boxSizing: "border-box",
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
          backgroundColor: "transparent",
          height: "100%",
          left: "",
          padding: "0",
          position: "relative",
          top: "",
          visibility: "visible",
          width: "100%",
        });
        setReady(true);
        updateCompletionAnchor();
      });
    };

    const clearSurface = () => {
      try {
        terminalRef.current?.reset();
      } catch {
        // Terminal may already be disposed while React is tearing down.
      }
      terminalMount?.remove();
      terminalMount = null;
      host.replaceChildren();
    };

    async function start() {
      try {
        setReady(false);
        await loadTerminalFont(terminalFontSizeRef.current);
        if (cancelled) return;

        const terminal = new Terminal({
          allowProposedApi: true,
          allowTransparency: true,
          cursorBlink: terminalCursorBlinkRef.current,
          fontFamily: TERMINAL_FONT_FAMILY,
          fontSize: terminalFontSizeRef.current,
          lineHeight: terminalLineHeightRef.current / 100,
          letterSpacing: 0,
          scrollback: terminalScrollbackRef.current,
          smoothScrollDuration: 80,
          theme: {
            background: terminalBackgroundRef.current,
            foreground: "#d7dee2",
            cursor: "#5eead4",
            cursorAccent: "#071012",
            selectionBackground: "#155e59",
            selectionForeground: "#f8fafc",
            black: "#0c1012",
            red: "#f87171",
            green: "#4ade80",
            yellow: "#facc15",
            blue: "#60a5fa",
            magenta: "#c084fc",
            cyan: "#2dd4bf",
            white: "#d7dee2",
            brightBlack: "#74838a",
            brightRed: "#f87171",
            brightGreen: "#86efac",
            brightYellow: "#fde047",
            brightBlue: "#93c5fd",
            brightMagenta: "#d8b4fe",
            brightCyan: "#5eead4",
            brightWhite: "#ffffff",
          },
        });
        const fit = new FitAddon();

        terminal.loadAddon(fit);
        terminal.loadAddon(new WebLinksAddon());
        terminalMount = createTerminalMount();
        terminal.open(terminalMount);
        terminal.reset();
        fit.fit();

        terminalRef.current = terminal;
        fitRef.current = fit;
        resizeObserver = new ResizeObserver(() => resizeToFit());
        resizeObserver.observe(host);

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
        } else {
          revealTerminal(terminal);
        }

        if (existingSessionId) void ipc.terminalResize(session.id, cols, rows);
        dataDisposable = terminal.onData((data) => {
          const id = sessionIdRef.current;
          if (id) void ipc.terminalWrite(id, data);
          const previous = inputLineRef.current;
          if (data === "\r") {
            const command = previous.trim();
            if (command) {
              setCommandHistory((history) =>
                [command, ...history.filter((item) => item !== command)].slice(
                  0,
                  TERMINAL_HISTORY_LIMIT,
                ),
              );
            }
          }
          const next = updateInputLine(previous, data);
          if (next !== previous || data === "\r") {
            inputLineRef.current = next;
            setInputLine(next);
            setCompletionOpen(data !== "\r");
            requestAnimationFrame(updateCompletionAnchor);
          }
        });
        resizeDisposable = terminal.onResize(({ cols, rows }) => {
          const id = sessionIdRef.current;
          if (!id) return;
          resizeTerminalScreenState(terminalTabId, id, cols, rows);
          void ipc.terminalResize(id, cols, rows);
          updateCompletionAnchor();
        });
        cursorDisposable = terminal.onCursorMove(updateCompletionAnchor);
        renderDisposable = terminal.onRender(updateCompletionAnchor);
        writeParsedDisposable = terminal.onWriteParsed(updateCompletionAnchor);

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
            updateCompletionAnchor();
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
      dataDisposable?.dispose();
      resizeDisposable?.dispose();
      cursorDisposable?.dispose();
      renderDisposable?.dispose();
      writeParsedDisposable?.dispose();
      resizeObserver?.disconnect();
      resizeObserver = null;
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
  }, [
    resizeToFit,
    t,
    terminalTabId,
    updateCompletionAnchor,
    waitForSettledFit,
  ]);

  return (
    <div
      onKeyDownCapture={handleKeyDownCapture}
      onPointerDown={() => {
        if (completionPointerInsideRef.current) {
          completionPointerInsideRef.current = false;
          return;
        }
        if (completionSuggestions.length === 0) return;
        setCompletionOpen(false);
      }}
      className={cn(
        "munix-terminal-panel relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      {error ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--color-terminal-muted)]">
          {t("app:terminal.error")}
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden px-2 pb-2 pt-1.5">
          <div
            key={terminalTabId}
            ref={containerRef}
            data-munix-terminal-viewport="true"
            className={cn(
              "relative z-0 h-full min-h-0 overflow-hidden font-mono",
            )}
          />
          {!ready ? (
            <div className="pointer-events-none absolute inset-0 z-50 bg-[var(--color-terminal-bg)]" />
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2 bg-[var(--color-terminal-bg)]" />
          {ready ? (
            <TerminalCompletionPopup
              suggestions={completionSuggestions}
              selectedIndex={selectedCompletionIndex}
              anchor={completionAnchor}
              onPointerDownInside={() => {
                completionPointerInsideRef.current = true;
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
