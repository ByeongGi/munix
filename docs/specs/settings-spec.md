# Settings 상세 설계 — Munix

> 사용자 설정 스키마, 저장 위치, UI 구조.

---

## 1. 목적

- 사용자 선호(테마, 폰트, 자동저장 간격 등)를 지속
- vault 단위 설정과 전역 설정 분리
- 합리적인 기본값으로 기본 사용자는 설정 불필요

---

## 2. 설정 계층

### 2.1 3-Tier 구조

```
1. 내장 기본값 (코드에 하드코딩)
       ↑ override
2. 전역 설정 (~/Library/Application Support/Munix/settings.json)
       ↑ override
3. Vault 설정 (vault/.munix/settings.json)
```

하위 계층이 상위를 덮어씀.

### 2.2 저장 경로

| OS | 전역 설정 경로 |
|----|---------|
| macOS | `~/Library/Application Support/Munix/settings.json` |
| Windows | `%APPDATA%\Munix\settings.json` |
| Linux | `~/.config/munix/settings.json` |

- Tauri의 `app_config_dir()` API로 결정

---

## 3. 설정 스키마

### 3.1 전체 구조

```ts
interface MunixSettings {
  appearance: AppearanceSettings;
  editor: EditorSettings;
  files: FilesSettings;
  shortcuts: ShortcutsSettings;
  advanced: AdvancedSettings;
  app: AppSettings;
}
```

### 3.2 Appearance

```ts
interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';  // default: 'system'
  accentColor: string;                   // hex, default: '#0F766E'
  fontFamily: 'sans' | 'serif' | 'mono' | string;  // default: 'sans'
  fontSize: number;                      // px, default: 16, range [12, 24]
  lineHeight: number;                    // default: 1.7, range [1.2, 2.5]
  showLineNumbers: boolean;              // 코드 블록, default: false
  sidebarWidth: number;                  // px, default: 240, range [180, 400]
  compactMode: boolean;                  // default: false (밀도 높이기)
}
```

### 3.3 Editor

```ts
interface EditorSettings {
  autoSaveDelayMs: number;               // default: 750
  autoSaveOnBlur: boolean;               // default: true
  showWordCount: boolean;                // default: true
  showCharCount: boolean;                // default: false
  spellCheck: boolean;                   // default: true
  smartPunctuation: boolean;             // "..." → "…" 등, default: true
  tabSize: number;                       // default: 2
  insertSpacesForTab: boolean;           // default: true
  defaultHeading: 'h1' | 'h2' | 'none';  // 새 파일 첫 줄, default: 'none'
  frontmatterTemplate: string | null;    // 새 파일 템플릿, default: null
  markdownFlavor: 'commonmark' | 'gfm';  // default: 'gfm'
}
```

### 3.4 Files

```ts
interface FilesSettings {
  defaultVaultPath: string | null;       // 첫 실행 시
  lastVaultPath: string | null;
  recentVaults: string[];                // 최대 5개
  fileNamingPattern: 'natural' | 'iso-date' | 'custom';
  customFileNamePattern: string | null;  // 예: "{{date:YYYY-MM-DD}}"
  confirmBeforeDelete: boolean;          // default: true
  useTrash: boolean;                     // default: true (false = 영구 삭제)
  followSymlinks: boolean;               // default: false
  watchExternalChanges: boolean;         // default: true
}
```

### 3.5 Shortcuts

**구현 (v1.1):** 별도 `ShortcutsSettings` 객체 대신 settings 루트에 `keymapOverrides`
필드를 둔다 (단순화). 키는 keymap-registry 의 entry id, 값은 정규화된 키 문자열.

```ts
// settings 루트에 직접:
keymapOverrides: Record<string, string>;
// 예:
{
  "global.save": "mod+alt+s",
  "global.commandPalette": "mod+shift+p"
}
```

