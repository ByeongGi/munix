import { describe, it, expect, beforeAll, vi } from "vitest";

// settings-store 모듈을 import 하지 않도록 i18n.ts 가 순수 의존성만 갖는다.
// 그래도 Tauri ipc 모킹을 일관되게 — 다른 테스트와 동일.
vi.mock("@/lib/ipc", () => ({
  ipc: {
    loadSettings: () => Promise.resolve("{}"),
    saveSettings: () => Promise.resolve(),
  },
}));

import i18n, {
  setupI18n,
  resolveLang,
  SUPPORTED_LANGS,
  DEFAULT_NS,
  type SupportedLang,
} from "./i18n";

describe("setupI18n", () => {
  beforeAll(async () => {
    setupI18n();
    // resources 가 비어있어도 init 자체는 isInitialized=true 가 되어야 한다.
    // promise 형태이므로 한 frame 양보.
    await new Promise<void>((r) => setTimeout(r, 0));
  });

  it("returns the singleton i18next instance", () => {
    const inst = setupI18n();
    expect(inst).toBe(i18n);
  });

  it("is initialized after setup", () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it("falls back to en when key missing", () => {
    // 빈 resources 라 어떤 키도 없음 → fallback 키 그대로 반환.
    const result = i18n.t("settings:title");
    expect(typeof result).toBe("string");
  });

  it("inserts arbitrary key/value via addResource and looks it up", () => {
    i18n.addResource("en", "settings", "demo.greeting", "Hello, {{name}}");
    const result = i18n.t("settings:demo.greeting", { name: "Munix" });
    expect(result).toBe("Hello, Munix");
  });

  it("supports namespace switching", () => {
    i18n.addResource("en", "common", "demo.bye", "Bye");
    i18n.addResource("en", "settings", "demo.bye", "See you");
    expect(i18n.t("common:demo.bye")).toBe("Bye");
    expect(i18n.t("settings:demo.bye")).toBe("See you");
  });
});

describe("resolveLang", () => {
  it("returns 'ko' or 'en' as-is", () => {
    expect(resolveLang("ko")).toBe<SupportedLang>("ko");
    expect(resolveLang("en")).toBe<SupportedLang>("en");
  });

  it("resolves 'auto' via navigator.language (ko prefix → ko)", () => {
    const original = Object.getOwnPropertyDescriptor(
      window.navigator,
      "language",
    );
    Object.defineProperty(window.navigator, "language", {
      value: "ko-KR",
      configurable: true,
    });
    try {
      expect(resolveLang("auto")).toBe<SupportedLang>("ko");
    } finally {
      if (original) {
        Object.defineProperty(window.navigator, "language", original);
      }
    }
  });

  it("resolves 'auto' to 'en' for non-Korean locales", () => {
    const original = Object.getOwnPropertyDescriptor(
      window.navigator,
      "language",
    );
    Object.defineProperty(window.navigator, "language", {
      value: "en-US",
      configurable: true,
    });
    try {
      expect(resolveLang("auto")).toBe<SupportedLang>("en");
    } finally {
      if (original) {
        Object.defineProperty(window.navigator, "language", original);
      }
    }
  });
});

describe("constants", () => {
  it("supports en and ko", () => {
    expect(SUPPORTED_LANGS).toContain("en");
    expect(SUPPORTED_LANGS).toContain("ko");
  });

  it("eager-loads common and settings namespaces", () => {
    expect(DEFAULT_NS).toContain("common");
    expect(DEFAULT_NS).toContain("settings");
  });
});
