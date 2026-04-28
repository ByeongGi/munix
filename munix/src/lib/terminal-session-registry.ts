import { ipc } from "@/lib/ipc";

const TERMINAL_OUTPUT_BUFFER_LIMIT = 200_000;

const terminalSessionsByTabId = new Map<string, string>();
const terminalOutputByTabId = new Map<string, string>();
const exitedTerminalTabIds = new Set<string>();

export function getTerminalSessionId(tabId: string): string | null {
  return terminalSessionsByTabId.get(tabId) ?? null;
}

export function setTerminalSessionId(tabId: string, sessionId: string): void {
  exitedTerminalTabIds.delete(tabId);
  terminalSessionsByTabId.set(tabId, sessionId);
}

export function hasTerminalExited(tabId: string): boolean {
  return exitedTerminalTabIds.has(tabId);
}

export function markTerminalSessionExited(tabId: string): void {
  const sessionId = terminalSessionsByTabId.get(tabId);
  terminalSessionsByTabId.delete(tabId);
  exitedTerminalTabIds.add(tabId);
  if (sessionId) void ipc.terminalKill(sessionId).catch(() => {});
}

export function appendTerminalOutput(tabId: string, data: string): void {
  const next = `${terminalOutputByTabId.get(tabId) ?? ""}${data}`;
  terminalOutputByTabId.set(
    tabId,
    next.length > TERMINAL_OUTPUT_BUFFER_LIMIT
      ? next.slice(next.length - TERMINAL_OUTPUT_BUFFER_LIMIT)
      : next,
  );
}

export function getTerminalOutput(tabId: string): string {
  return terminalOutputByTabId.get(tabId) ?? "";
}

export function closeTerminalSessionForTab(tabId: string): void {
  const sessionId = terminalSessionsByTabId.get(tabId);
  terminalOutputByTabId.delete(tabId);
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
