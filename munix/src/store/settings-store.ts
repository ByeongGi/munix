import { create } from "zustand";
import { ipc } from "@/lib/ipc";
import { useVaultDockStore } from "@/store/vault-dock-store";

export type FontSize = "sm" | "base" | "lg" | "xl";
export type EditorWidth = "narrow" | "default" | "wide" | "full";
export type AutoSaveDebounceMs = 500 | 750 | 1500 | 3000;

/**
 * vault scope override 가능한 항목 (ADR-031 C-3).
 *
 * 글로벌 only 항목은 의도적으로 제외:
 * - `language` / `keymapOverrides` / `customCss` — vault 마다 다를 이유가 없음
 *
 * vault override 값은 글로벌을 덮어쓴다 — `effectiveSetting = vault ?? global`.
 */
export type VaultOverrideKey = "fontSize" | "editorWidth" | "autoSaveDebounceMs";

export type VaultSettingsOverride = Partial<
  Pick<Settings, VaultOverrideKey>
>;

export const VAULT_OVERRIDE_KEYS: VaultOverrideKey[] = [
  "fontSize",
  "editorWidth",
  "autoSaveDebounceMs",
];
/**
 * UI 표시 언어 설정.
 * - `'auto'` (기본): OS 시스템 언어 자동 감지
 * - `'ko'` / `'en'`: 사용자가 명시 지정
 *
 * i18next lng 와 분리되어 있다 — `'auto'` 는 detection 결과를, `'ko'/'en'` 은
 * 그대로 changeLanguage() 에 전달.
 */
export type Language = "auto" | "ko" | "en";

const VALID_LANGUAGES: Language[] = ["auto", "ko", "en"];

export interface Settings {
  fontSize: FontSize;
  editorWidth: EditorWidth;
  autoSaveDebounceMs: AutoSaveDebounceMs;
  /** 사용자 커스텀 CSS — head에 <style id="munix-user-css">로 주입. */
  customCss: string;
  /**
   * 사용자 정의 단축키 override.
   * `id → 정규화된 키 문자열` (예: `{ "global.save": "mod+alt+s" }`).
   * - 빈 객체이면 모두 default 사용.
   * - id 가 등록되지 않은 entry 는 lookup 시 무시됨 (registry 변경 안전).
   * - 값이 빈 문자열이면 "비활성화" — 현재 UI 는 노출 안 함.
   */
  keymapOverrides: Record<string, string>;
  /**
   * UI 표시 언어. 기본 `'auto'` — 시스템 언어 따라감.
   * 자세한 설계는 `specs/i18n-spec.md` 참조.
   */
  language: Language;
}

const KEY = "munix:settings";
const USER_CSS_STYLE_ID = "munix-user-css";
const MAX_CUSTOM_CSS_LENGTH = 50_000;
const MAX_KEYMAP_OVERRIDES = 200;

const VALID_DEBOUNCE: AutoSaveDebounceMs[] = [500, 750, 1500, 3000];

const DEFAULTS: Settings = {
  fontSize: "base",
  editorWidth: "default",
  autoSaveDebounceMs: 750,
  customCss: "",
  keymapOverrides: {},
  language: "auto",
};

const FONT_SIZE_PX: Record<FontSize, string> = {
  sm: "14px",
  base: "16px",
  lg: "18px",
  xl: "20px",
};

const EDITOR_WIDTH_PX: Record<EditorWidth, string> = {
  narrow: "640px",
  default: "768px",
  wide: "960px",
  full: "100%",
};

function normalizeOverrides(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_KEYMAP_OVERRIDES) break;
    if (typeof k !== "string" || typeof v !== "string") continue;
    // 너무 긴 값은 안전장치로 거부 (사용자 손편집 방어).
    if (v.length > 64) continue;
    out[k] = v;
    count += 1;
  }
  return out;
}

function normalize(parsed: unknown): Settings {
  if (!parsed || typeof parsed !== "object") return { ...DEFAULTS };
  const merged = { ...DEFAULTS, ...(parsed as Partial<Settings>) };
  if (!VALID_DEBOUNCE.includes(merged.autoSaveDebounceMs)) {
    merged.autoSaveDebounceMs = DEFAULTS.autoSaveDebounceMs;
  }
  if (typeof merged.customCss !== "string") {
    merged.customCss = DEFAULTS.customCss;
  } else if (merged.customCss.length > MAX_CUSTOM_CSS_LENGTH) {
    merged.customCss = merged.customCss.slice(0, MAX_CUSTOM_CSS_LENGTH);
  }
  merged.keymapOverrides = normalizeOverrides(merged.keymapOverrides);
  if (!VALID_LANGUAGES.includes(merged.language)) {
    merged.language = DEFAULTS.language;
  }
  return merged;
}