- 빈 객체 `{}` 면 모두 default 사용.
- 등록되지 않은 entry id 는 lookup 시 무시됨 (registry 변경에 하위 호환).
- 값이 빈 문자열이면 "비활성화" 의미 (현재 UI 미노출).
- 정규화 / 매칭 / 표기 사양은 [keymap-spec.md §11](./keymap-spec.md#11-커스터마이징-v11) 참조.

### 3.6 Advanced

```ts
interface AdvancedSettings {
  searchEngine: 'fuse' | 'minisearch' | 'tantivy';  // default: 'fuse'
  indexOnStartup: boolean;               // default: true
  maxFileSize: number;                   // bytes, default: 10MB
  enableDevTools: boolean;               // default: false
  telemetry: boolean;                    // default: false (로컬 앱이므로 원칙상 false)
  experimentalFeatures: string[];        // ['wikilinks', 'math'] 등
}
```

### 3.7 App

```ts
interface AppSettings {
  firstRun: boolean;
  version: string;                       // 설정 파일 버전 (마이그레이션용)
  language: 'ko' | 'en' | 'system';      // default: 'system'
  updateChannel: 'stable' | 'beta';      // default: 'stable'
  autoCheckUpdates: boolean;             // default: true
  // 창 상태 (vault와 무관)
  window: {
    width: number;
    height: number;
    maximized: boolean;
    sidebarVisible: boolean;
  };
}
```

---

## 4. 기본값 정의

```ts
// src/lib/defaultSettings.ts
export const DEFAULT_SETTINGS: MunixSettings = {
  appearance: {
    theme: 'system',
    accentColor: '#0F766E',
    fontFamily: 'sans',
    fontSize: 16,
    lineHeight: 1.7,
    showLineNumbers: false,
    sidebarWidth: 240,
    compactMode: false,
  },
  editor: {
    autoSaveDelayMs: 750,
    autoSaveOnBlur: true,
    showWordCount: true,
    showCharCount: false,
    spellCheck: true,
    smartPunctuation: true,
    tabSize: 2,
    insertSpacesForTab: true,
    defaultHeading: 'none',
    frontmatterTemplate: null,
    markdownFlavor: 'gfm',
  },
  files: {
    defaultVaultPath: null,
    lastVaultPath: null,
    recentVaults: [],
    fileNamingPattern: 'natural',
    customFileNamePattern: null,
    confirmBeforeDelete: true,
    useTrash: true,
    followSymlinks: false,
    watchExternalChanges: true,
  },
  // v1.1 구현: settings 루트에 직접 둔다 (별도 shortcuts 객체 X)
  keymapOverrides: {},
  advanced: {
    searchEngine: 'fuse',
    indexOnStartup: true,
    maxFileSize: 10 * 1024 * 1024,
    enableDevTools: false,
    telemetry: false,
    experimentalFeatures: [],
  },
  app: {
    firstRun: true,
    version: '1',
    language: 'system',
    updateChannel: 'stable',
    autoCheckUpdates: true,
    window: { width: 1280, height: 800, maximized: false, sidebarVisible: true },
  },
};
```

---

## 5. 저장/로드 API

### 5.1 Rust 측

```rust
// src-tauri/src/commands/settings.rs

#[tauri::command]
async fn get_settings(app: AppHandle) -> Result<serde_json::Value, SettingsError>;

#[tauri::command]
async fn update_settings(
    patch: serde_json::Value,
    app: AppHandle,
) -> Result<(), SettingsError>;

#[tauri::command]
async fn reset_settings(app: AppHandle) -> Result<(), SettingsError>;
```

**파일 작성 시 원자적 쓰기** (vault와 동일 패턴).

### 5.2 TS 측

```ts
// src/store/settings.ts
interface SettingsStore {
  settings: MunixSettings;
  load: () => Promise<void>;
  update: (patch: DeepPartial<MunixSettings>) => Promise<void>;
  reset: () => Promise<void>;
}
```

**Patch 전략:**
- 전체 저장이 아닌 부분 업데이트 (deep merge)
- 동시 업데이트 충돌 방지: 마지막 쓰기 우선 (last-write-wins)

---

## 6. UI — 설정 화면

### 6.1 레이아웃

설정을 모달/별도 창이 아닌 **풀스크린 뷰**로:

```
┌────────────────────────────────────────────┐
│  Munix 설정                         [ × ]  │
├────────────┬───────────────────────────────┤
│            │                               │
│ 🎨 모양    │  테마                          │
│ ✏  에디터  │  [ ● 시스템 ○ 라이트 ○ 다크 ] │
│ 📁 파일    │                               │
│ ⌨  단축키  │  폰트 크기                     │
│ 🔧 고급    │  [──●───────]   16px          │
│ ℹ  정보    │                               │
│            │  ...                          │
│            │                               │
└────────────┴───────────────────────────────┘
```

- 왼쪽: 카테고리 네비
- 오른쪽: 해당 설정 패널
- 저장은 실시간 (변경 즉시 적용)

### 6.2 각 섹션 컴포넌트

#### 모양 (Appearance)
- Theme: 라디오 그룹
- Accent Color: 컬러 피커 (프리셋 + custom hex)
- Font Family: 드롭다운 + preview
- Font Size: 슬라이더 + 숫자
- Line Height: 슬라이더
- Sidebar Width: 슬라이더
- Compact Mode: 스위치

#### 에디터 (Editor)
- Auto-save Delay: 슬라이더 (250~3000ms)
- Auto-save on Blur: 스위치
- Word Count: 스위치
- Spell Check: 스위치
- Markdown Flavor: 라디오 (CommonMark / GFM)
- Frontmatter Template: 다중 라인 텍스트 에디터
  ```yaml
  ---
  created: {{date}}
  tags: []
  ---
  ```

#### 파일 (Files)
- 기본 Vault 경로: 폴더 선택
- 최근 Vault 목록: 리스트 (클릭으로 전환, 삭제 가능)
- 삭제 확인: 스위치
- 휴지통 사용: 스위치
- 외부 변경 감시: 스위치

#### 단축키 (v1.1 구현됨)
- 그룹별 명령 행 표시 (파일/네비게이션/도움/...)
- 각 행: 설명 + 현재 키 + "변경" + "기본값으로" 버튼
- "변경" 클릭 시 KeyCapture 인라인 위젯 — 키 입력 → 정규화 → 즉시 저장
- 충돌 감지: 같은 scope 에서 같은 키가 둘 이상 entry 에 매핑되면 인라인 amber
  경고 ("충돌: <명령 설명>")
- 상단 "전체 기본값 복원" 버튼 (confirm prompt → `keymapOverrides = {}`)
- `editable === false` entry (Tiptap 내부 단축키, 트리 navigation 키) 는 회색조
  표시 + "변경" 버튼 없음. cheatsheet 표시 전용.

#### 고급
- 검색 엔진: 드롭다운
- 최대 파일 크기: 숫자 입력
- 개발자 도구: 스위치 (재시작 필요)
- 실험 기능: 체크박스 리스트

#### 정보
- 앱 버전
- 릴리스 노트 링크
- 라이선스
- GitHub 링크
- "설정 초기화" 버튼 (확인 다이얼로그)

### 6.3 변경 즉시 적용

대부분 설정은 즉시 반영. 재시작 필요한 것:
- 개발자 도구 활성화
- 언어 변경 (일부)

→ 변경 시 "재시작이 필요합니다" 배너 + [지금 재시작] 버튼

---

## 7. 마이그레이션

### 7.1 버전 관리

`settings.app.version` 필드로 스키마 버전 추적.

```ts
// src/lib/migrations.ts
type Migration = (old: any) => any;

const migrations: Record<string, Migration> = {
  '1_to_2': (old) => ({
    ...old,
    editor: {
      ...old.editor,
      newField: 'default',
    },
    app: { ...old.app, version: '2' },
  }),
};

function migrate(settings: any): MunixSettings {
  let current = settings;
  while (current.app.version !== CURRENT_VERSION) {
    const migrationKey = `${current.app.version}_to_${parseInt(current.app.version) + 1}`;
    const fn = migrations[migrationKey];
    if (!fn) break;
    current = fn(current);
  }
  return current;
}
```

### 7.2 깨진 설정 복구

로드 시 JSON 파싱 실패 또는 스키마 불일치:
1. 백업: `settings.json.bak-{timestamp}`
2. 기본값으로 초기화
3. 사용자에게 알림

---

## 8. Vault 설정 병합

### 8.1 오버라이드 가능 항목

Vault 단위 커스터마이즈 가능한 것만:
- `editor.frontmatterTemplate`
- `editor.markdownFlavor`
- `editor.tabSize`
- `files.fileNamingPattern`
- `files.customFileNamePattern`

### 8.2 병합 로직

```ts
function getEffectiveSettings(): MunixSettings {
  const global = globalSettings;
  const vault = vaultSettings;  // 없으면 빈 객체
  return deepMerge(global, vault);
}
```

### 8.3 UI 표시

Vault 설정 섹션 따로:
- "[Vault 이름] 전용 설정"
- 각 항목 옆에 "전역 설정 사용" 체크박스

---

## 9. 보안/프라이버시

- 설정 파일은 사용자 홈 하위에만 저장
- 민감 정보 (API 키 등) 없음
- 텔레메트리 기본값 OFF, 명시적 opt-in
- 설정 내보내기/가져오기 시 민감 필드 제외

---

## 10. 내보내기/가져오기

### 10.1 내보내기

설정 → 정보 → [설정 내보내기]
- JSON 다운로드
- 파일명: `munix-settings-{yyyymmdd}.json`

### 10.2 가져오기

[설정 가져오기] → 파일 선택
- 검증 후 병합
- 실패 시 롤백

---

## 11. 테스트 케이스

- [ ] 기본값으로 첫 실행
- [ ] 설정 변경 → 재시작 → 유지
- [ ] 스키마 버전 업그레이드 마이그레이션
- [ ] 깨진 JSON 복구
- [ ] Vault 설정 오버라이드 우선순위
- [ ] 동시에 여러 설정 업데이트 (race condition 없음)

---

## 12. 엣지 케이스

- **설정 파일 동기화 폴더 (Dropbox)**: 동일 설정이 다른 기기에서 열릴 때 호환성
- **읽기 전용 파일 시스템**: 쓰기 실패 시 메모리 모드로 운영
- **설정 파일 수동 편집 (user)**: 재검증 후 잘못된 값은 기본값으로 복원
- **매우 큰 설정 파일 (예: custom shortcuts 수백 개)**: 정상 동작

---

## 13. 오픈 이슈

1. **CSS 커스터마이징**: 사용자 정의 CSS 입력 기능 (Obsidian snippets 스타일)?
2. **워크스페이스 레이아웃**: 사이드바 위치/크기 vault별로 저장?
3. **세컨더리 테마**: 강제 라이트/강제 다크 단축키
4. **i18n**: 번역 파일 관리 및 기여 구조

---

**문서 버전:** v0.2
**작성일:** 2026-04-25
**최근 업데이트:** 2026-04-25 (v0.2 — 사용자 정의 단축키 v1.1 반영: `keymapOverrides` 필드 + UI)
**관련 문서:**
- [theme-spec.md](./theme-spec.md)
- [keymap-spec.md](./keymap-spec.md)
