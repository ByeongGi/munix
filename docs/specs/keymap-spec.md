# Keymap 상세 설계 — Munix

> 앱 전역/에디터 단축키 정의. macOS/Windows/Linux 호환.

---

## 1. 원칙

1. **표준 준수** — OS 관례(Cmd+S, Cmd+C 등) 우선
2. **Obsidian/Notion 친화** — 사용자 학습 비용 최소화
3. **충돌 없음** — 컨텍스트별 단축키 격리 (트리 vs 에디터)
4. **발견 가능성** — 메뉴/툴팁에 단축키 표기
5. **커스터마이징** — v1.1+에서 사용자 정의 허용

---

## 2. 표기 규칙

| 심볼 | macOS | Windows/Linux |
|------|-------|---------------|
| `Mod` | Cmd (⌘) | Ctrl |
| `Alt` | Option (⌥) | Alt |
| `Shift` | Shift (⇧) | Shift |

이하 본 문서에서는 `Mod`로 표기.

---

## 3. 전역 단축키

앱 어디서나 동작:

| 키 | 동작 |
|---|---|
| `Mod+N` | 새 노트 (현재 폴더 또는 루트에) |
| `Mod+Shift+N` | 새 폴더 |
| `Mod+O` | Vault 열기 (폴더 선택 다이얼로그) |
| `Mod+P` | 파일 빠른 열기 (fuzzy) |
| `Mod+K` | 커맨드 팔레트 |
| `Mod+F` | 현재 파일 내 검색 |
| `Mod+Shift+F` | Vault 전체 검색 |
| `Mod+,` | 설정 |
| `Mod+S` | 수동 저장 (flush) |
| `Mod+W` | 현재 파일 닫기 (에디터 비우기) |
| `Mod+Q` | 앱 종료 |
| `Mod+Z` | 되돌리기 |
| `Mod+Shift+Z` | 다시 실행 |
| `Mod+\` | 사이드바 토글 |
| `Mod+/` | 단축키 치트시트 열기 |
| `Mod+0` | 글자 크기 리셋 |
| `Mod+=` / `Mod++` | 글자 크기 증가 |
| `Mod+-` | 글자 크기 감소 |
| `F1` | 도움말 |
| `F11` | 전체 화면 토글 |

---

## 4. 에디터 단축키

에디터에 포커스 있을 때:

### 4.1 텍스트 포맷

| 키 | 동작 |
|---|---|
| `Mod+B` | Bold 토글 |
| `Mod+I` | Italic 토글 |
| `Mod+U` | Underline 토글 |
| `Mod+E` | Inline code 토글 |
| `Mod+Shift+X` | Strikethrough 토글 |
| `Mod+K` | 링크 삽입/편집 |
| `Mod+Shift+K` | 링크 제거 |

### 4.2 블록 조작

| 키 | 동작 |
|---|---|
| `Mod+Alt+1` ~ `6` | H1 ~ H6 |
| `Mod+Alt+0` | 본문 (Heading 해제) |
| `Mod+Alt+7` | 글머리 기호 |
| `Mod+Alt+8` | 번호 매기기 |
| `Mod+Shift+8` | 체크리스트 |
| `Mod+Shift+9` | 인용 |
| `Mod+Alt+C` | 코드 블록 |
| `Mod+Shift+↑` | 블록 위로 이동 |
| `Mod+Shift+↓` | 블록 아래로 이동 |
| `Mod+D` | 블록 복제 |
| `Mod+Shift+Backspace` | 블록 삭제 |
| `Tab` | 리스트 들여쓰기 / 코드 블록: 2칸 공백 |
| `Shift+Tab` | 리스트 내어쓰기 |
| `Mod+Enter` | 체크박스 토글 / 현재 블록 뒤에 새 블록 |

### 4.3 슬래시 커맨드

| 키 | 동작 |
|---|---|
| `/` (빈 줄 또는 공백 뒤) | 슬래시 메뉴 열기 |
| `↑` / `↓` | 메뉴 항목 이동 |
| `Enter` / `Tab` | 선택 |
| `Esc` | 메뉴 닫기 |

### 4.4 검색/탐색

| 키 | 동작 |
|---|---|
| `Mod+F` | 현재 파일 내 찾기 |
| `Mod+G` | 다음 일치 |
| `Mod+Shift+G` | 이전 일치 |
| `Mod+Alt+F` | 찾아 바꾸기 |

### 4.5 히스토리

| 키 | 동작 |
|---|---|
| `Mod+Z` | Undo |
| `Mod+Shift+Z` | Redo |
| `Mod+Y` (Windows/Linux) | Redo |

---

## 5. File Tree 단축키

사이드바에 포커스 있을 때:

| 키 | 동작 |
|---|---|
| `↑` / `↓` | 항목 이동 |
| `←` | 폴더 접기 / 부모로 |
| `→` | 폴더 펴기 |
| `Enter` | 파일 열기 / 폴더 토글 |
| `Space` | 파일 미리보기 (옵션, v1.1) |
| `F2` | 이름 변경 |
| `Delete` / `Backspace` | 삭제 (휴지통) |
| `Mod+Delete` | 영구 삭제 (확인) |
| `Mod+N` | 현재 폴더에 새 파일 |
| `Mod+Shift+N` | 현재 폴더에 새 폴더 |
| `Mod+C` | 경로 복사 |
| `Mod+V` | (v1.1+) 파일 붙여넣기 |
| `Mod+Shift+V` | 이동하여 붙여넣기 |
| `Esc` | 필터/rename 취소 |
| `/` | 필터 입력으로 포커스 |

---

## 6. 검색 & 팔레트 단축키

`Mod+P` (파일 빠른 열기) / `Mod+K` (커맨드 팔레트) 열려있을 때:

| 키 | 동작 |
|---|---|
| `↑` / `↓` | 항목 이동 |
| `Enter` | 선택 |
| `Mod+Enter` | 새 탭 (v1.1+) |
| `Esc` | 닫기 |
| `Tab` | 첫 결과에 포커스 |

**커맨드 팔레트 특수 prefix:**
- `>` : 명령어 (기본)
- `#` : 태그 검색
- `[[` : 백링크 (v1.1+)
- `@` : 파일 내 헤딩 검색
- `:` : 라인 이동 (예: `:42`)

