import { describe, expect, it } from "vitest";
import {
  normalizeTerminalInputData,
  TERMINAL_DELETE,
  updateTerminalInputLine,
} from "./terminal-input";

describe("terminal input helpers", () => {
  it("normalizes BS to DEL for shell erase compatibility", () => {
    expect(normalizeTerminalInputData("\u0008")).toBe(TERMINAL_DELETE);
  });

  it("removes the previous input character for both DEL and BS", () => {
    expect(updateTerminalInputLine("abc", TERMINAL_DELETE)).toBe("ab");
    expect(updateTerminalInputLine("abc", "\u0008")).toBe("ab");
  });

  it("does not treat Backspace erase sequences as printable spaces", () => {
    expect(updateTerminalInputLine("abc", "\u0008")).not.toBe("abc ");
  });
});
