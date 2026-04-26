import { describe, it, expect } from "vitest";
import {
  parseKeymap,
  serializeKeymap,
  normalizeKeymap,
  keymapsEqual,
  eventToKeymap,
  formatKeymap,
  isCompleteKeymap,
} from "./keymap-format";

describe("parseKeymap", () => {
  it("parses canonical form", () => {
    const r = parseKeymap("mod+shift+k");
    expect(r).not.toBeNull();
    expect(r?.modifiers.has("mod")).toBe(true);
    expect(r?.modifiers.has("shift")).toBe(true);
    expect(r?.key).toBe("k");
  });

  it("normalizes aliases", () => {
    const r = parseKeymap("Cmd+Option+Up");
    expect(r?.modifiers.has("mod")).toBe(true);
    expect(r?.modifiers.has("alt")).toBe(true);
    expect(r?.key).toBe("arrowup");
  });

  it("returns null for empty", () => {
    expect(parseKeymap("")).toBeNull();
  });

  it("returns null when no main key", () => {
    expect(parseKeymap("mod+shift")).toBeNull();
  });
});

describe("serializeKeymap", () => {
  it("orders modifiers mod-alt-shift", () => {
    const out = serializeKeymap(new Set(["shift", "mod", "alt"]), "k");
    expect(out).toBe("mod+alt+shift+k");
  });

  it("normalizes main key", () => {
    const out = serializeKeymap(new Set(["mod"]), "Up");
    expect(out).toBe("mod+arrowup");
  });
});

describe("normalizeKeymap", () => {
  it("re-serializes regardless of order/case", () => {
    expect(normalizeKeymap("Shift+Mod+K")).toBe("mod+shift+k");
    expect(normalizeKeymap("CTRL+,")).toBe("mod+,");
  });
});

describe("keymapsEqual", () => {
  it("compares with order tolerance", () => {
    expect(keymapsEqual("mod+shift+k", "Shift+Mod+K")).toBe(true);
    expect(keymapsEqual("mod+s", "mod+S")).toBe(true);
    expect(keymapsEqual("mod+s", "mod+shift+s")).toBe(false);
  });
});

describe("eventToKeymap", () => {
  function ev(opts: Partial<KeyboardEventInit & { key: string }>): KeyboardEvent {
    // jsdom 의 KeyboardEvent 는 metaKey/ctrlKey 등 init 그대로 받는다.
    return new KeyboardEvent("keydown", opts);
  }

  it("converts mod+s", () => {
    expect(eventToKeymap(ev({ key: "s", metaKey: true }))).toBe("mod+s");
    expect(eventToKeymap(ev({ key: "s", ctrlKey: true }))).toBe("mod+s");
  });

  it("returns null on modifier-only", () => {
    expect(eventToKeymap(ev({ key: "Shift", shiftKey: true }))).toBeNull();
    expect(eventToKeymap(ev({ key: "Meta", metaKey: true }))).toBeNull();
  });

  it("preserves comma/slash", () => {
    expect(eventToKeymap(ev({ key: ",", metaKey: true }))).toBe("mod+,");
    expect(eventToKeymap(ev({ key: "/", metaKey: true }))).toBe("mod+/");
  });

  it("normalizes function keys", () => {
    expect(eventToKeymap(ev({ key: "F2" }))).toBe("f2");
  });

  it("orders modifiers consistently", () => {
    expect(eventToKeymap(ev({ key: "k", shiftKey: true, metaKey: true }))).toBe(
      "mod+shift+k",
    );
  });
});

describe("formatKeymap", () => {
  it("mac display", () => {
    expect(formatKeymap("mod+shift+k", { mac: true })).toBe("⌘⇧K");
    expect(formatKeymap("mod+,", { mac: true })).toBe("⌘,");
  });

  it("non-mac display", () => {
    expect(formatKeymap("mod+shift+k", { mac: false })).toBe("Ctrl+Shift+K");
    expect(formatKeymap("alt+arrowup", { mac: false })).toBe("Alt+↑");
  });

  it("function key uppercase", () => {
    expect(formatKeymap("f2", { mac: true })).toBe("F2");
  });
});

describe("isCompleteKeymap", () => {
  it("requires main key", () => {
    expect(isCompleteKeymap("mod+s")).toBe(true);
    expect(isCompleteKeymap("mod")).toBe(false);
    expect(isCompleteKeymap("")).toBe(false);
  });
});