/** localStorage에서 동기 read — FOUC 방지용 초기 부트스트랩에만 사용. */
function readLocal(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

/** localStorage 영속화 — Rust 실패 시 fallback 안전망. */
function persistLocal(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

/** Rust로 fire-and-forget 영속화. 실패 시 warn만. */
function persistRust(s: Settings): void {
  void ipc.saveSettings(JSON.stringify(s)).catch((e) => {
    console.warn("[settings] saveSettings failed:", e);
  });
}

function applyUserCss(css: string): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById(
    USER_CSS_STYLE_ID,
  ) as HTMLStyleElement | null;
  if (!css.trim()) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = USER_CSS_STYLE_ID;
    // body 끝에 두면 다른 stylesheet보다 나중에 적용 (override)
    document.head.appendChild(style);
  }
  // textContent는 자동 escape됨 → script 태그도 string 그대로 들어가지만 <style>은 CSS로 파싱.
  // 사용자가 self-injection으로 임의 코드 실행은 불가 (CSS만 해석).
  style.textContent = css;
}

function apply(s: Settings): void {
  const root = document.documentElement;
  root.style.setProperty("--editor-font-size", FONT_SIZE_PX[s.fontSize]);
  root.style.setProperty("--editor-max-width", EDITOR_WIDTH_PX[s.editorWidth]);
  applyUserCss(s.customCss);
}

interface SettingsStore extends Settings {
  /** 활성 vault 의 override (있는 키만). vault 전환 시 자동 swap. */
  vaultOverride: VaultSettingsOverride;
  /** 글로벌 settings 의 raw 값 (override 적용 전). UI 가 글로벌/override 비교용. */
  globalSettings: Settings;

  set: (partial: Partial<Settings>) => void;
  reset: () => void;
  /** vault override 1+ 항목 set. 활성 vault 가 없으면 no-op. */
  setVaultOverride: (partial: VaultSettingsOverride) => void;
  /** override 의 한 키 제거 → 그 항목은 글로벌 fallback. */
  clearVaultOverride: (key: VaultOverrideKey) => void;
}

function effective(global: Settings, override: VaultSettingsOverride): Settings {
  return { ...global, ...override };
}

function persistVaultOverride(
  vaultId: string | null,
  override: VaultSettingsOverride,
): void {
  if (!vaultId) return;
  void ipc.vaultSettingsSave(JSON.stringify(override), vaultId).catch((e) => {
    console.warn("[settings] vaultSettingsSave failed:", e);
  });
}

export const useSettingsStore = create<SettingsStore>((setState, get) => {
  const initial = readLocal();
  return {
    ...initial,
    globalSettings: initial,
    vaultOverride: {},

    set: (partial) => {
      const cur = get();
      const nextGlobal = { ...cur.globalSettings, ...partial } as Settings;
      const nextEff = effective(nextGlobal, cur.vaultOverride);
      apply(nextEff);
      persistLocal(nextGlobal);
      persistRust(nextGlobal);
      setState({
        ...nextEff,
        globalSettings: nextGlobal,
      } as Partial<SettingsStore>);
    },

    reset: () => {
      const nextEff = effective(DEFAULTS, get().vaultOverride);
      apply(nextEff);
      persistLocal(DEFAULTS);
      persistRust(DEFAULTS);
      setState({
        ...nextEff,
        globalSettings: DEFAULTS,
      } as Partial<SettingsStore>);
    },

    setVaultOverride: (partial) => {
      const vaultId = useVaultDockStore.getState().activeVaultId;
      if (!vaultId) return;
      const cur = get();
      const nextOverride: VaultSettingsOverride = {
        ...cur.vaultOverride,
        ...partial,
      };
      const nextEff = effective(cur.globalSettings, nextOverride);
      apply(nextEff);
      persistVaultOverride(vaultId, nextOverride);
      setState({
        ...nextEff,
        vaultOverride: nextOverride,
      } as Partial<SettingsStore>);
    },

    clearVaultOverride: (key) => {
      const vaultId = useVaultDockStore.getState().activeVaultId;
      if (!vaultId) return;
      const cur = get();
      const nextOverride: VaultSettingsOverride = { ...cur.vaultOverride };
      delete nextOverride[key];
      const nextEff = effective(cur.globalSettings, nextOverride);
      apply(nextEff);
      persistVaultOverride(vaultId, nextOverride);
      setState({
        ...nextEff,
        vaultOverride: nextOverride,
      } as Partial<SettingsStore>);
    },
  };
});