---

## 7. 컨텍스트 격리

같은 키 조합이 컨텍스트마다 다른 동작:

| 키 | 에디터 | 트리 | 팔레트 |
|---|---|---|---|
| `Enter` | 새 줄 | 열기 | 선택 |
| `Backspace` | 삭제 | 파일 삭제 | 입력 삭제 |
| `/` | 슬래시 메뉴 | 필터 포커스 | - |

**구현:** 현재 포커스된 영역에 따라 Tiptap의 keymap/DOM 레벨 리스너 우선순위 결정.

---

## 8. 시스템 예약 키 회피

다음은 OS가 예약하므로 사용 금지:

- `Mod+Tab` (앱 전환)
- `Mod+H` (숨기기 - macOS)
- `Mod+M` (최소화 - macOS)
- `Alt+F4` (종료 - Windows)
- `Mod+Space` (Spotlight - macOS)

---

## 9. 단축키 치트시트

`Mod+/` 또는 메뉴에서 "단축키" 선택 시 모달 표시:

```
┌──────────────────────────────────────────────┐
│  단축키                              [검색 🔍] │
│ ──────────────────────────────────────────── │
│  전역                                         │
│    ⌘N       새 노트                           │
│    ⌘P       빠른 열기                         │
│    ⌘K       커맨드 팔레트                     │
│    ...                                        │
│                                               │
│  에디터                                       │
│    ⌘B       굵게                              │
│    ⌘I       기울임                            │
│    ...                                        │
│                                               │
│  파일 트리                                    │
│    F2       이름 변경                         │
│    ...                                        │
└──────────────────────────────────────────────┘
```

- 섹션별 그룹핑
- 상단 검색으로 실시간 필터
- OS별 자동 표기 변환 (macOS: ⌘, Windows: Ctrl)

---

