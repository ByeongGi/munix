import { ipc } from "@/lib/ipc";

const terminalSessionsByTabId = new Map<string, string>();

export function getTerminalSessionId(tabId: string): string | null {
  return terminalSessionsByTabId.get(tabId) ?? null;
}

export function setTerminalSessionId(tabId: string, sessionId: string): void {
  terminalSessionsByTabId.set(tabId, sessionId);
}

export function closeTerminalSessionForTab(tabId: string): void {
  const sessionId = terminalSessionsByTabId.get(tabId);
  if (!sessionId) return;
  terminalSessionsByTabId.delete(tabId);
  void ipc.terminalKill(sessionId);
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