// 초기 적용 (React 마운트 전, FOUC 방지) — localStorage 값 기준.
apply(readLocal());

/**
 * Rust `app_config_dir/settings.json` 에서 비동기로 한 번 더 로드한다.
 * - 결과가 빈 객체 (`{}`) 면 → 마이그레이션: 현재 localStorage 값을 즉시 Rust로 push.
 * - 비어있지 않으면 → store 갱신 + apply (Rust 가 master).
 * - Rust 호출 실패 시 → console.warn 후 localStorage fallback 그대로 유지.
 */
function bootstrapFromRust(): void {
  void ipc
    .loadSettings()
    .then((raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.warn("[settings] Rust returned invalid JSON, ignoring:", e);
        return;
      }

      const isEmpty =
        parsed !== null &&
        typeof parsed === "object" &&
        Object.keys(parsed as Record<string, unknown>).length === 0;

      if (isEmpty) {
        // 마이그레이션 1회: 현재 in-memory 값을 Rust로 한 번 밀어넣는다.
        const current = useSettingsStore.getState();
        const snapshot: Settings = {
          fontSize: current.fontSize,
          editorWidth: current.editorWidth,
          autoSaveDebounceMs: current.autoSaveDebounceMs,
          customCss: current.customCss,
          keymapOverrides: current.keymapOverrides,
          language: current.language,
        };
        persistRust(snapshot);
        return;
      }

      const next = normalize(parsed);
      apply(next);
      // Rust 값이 master라 localStorage 도 동기화 (다음 부팅 FOUC 일관성).
      persistLocal(next);
      useSettingsStore.setState(next);
    })
    .catch((e) => {
      console.warn("[settings] loadSettings failed, using localStorage:", e);
    });
}

bootstrapFromRust();

/**
 * Vault 전환 시 그 vault 의 `.munix/settings.json` 자동 load → vaultOverride 갱신.
 * 활성 vault 가 없으면 override 비움 (effective 는 글로벌만).
 *
 * 빈 객체 / 알 수 없는 키는 normalize 단계에서 무시. fontSize 등 enum 값이
 * spec 외라면 그 키는 적용 안 함.
 */
function normalizeVaultOverride(raw: unknown): VaultSettingsOverride {
  if (!raw || typeof raw !== "object") return {};
  const out: VaultSettingsOverride = {};
  const obj = raw as Record<string, unknown>;
  if (
    obj.fontSize === "sm" ||
    obj.fontSize === "base" ||
    obj.fontSize === "lg" ||
    obj.fontSize === "xl"
  ) {
    out.fontSize = obj.fontSize;
  }
  if (
    obj.editorWidth === "narrow" ||
    obj.editorWidth === "default" ||
    obj.editorWidth === "wide" ||
    obj.editorWidth === "full"
  ) {
    out.editorWidth = obj.editorWidth;
  }
  if (
    obj.autoSaveDebounceMs === 500 ||
    obj.autoSaveDebounceMs === 750 ||
    obj.autoSaveDebounceMs === 1500 ||
    obj.autoSaveDebounceMs === 3000
  ) {
    out.autoSaveDebounceMs = obj.autoSaveDebounceMs;
  }
  return out;
}

async function loadVaultOverride(
  vaultId: string,
): Promise<VaultSettingsOverride> {
  try {
    const raw = await ipc.vaultSettingsLoad(vaultId);
    if (!raw) return {};
    return normalizeVaultOverride(JSON.parse(raw));
  } catch (e) {
    console.warn("[settings] vaultSettingsLoad failed:", e);
    return {};
  }
}

function applyOverrideToStore(override: VaultSettingsOverride): void {
  const cur = useSettingsStore.getState();
  const nextEff = { ...cur.globalSettings, ...override } as Settings;
  apply(nextEff);
  useSettingsStore.setState({
    ...nextEff,
    vaultOverride: override,
  } as Partial<SettingsStore>);
}

let lastVaultId: string | null = null;
useVaultDockStore.subscribe((state) => {
  const vaultId = state.activeVaultId;
  if (vaultId === lastVaultId) return;
  lastVaultId = vaultId;
  if (!vaultId) {
    applyOverrideToStore({});
    return;
  }
  void loadVaultOverride(vaultId).then(applyOverrideToStore);
});

// 부팅 시 1회: 이미 active vault 가 있다면 override 로드.
{
  const initialId = useVaultDockStore.getState().activeVaultId;
  if (initialId) {
    lastVaultId = initialId;
    void loadVaultOverride(initialId).then(applyOverrideToStore);
  }
}