## 10. 기술적 구현

### 10.1 라이브러리

- **에디터**: Tiptap의 `keyboardShortcuts` 옵션 (ProseMirror keymap)
- **전역/트리**: `tinykeys` 또는 `hotkeys-js` (lightweight)
- **충돌 방지**: context provider로 활성 scope 관리

### 10.2 통합 아키텍처

```ts
// src/lib/keymap.ts

type KeymapContext = 'global' | 'editor' | 'tree' | 'palette';

interface Shortcut {
  id: string;
  keys: string;         // 'mod+n'
  context: KeymapContext;
  label: string;
  group: string;
  handler: (e: KeyboardEvent) => void;
}

export const shortcuts: Shortcut[] = [
  { id: 'new-note', keys: 'mod+n', context: 'global', label: '새 노트', group: '파일', handler: ... },
  // ...
];
```

### 10.3 OS별 키 변환

```ts
function formatKeys(keys: string): string {
  const isMac = navigator.platform.includes('Mac');
  return keys
    .replace(/mod/gi, isMac ? '⌘' : 'Ctrl')
    .replace(/alt/gi, isMac ? '⌥' : 'Alt')
    .replace(/shift/gi, isMac ? '⇧' : 'Shift')
    .replace(/\+/g, isMac ? '' : '+');
}
```

---

## 11. 커스터마이징 (v1.1)

### 11.1 데이터 모델

레지스트리 — `src/lib/keymap-registry.ts` — 가 단일 진실 원천이다. 모든 명령은
`KeymapEntry` 로 등록:

```ts
interface KeymapEntry {
  id: string;            // "global.save"
  defaultKey: string;    // 정규화된 형태 "mod+s"
  description: string;   // UI 라벨 (한국어)
  scope: 'global' | 'editor' | 'tree' | 'palette' | 'search';
  group: string;         // 치트시트 그룹핑 ("파일", "네비게이션" 등)
  editable: boolean;     // v1.1: global 만 true. 그 외는 cheatsheet 표시 전용.
}
```

사용자 override 는 settings store 의 `keymapOverrides: Record<string, string>` 로
저장. 키는 entry id, 값은 정규화된 키 문자열 (e.g. `"mod+alt+s"`).

```ts
// settings.json 예
{
  "keymapOverrides": {
    "global.save": "mod+alt+s",
    "global.commandPalette": "mod+shift+p"
  }
}
```

저장 위치는 `app_config_dir/settings.json` (ADR-016 / settings-spec.md 참조).
`keymap.json` 별도 파일은 만들지 않는다 — 설정과 함께 마이그레이션·백업되도록
일원화.

### 11.2 정규화 형태

모든 키 문자열은 `+` 로 연결한 소문자 토큰. modifier 순서는 `mod → alt → shift` 강제:

```
mod+s             # ⌘S / Ctrl+S
mod+shift+f       # ⌘⇧F / Ctrl+Shift+F
alt+arrowup       # ⌥↑ / Alt+↑
f2                # F2 (modifier 없음)
mod+,             # ⌘, / Ctrl+,
```

`Mod` = macOS Cmd / 그 외 Ctrl. 이외 alias 입력 시 자동 정규화 (`Cmd → mod`,
`Up → arrowup` 등). 자세한 토큰 사양은 `src/lib/keymap-format.ts`.

### 11.3 매칭

런타임은 `useKeymapMatcher(scope)` 훅이 `KeyboardEvent → entry id` 변환을 담당.
핸들러 측은 switch(id) 로 분기:

```ts
const matchGlobal = useKeymapMatcher("global");
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    const id = matchGlobal(e);
    if (id === "global.save") { e.preventDefault(); flush(); }
    // ...
  };
  window.addEventListener("keydown", onKeyDown);
}, [matchGlobal]);
```

scope 격리 — global 매칭은 editor 키와 독립. 두 scope 가 같은 키를 다른 명령에
배정해도 충돌로 보지 않음 (의도된 컨텍스트 격리).

### 11.4 UI

