# i18n 상세 설계 — Munix

> 상태: **초안 (proposed)**. [ADR-025](../decisions.md#adr-025-다국어-지원-i18next--react-i18next) 채택 후 확정.
> 영어/한국어 시작, i18next 기반. 점진적 마이그레이션.

---

## 1. 목적

- 영어권 사용자 진입장벽 제거 (MIT 오픈소스 배포)
- 한국어 베이스 + 사용자 언어 선택
- settings-dialog UX 강화 흐름의 일환 (단축키 UI와 함께)

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| I18N-01 | 영어/한국어 두 언어 지원 (확장 가능) | P0 |
| I18N-02 | 사용자 언어 선택 UI (settings → 모양 또는 언어 섹션) | P0 |
| I18N-03 | 시스템 언어 자동 감지 (`auto` 기본값) | P0 |
| I18N-04 | 키 기반 번역 (`t('settings.title')`) | P0 |
| I18N-05 | namespace 분리 (common/settings/editor 등) | P0 |
| I18N-06 | 변수 보간 (`t('greeting', { name })`) | P0 |
| I18N-07 | fallback 언어 (영어 fallback) | P0 |
| I18N-08 | Pluralization (단/복수, 한국어는 동일) | P1 |
| I18N-09 | 동적 로드 (namespace 단위 lazy) | P1 |
| I18N-10 | 날짜/숫자/상대시간 포맷 (Intl API + i18next) | P1 |
| I18N-11 | 번역 추출 도구 (i18next-parser) | P2 |
| I18N-12 | TypeScript 키 자동완성 (declaration merging) | P2 |
| I18N-13 | RTL 언어 (히브리어/아랍어) | P3 (v1.2+) |

### 2.2 비기능 요구사항

- 첫 페인트 추가 지연 < 50ms (lazy load 시 영어 fallback 즉시)
- 번들 크기 추가 < 30KB (i18next + react-i18next + 영/한 베이스)
- 번역 누락 시 dev 경고 + prod 키 표시 (영어 fallback 우선)
- 언어 전환 즉시 반영 (재시작 불필요)

---

## 3. 데이터 모델

### 3.1 번역 파일 구조

```
munix/public/locales/
├── en/
│   ├── common.json          # 공통 (취소/확인/닫기/삭제 등)
│   ├── settings.json        # 설정 다이얼로그
│   ├── editor.json          # 에디터 + 슬래시 메뉴
│   ├── vault.json           # vault 열기/이동
│   ├── search.json          # 검색 패널
│   ├── palette.json         # 명령 팔레트
│   └── tabs.json            # 탭 시스템
└── ko/
    └── (동일 구조)
```

**JSON 예**:

```json
// settings.json (en)
{
  "title": "Settings",
  "section": {
    "appearance": "Appearance",
    "editor": "Editor",
    "shortcuts": "Shortcuts",
    "language": "Language",
    "advanced": "Advanced",
    "about": "About"
  },
  "language": {
    "title": "Language",
    "description": "Choose the display language. 'System' follows your OS setting.",
    "auto": "System",
    "ko": "한국어",
    "en": "English"
  }
}
```

### 3.2 Settings 확장

```ts
type Language = 'auto' | 'ko' | 'en';

interface Settings {
  // ... 기존 필드 (theme, fontSize, editorMaxWidth, keymapOverrides 등)
  language: Language;  // 기본 'auto'
}
```

**마이그레이션**: 필드 부재 시 기본값 `'auto'`. `normalizeSettings()`에서 `Language` 외 값은 `'auto'`로 강제.

### 3.3 i18n 초기화

실제 구현은 `setupI18n()` 함수로 감싸 idempotent 하게 init 한다. 테스트 환경에서는 network backend / detector 없이 inline resources 로 init (vitest 의존성 회피).

```ts
// src/lib/i18n.ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGS = ['en', 'ko'] as const;
export const DEFAULT_NS = ['common', 'settings'] as const;

export function setupI18n(): typeof i18next {
  if (i18next.isInitialized) return i18next;
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  if (isTest) {
    void i18next.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      ns: DEFAULT_NS as unknown as string[],
      defaultNS: 'common',
      resources: { en: { common: {}, settings: {} }, ko: { common: {}, settings: {} } },
      interpolation: { escapeValue: false },
    });
    return i18next;
  }

  void i18next
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LANGS as unknown as string[],
      ns: DEFAULT_NS as unknown as string[],
      defaultNS: 'common',
      load: 'languageOnly',
      interpolation: { escapeValue: false },
      backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'munix-language',
      },
      react: { useSuspense: false },
    });

  return i18next;
}
```

`main.tsx` 에서 `setupI18n()` 호출 + `useSettingsStore.subscribe` 로 `language` 변경 구독 → `i18next.changeLanguage(resolveLang(setting))`. `resolveLang('auto')` 는 `navigator.language` 기반 (한국어 prefix → ko, 그 외 en).

---

## 4. API/인터페이스

### 4.1 번역 사용

```tsx
import { useTranslation } from 'react-i18next';

function SettingsDialog() {
  const { t } = useTranslation('settings');
  return <h1>{t('title')}</h1>;
}

// 변수 보간
t('greeting', { name: 'Alex' });

// Pluralization
t('items', { count: 3 });

// 다른 namespace
const { t } = useTranslation(['settings', 'common']);
t('settings:language.title');
t('common:cancel');
```

### 4.2 언어 전환

```ts
// settings-store와 동기
import i18next from '@/lib/i18n';

const setLanguage = (lang: Language) => {
  setSettings({ language: lang });
  const target = lang === 'auto'
    ? (navigator.language.startsWith('ko') ? 'ko' : 'en')
    : lang;
  i18next.changeLanguage(target);
};
```

### 4.3 namespace 동적 로드

```tsx
const { t, ready } = useTranslation('editor', { useSuspense: false });
if (!ready) return <Spinner />;
return <div>{t('placeholder')}</div>;
```

---

## 5. UI/UX 플로우

### 5.1 첫 실행

1. `settings.language` 부재 → `'auto'` 기본값
2. `i18next-browser-languagedetector` → `localStorage('munix-language')` 또는 `navigator.language`
3. 매칭: `ko*` → 한국어, 그 외 → 영어

### 5.2 언어 변경

1. `Mod+,` → 설정 → "**모양**" 섹션 (또는 별도 "**언어**" 섹션) → 드롭다운
2. 선택 → 즉시 `i18next.changeLanguage()` → 모든 컴포넌트 리렌더
3. settings-store 영속화 → 재시작 후 유지

### 5.3 번역 누락

- **dev**: 콘솔 `i18next::translator: missingKey en settings X` 경고
- **prod**: 영어 fallback → 영어도 없으면 키 그대로 표시

---

## 6. 에러 처리

| 케이스 | 처리 |
|---|---|
| namespace 로드 실패 (404/네트워크) | 영어 fallback + dev 경고 |
| 키 누락 | dev 경고, prod 키 표시 또는 영어 fallback |
| 잘못된 언어 코드 (`zh-CN` 등 미지원) | 영어 fallback |
| 변수 누락 | i18next 기본 처리 (placeholder 그대로) |
| JSON 파일 손상 | 로드 실패 → 영어 fallback |

---

## 7. 엣지 케이스

- **Tauri WebView locale**: `navigator.language`가 OS 시스템 언어 반영 — Tauri는 별도 설정 없으면 OS 따라감 ✓
- **번역 파일 dev 변경**: Vite HMR로 자동 reload. Tauri는 `pnpm tauri dev` 재시작 필요할 수 있음
- **CJK 폰트**: Pretendard Variable이 한국어 + 한자 일부 커버. 일본어/중국어 추가 시 폰트 검토 필요
- **숫자 포맷**: `Intl.NumberFormat(lang)` — 한국 (1,234,567), 인도 (12,34,567)
- **날짜 포맷**: `Intl.DateTimeFormat(lang)` 또는 i18next 플러그인
- **단축키 라벨 i18n**: registry `description` 필드를 i18n 키로 (`settings:shortcuts.save.description`)
- **shortcuts-dialog 그룹명**: 그룹별 i18n 키 — `t('settings:shortcuts.group.file')`
- **에디터 슬래시 메뉴**: 14개 항목 모두 다국어 — namespace `editor`

---

## 8. 테스트 케이스

- 영어/한국어 전환 시 모든 UI 갱신 (dev에서 시각 확인)
- 미지원 언어 (`zh`, `ja`) → 영어 fallback
- 변수 보간 정확 (`t('greeting', { name: '홍길동' })`)
- pluralization (한국어는 단/복수 동일)
- 누락 키 → dev 경고 (콘솔 + 키 표시)
- localStorage 영속성 + 재시작 후 복원
- `auto` 모드 → OS 언어 변경 시 navigator.language 반영
- Vitest: 번역 함수 모킹 + 키 매칭 단위 테스트

---

## 9. 오픈 이슈

- [ ] **번역 자동화** — i18next-parser CI 통합 (`pnpm i18n:extract`로 누락 키 검출)
- [ ] **TypeScript 키 자동완성** — `react-i18next` v15 declaration merging 활성화 (`tsconfig.json` 또는 별도 `i18next.d.ts`)
- [ ] **마이그레이션 우선순위** — 사용자 빈도 기반: settings → palette → editor 슬래시 → 컨텍스트 메뉴 → 기타
- [ ] **번역 기여 워크플로우** — Crowdin / Lokalise / 직접 PR? 오픈소스 배포 시 결정
- [ ] **lazy load 전략** — 모든 namespace eager (작아서 OK) vs lazy (전환 깜빡임 가능). 초기엔 eager 권장
- [ ] **shortcuts-dialog 키 라벨 통합** — registry `description` 영문 베이스 → t() lookup. ko 파일에 한글 description 추가
- [ ] **언어 추가 절차 문서화** — `public/locales/{lang}/` 디렉터리 추가 + supportedLngs 배열 갱신
- [ ] **에디터 placeholder/empty state** — Tiptap placeholder 확장이 i18n과 React 외부라 별도 처리 필요
- [ ] **Rust 측 에러 메시지** — 현재 한글 (예: "파일을 찾을 수 없습니다"). thiserror display 영문 + 프론트가 i18n key 매핑

---

## 10. 의존 관계

- **선행 ADR**: [ADR-025](../decisions.md#adr-025-다국어-지원-i18next--react-i18next)
- **연관 ADR**: ADR-013 (다크모드 system 기본값과 동일 패턴 — 시스템 감지 + override)
- **연관 spec**:
  - [settings-spec.md](./settings-spec.md) — `settings.language` 필드 추가
  - [keymap-spec.md](./keymap-spec.md) — registry description i18n 통합 (P2)
- **외부 의존** (모두 MIT):
  - [i18next](https://www.i18next.com)
  - [react-i18next](https://react.i18next.com)
  - [i18next-http-backend](https://github.com/i18next/i18next-http-backend)
  - [i18next-browser-languagedetector](https://github.com/i18next/i18next-browser-languagedetector)

---

## 11. 마이그레이션 전략 (점진적)

### Phase A — 인프라 (완료, v0.2)
- [x] i18next + 4개 패키지 설치 (실제: i18next 26.0.8 / react-i18next 17.0.4 / i18next-http-backend 3.0.6 / i18next-browser-languagedetector 8.2.1 — 모두 MIT, 설치 시점 최신 stable)
- [x] `src/lib/i18n.ts` 셋업 — `setupI18n()` + `resolveLang()` export. 테스트 환경에서는 backend/detector 없이 inline resources 로 init (네트워크 의존 제거)
- [x] `public/locales/{en,ko}/{common,settings}.json` 베이스 — common 10키, settings 33키 (총 43)
- [x] `settings-store`에 `language` 필드 + 마이그레이션 (`normalize()` 에서 검증)
- [x] settings-dialog 다국어 적용 — 모든 한글 → `t('settings:...' | 'common:...')`
- [x] 언어 선택 UI — "모양" 섹션 안 드롭다운 (System / 한국어 / English)
- [x] `main.tsx` 에서 i18next 초기화 + settings-store.language 변경 구독 → `i18next.changeLanguage()`

### Phase B — 핵심 UI (별도 PR들, 각 0.5-1일)
- [ ] palette namespace (Mod+K 명령)
- [ ] editor namespace (슬래시 메뉴, 컨텍스트 메뉴)
- [ ] vault namespace (열기/이동/충돌 다이얼로그)
- [ ] shortcuts-dialog description i18n

### Phase C — 나머지 (별도 PR들, 각 0.5일)
- [ ] alert/toast/error 메시지
- [ ] frontmatter panel
- [ ] search panel
- [ ] tabs 컨텍스트 메뉴
- [ ] Rust 에러 메시지 → i18n key 매핑

각 Phase는 PR 단위로 분리. CI에 i18next-parser 통합 후 누락 키 자동 검출.

---

**문서 버전:** v0.2
**작성일:** 2026-04-25
**최근 업데이트:** 2026-04-25 (Phase A 인프라 구현 완료 — i18next 26.x 채택, settings-dialog 다국어 첫 적용)
**상태:** Phase A Accepted — 후속 Phase B/C 작업 별도 PR 진행
