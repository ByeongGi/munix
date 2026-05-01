const TERMINAL_BACKSPACE = "\u0008";
export const TERMINAL_DELETE = "\u007f";

function isPrintableInput(data: string): boolean {
  return /^[\x20-\x7e]+$/.test(data);
}

export function normalizeTerminalInputData(data: string): string {
  if (data === TERMINAL_BACKSPACE) return TERMINAL_DELETE;
  return data;
}

export function updateTerminalInputLine(current: string, rawData: string): string {
  const data = normalizeTerminalInputData(rawData);
  if (data === "\r") return "";
  if (data === "\u0003") return "";
  if (data === "\u0015") return "";
  if (data === TERMINAL_DELETE) return current.slice(0, -1);
  if (data === "\u0017") return current.replace(/\s*\S+$/, "");
  if (data === "\u0001" || data === "\u0005") return current;
  if (data.startsWith("\u001b")) return current;
  if (isPrintableInput(data)) return `${current}${data}`;
  return current;
}