설정 다이얼로그 → "단축키" 섹션:
- 그룹별 (파일/네비게이션/도움/...) 명령 행 표시
- 각 행: `[설명] [현재 키 kbd] [변경] [기본값으로 RotateCcw]`
- "변경" 클릭 → KeyCapture 인라인 위젯 (`src/components/key-capture.tsx`)
  - autoFocus + keydown 캡처 → 정규화 토큰 → onSubmit
  - modifier 만 누른 상태는 시각 피드백 (`mod+…`)
  - Escape 단독 → 취소 (modifier 함께면 main key 로 인정)
  - blur 시 자동 취소
- 충돌은 인라인 amber 텍스트 ("충돌: <충돌하는 명령 설명>")
- "전체 기본값 복원" 상단 버튼 — confirm 후 `keymapOverrides = {}`

### 11.5 충돌 감지

`findConflicts(overrides)` 가 effective keymap 전체를 빌드한 뒤 `(scope, key)`
쌍이 둘 이상 entry 에 매핑된 경우를 반환. **scope 가 다르면 충돌 아님**.
`editable === false` entry 는 충돌 체크 대상에서 제외 (Tiptap 내부 키는 사용자가
수정 못 하므로 의미 없음).

UI 는 충돌이 있어도 저장은 막지 않음 — 사용자가 의도적으로 같은 키를 일시 매핑
중일 수 있고, 마지막에 또 변경할 가능성이 있어 인라인 경고만 표시. (저장 자체를
차단하는 옵션은 P2 후보.)

### 11.6 v1.1 범위 / 한계

**현재 customizable**: `scope === 'global'` + `editable === true` 인 12개 명령
(파일 5 / 네비게이션 4 / 도움 2 / 검색-에디터 1).

**미지원 (v1.2+)**:
- Tiptap addKeyboardShortcuts 로 등록된 에디터 단축키 (bold/italic/블록 이동 등)
- 파일 트리 navigation 키 (방향키, F2)
- chord 키 (`Mod+K → Mod+S`)
- Vim 모드

이유: Tiptap 확장의 `addKeyboardShortcuts()` 는 에디터 인스턴스에 정적으로 바인딩되며,
override 변경 시 에디터 재생성이 필요해 v1 범위에서 제외. cheatsheet 표시는
계속 가능 (registry 에 `editable: false` 로 등록).

### 11.7 마이그레이션

`settings.json` 에 `keymapOverrides` 가 없거나 잘못된 형태면 `{}` 로 초기화 (→
default 사용). 등록 해제된 id 는 lookup 시 자동으로 무시되므로 registry 변경에
하위 호환.

---

## 12. 테스트 케이스

- [ ] 에디터 포커스: Cmd+N → 새 노트 생성됨 (에디터 Cmd+N 동작 아님)
- [ ] 트리 포커스: Delete → 파일 삭제 (에디터 내용 삭제 아님)
- [ ] 슬래시 메뉴 열림: ↓ → 다음 항목, 선택 항목이 스크롤 영역 안으로 자동 보정, Esc → 닫힘
- [ ] macOS Cmd vs Windows Ctrl 분기 동작
- [ ] 치트시트 검색 필터

---

## 13. 오픈 이슈

1. **Vim 모드**: 수요 있으면 v1.1+에 Tiptap-vim 확장 추가
2. **Chord 단축키**: `Mod+K → Mod+S` 같은 2-step 지원할지
3. **백링크 `[[`**: v1.1에서 추가 시 슬래시 메뉴와 충돌 없는지
4. **탭 기반 다중 문서**: v1.1+ 도입 시 `Mod+T`, `Mod+W` 재정의 필요

---

**문서 버전:** v0.2
**작성일:** 2026-04-25
**최근 업데이트:** 2026-04-25 (v0.2 — 사용자 정의 단축키 v1.1 구현 반영: 레지스트리/매처/UI/충돌 감지)
**관련 문서:**
- [editor-spec.md](./editor-spec.md)
- [file-tree-spec.md](./file-tree-spec.md)
- [search-spec.md](./search-spec.md)
- [settings-spec.md](./settings-spec.md)
