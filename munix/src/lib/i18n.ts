/**
 * i18n 셋업 — i18next + react-i18next 기반.
 *
 * - 지원 언어: `en`, `ko` (확장 가능)
 * - eager namespace: `common`, `settings` — 첫 페인트에 필요
 * - 그 외 namespace 는 `useTranslation('editor')` 등으로 lazy 로드
 *
 * 사용자 언어 결정 우선순위 (`detection.order`):
 * 1. `localStorage('munix-language')` — 사용자가 명시 지정한 값
 * 2. `navigator.language` — OS 시스템 언어
 * 3. `fallbackLng = 'en'` — 위 모두 실패 시
 *
 * **동기**: settings-store 의 `language: 'auto' | 'ko' | 'en'` 와 분리되어 있다.
 * - `'auto'`: detection 결과 그대로 사용
 * - `'ko'` / `'en'`: 명시 override (`changeLanguage()` 로 직접 적용)
 *
 * 자세한 설계는 `specs/i18n-spec.md` 참조.
 */

import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

export const SUPPORTED_LANGS = ["en", "ko"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export type Language = "auto" | SupportedLang;

/** 첫 페인트에 필요한 namespace — eager load. */
export const DEFAULT_NS = ["common", "settings"] as const;

const LANGUAGE_STORAGE_KEY = "munix-language";

/** 사용자 설정 (`'auto' | 'ko' | 'en'`) → 실제 i18next lng 값. */
export function resolveLang(setting: Language): SupportedLang {
  if (setting === "ko" || setting === "en") return setting;
  // 'auto': 브라우저 언어 기반 (한국어 prefix 면 ko, 그 외 en).
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
  }
  return "en";
}

/**
 * i18next 인스턴스 생성. SSR/HMR 안전: 이미 init 된 경우 그대로 재사용.
 *
 * 테스트 환경 (`NODE_ENV === 'test'`) 에서는 backend / detector 없이
 * inline resources 로 init 한다 — 네트워크 의존 없음.
 */
export function setupI18n(): I18nInstance {
  if (i18next.isInitialized) return i18next;

  const isTest =
    typeof process !== "undefined" && process.env?.NODE_ENV === "test";

  if (isTest) {
    void i18next.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LANGS as unknown as string[],
      ns: DEFAULT_NS as unknown as string[],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      resources: {
        en: { common: {}, settings: {} },
        ko: { common: {}, settings: {} },
      },
    });
    return i18next;
  }

  void i18next
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LANGS as unknown as string[],
      ns: DEFAULT_NS as unknown as string[],
      defaultNS: "common",
      load: "languageOnly",
      interpolation: { escapeValue: false },
      backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      },
      react: {
        useSuspense: false,
      },
    });

  return i18next;
}

export default i18next;
