import { SerializeAddon } from "@xterm/addon-serialize";
import { Terminal as HeadlessTerminal } from "@xterm/headless";
import { ipc } from "@/lib/ipc";

const terminalSessionsByTabId = new Map<string, string>();
const exitedTerminalTabIds = new Set<string>();

interface TerminalScreenState {
  sessionId: string;
  terminal: HeadlessTerminal;
  serializeAddon: SerializeAddon;
}

const terminalScreenStatesByTabId = new Map<string, TerminalScreenState>();

function createTerminalScreenState(
  sessionId: string,
  cols: number,
  rows: number,
): TerminalScreenState {
  const terminal = new HeadlessTerminal({
    allowProposedApi: true,
    cols,
    rows,
    scrollback: 10000,
  });
  const serializeAddon = new SerializeAddon();
  terminal.loadAddon(serializeAddon);
  return { sessionId, terminal, serializeAddon };
}

function disposeTerminalScreenState(tabId: string): void {
  const state = terminalScreenStatesByTabId.get(tabId);
  if (!state) return;
  state.serializeAddon.dispose();
  state.terminal.dispose();
  terminalScreenStatesByTabId.delete(tabId);
}

export function getTerminalSessionId(tabId: string): string | null {
  return terminalSessionsByTabId.get(tabId) ?? null;
}

export function setTerminalSessionId(
  tabId: string,
  sessionId: string,
  cols: number,
  rows: number,
): void {
  exitedTerminalTabIds.delete(tabId);
  disposeTerminalScreenState(tabId);
  terminalSessionsByTabId.set(tabId, sessionId);
  terminalScreenStatesByTabId.set(
    tabId,
    createTerminalScreenState(sessionId, cols, rows),
  );
}

export function hasTerminalExited(tabId: string): boolean {
  return exitedTerminalTabIds.has(tabId);
}

export function markTerminalSessionExited(
  tabId: string,
  sessionId: string,
): void {
  if (terminalSessionsByTabId.get(tabId) !== sessionId) return;
  terminalSessionsByTabId.delete(tabId);
  disposeTerminalScreenState(tabId);
  exitedTerminalTabIds.add(tabId);
  void ipc.terminalKill(sessionId).catch(() => {});
}

export function clearTerminalScreenState(tabId: string): void {
  disposeTerminalScreenState(tabId);
}

export function resetTerminalSessionState(tabId: string): void {
  terminalSessionsByTabId.delete(tabId);
  disposeTerminalScreenState(tabId);
  exitedTerminalTabIds.delete(tabId);
}

export function ensureTerminalScreenState(
  tabId: string,
  sessionId: string,
  cols: number,
  rows: number,
): void {
  if (exitedTerminalTabIds.has(tabId)) return;
  if (terminalSessionsByTabId.get(tabId) !== sessionId) return;
  const existing = terminalScreenStatesByTabId.get(tabId);
  if (existing?.sessionId === sessionId) return;
  disposeTerminalScreenState(tabId);
  terminalScreenStatesByTabId.set(
    tabId,
    createTerminalScreenState(sessionId, cols, rows),
  );
}

export function appendTerminalOutputToScreenState(
  tabId: string,
  sessionId: string,
  data: string,
): void {
  if (exitedTerminalTabIds.has(tabId)) return;
  if (terminalSessionsByTabId.get(tabId) !== sessionId) return;
  const state = terminalScreenStatesByTabId.get(tabId);
  if (state?.sessionId !== sessionId) return;
  state.terminal.write(data);
}

export function resizeTerminalScreenState(
  tabId: string,
  sessionId: string,
  cols: number,
  rows: number,
): void {
  const state = terminalScreenStatesByTabId.get(tabId);
  if (state?.sessionId !== sessionId) return;
  state.terminal.resize(cols, rows);
}

export function getTerminalScreenState(tabId: string, sessionId: string): string {
  const state = terminalScreenStatesByTabId.get(tabId);
  if (state?.sessionId !== sessionId) return "";
  return state.serializeAddon.serialize();
}

export function closeTerminalSessionForTab(tabId: string): void {
  const sessionId = terminalSessionsByTabId.get(tabId);
  disposeTerminalScreenState(tabId);
  exitedTerminalTabIds.delete(tabId);
  if (!sessionId) return;
  terminalSessionsByTabId.delete(tabId);
  void ipc.terminalKill(sessionId).catch(() => {});
}

export function closeTerminalSessionsForTabs(
  tabs: { id: string; kind?: string }[],
): void {
  for (const tab of tabs) {
    if (tab.kind === "terminal") {
      closeTerminalSessionForTab(tab.id);
    }
  }
}
