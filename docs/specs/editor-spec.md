# Editor 상세 설계 — Munix

> Tiptap 3.x 기반 블록 에디터. `.md` 파일을 로드/편집/저장하는 핵심 컴포넌트.

---

## 1. 목적

- Notion 수준의 블록 편집 UX를 `.md` 파일 위에서 구현
- Obsidian과 100% 파일 호환 (읽기/쓰기 라운드트립)
- WYSIWYG + 마크다운 단축 입력 혼용

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| EDT-01 | `.md` 문자열을 받아 ProseMirror 문서로 파싱 | P0 |
| EDT-02 | ProseMirror 문서를 `.md`로 직렬화 | P0 |
| EDT-03 | 슬래시 커맨드(`/`)로 블록 삽입 | P0 |
| EDT-04 | 선택 영역에 버블 메뉴 표시 (bold/italic/code/link) | P0 |
| EDT-05 | 블록 좌측에 드래그 핸들 표시 | P1 |
| EDT-06 | 이미지 붙여넣기/드롭 → `assets/` 복사 | P1 |
| EDT-07 | 코드 블록 구문 강조 (lowlight) | P1 |
| EDT-08 | 체크박스 (task list) | P1 |
| EDT-09 | 테이블 | P2 |
| EDT-10 | 링크 호버 프리뷰 | P2 |
| EDT-11 | YAML frontmatter 보존 | P1 |
| EDT-12 | Placeholder 표시 (빈 문서) | P0 |

### 2.2 비기능 요구사항

- 10,000자 문서 초기 렌더 < 150ms
- 입력 → 화면 반영 지연 < 16ms (60fps)
- 메모리: 1개 문서당 < 30MB

---

## 3. 데이터 모델

### 3.1 Editor Props

```ts
// src/components/editor/Editor.tsx
interface EditorProps {
  filePath: string;            // vault 기준 상대 경로
  initialContent: string;       // .md 문자열
  onChange: (markdown: string) => void;
  onReady?: (editor: TiptapEditor) => void;
  readOnly?: boolean;
  placeholder?: string;
}
```

### 3.2 내부 상태

```ts
interface EditorState {
  editor: TiptapEditor | null;
  status: 'loading' | 'ready' | 'error';
  lastSavedAt: Date | null;
  isDirty: boolean;
  wordCount: number;
}
```

### 3.3 문서 구조 (YAML frontmatter + body)

```ts
interface ParsedDocument {
  frontmatter: Record<string, unknown> | null;
  body: string;  // frontmatter 제외한 본문
}

// 파서: gray-matter 사용
function parseDocument(raw: string): ParsedDocument;
function serializeDocument(doc: ParsedDocument): string;
```

---

## 4. Tiptap 확장 구성

### 4.1 확장 매트릭스

| 확장 | 용도 | MD 매핑 | 단축키 |
|------|------|---------|--------|
| StarterKit | heading, paragraph, list, blockquote, hr 등 | 표준 MD | - |
| CodeBlockLowlight | 코드 블록 + 구문 강조 | ` ```lang ` | Cmd+Alt+C |
| Link | 링크 | `[text](url)` | Cmd+K |
| Image | 이미지 | `![alt](path)` | - |
| Table + Row + Cell + Header | 테이블 | GFM 테이블 | - |
| TaskList + TaskItem | 체크리스트 | `- [ ]` | Cmd+Shift+8 |
| Placeholder | 빈 블록 힌트 | - | - |
| Markdown | MD 양방향 변환 | - | - |
| SlashCommand (커스텀) | `/` 트리거 메뉴 | - | `/` |
| DragHandle (커스텀) | 블록 이동 | - | - |
| Frontmatter (커스텀) | YAML 헤더 보존 | `---\n...\n---` | - |

### 4.2 비활성화할 것

- `Collaboration` (단일 사용자 전제)
- `CollaborationCursor`
- `History` 기본값 사용 (undo/redo 깊이 100)

---

## 5. 슬래시 커맨드 메뉴

### 5.1 트리거 규칙

- 빈 라인 또는 공백 뒤에 `/` 입력 시 메뉴 표시
- ESC 또는 공백 입력 시 닫기
- 화살표 위/아래로 이동, Enter/Tab으로 선택

### 5.2 메뉴 항목

```ts
interface SlashCommand {
  id: string;
  title: string;
  description: string;
  keywords: string[];       // 검색용
  icon: LucideIcon;
  group: 'basic' | 'heading' | 'list' | 'media' | 'advanced';
  command: (editor: Editor, range: Range) => void;
}

const slashCommands: SlashCommand[] = [
  // Basic
  { id: 'text', title: '본문', keywords: ['text', 'paragraph', '본문'], group: 'basic', ... },
  { id: 'h1', title: '제목 1', keywords: ['heading', 'h1', '제목'], group: 'heading', ... },
  { id: 'h2', title: '제목 2', keywords: ['h2'], group: 'heading', ... },
  { id: 'h3', title: '제목 3', keywords: ['h3'], group: 'heading', ... },

  // List
  { id: 'ul', title: '글머리 기호', keywords: ['bullet', 'ul'], group: 'list', ... },
  { id: 'ol', title: '번호 매기기', keywords: ['numbered', 'ol'], group: 'list', ... },
  { id: 'todo', title: '할 일', keywords: ['todo', 'task', 'check'], group: 'list', ... },

  // Media
  { id: 'image', title: '이미지', keywords: ['image', 'img'], group: 'media', ... },
  { id: 'code', title: '코드', keywords: ['code', 'snippet'], group: 'advanced', ... },
  { id: 'quote', title: '인용', keywords: ['quote', 'blockquote'], group: 'advanced', ... },
  { id: 'divider', title: '구분선', keywords: ['hr', 'divider'], group: 'advanced', ... },
  { id: 'table', title: '표', keywords: ['table'], group: 'advanced', ... },
];
```

### 5.3 UI 스펙

- 위치: 현재 커서의 아래 (화면 하단이면 위로 반전)
- 크기: 280px 폭, 최대 높이 320px (스크롤)
- 그룹 헤더 표시 ("기본", "제목", "목록" 등)
- 키워드 매칭: fuzzy (`fuse.js` 또는 간단 구현)
- 빈 결과 시 "일치 없음" 표시

---

## 6. 버블 메뉴 (선택 시 툴바)

### 6.1 표시 조건

- 텍스트가 2자 이상 선택됨
- 선택 영역이 단일 블록 내부
- 코드 블록 내부는 예외 (버블 메뉴 숨김)

### 6.2 항목

```
[ B ] [ I ] [ U ] [ S ] [ <code> ] [ 🔗 ] [ 🎨▼ ]
```

| 버튼 | 동작 | 단축키 |
|------|------|--------|
| B | Bold 토글 | Cmd+B |
| I | Italic 토글 | Cmd+I |
| U | Underline 토글 | Cmd+U |
| S | Strike 토글 | Cmd+Shift+X |
| `<code>` | Inline code 토글 | Cmd+E |
| 🔗 | 링크 추가/편집 | Cmd+K |
| 🎨 | 텍스트 색상 (드롭다운) | - |

### 6.3 링크 편집 모드

- 🔗 클릭 시 URL 입력 팝오버
- 기존 링크면 현재 URL 표시 + 편집/삭제 버튼
- Enter로 적용, ESC로 취소

---

## 7. 드래그 핸들

### 7.1 동작

- 블록 hover 시 왼쪽 여백(-24px 위치)에 `⋮⋮` 아이콘 표시
- 마우스 다운 → 블록 전체 선택 → 드래그 시작
- 드롭 위치에 파란 가로선 표시
- 드롭 시 블록 순서 재배치

### 7.2 제약

- 중첩 블록(리스트 하위)은 상위 컨테이너 내에서만 이동
- 테이블 행은 별도 핸들 (향후)

### 7.3 단축 메뉴

핸들 클릭 시 드롭다운:
- 위로 이동 (Cmd+Shift+↑)
- 아래로 이동 (Cmd+Shift+↓)
- 복제 (Cmd+D)
- 삭제 (Cmd+Shift+Backspace)
- 블록 타입 변경 →

---

## 8. 이미지 처리

### 8.1 입력 경로

| 입력 | 동작 |
|------|------|
| 붙여넣기 (클립보드 이미지) | `assets/{yyyymmdd}-{uuid}.png`로 저장 |
| 드래그 앤 드롭 (파일) | 동일 |
| 슬래시 → 이미지 → 파일 선택 | 동일 |
| 마크다운 직접 입력 (`![](path)`) | 경로 그대로 유지 |

### 8.2 저장 규칙

```
vault_root/
└── assets/
    └── 20260425-a1b2c3d4.png
```

- 파일명: `{yyyymmdd}-{8자리-uuid}.{ext}`
- 중복 방지: UUID 생성
- 참조: 본문에는 상대 경로 `![](assets/20260425-a1b2c3d4.png)`
- 지원 포맷: png, jpg, jpeg, gif, webp, svg

### 8.3 이미지 블록 UI

- 로딩 중 스켈레톤 표시
- alt 텍스트 편집 (클릭 시 입력)
- 크기 조절 핸들 (우측 하단, 드래그)
- 삭제 시 파일도 삭제할지 확인 (휴지통)

---

## 9. 코드 블록

### 9.1 언어 지원

lowlight 기본 포함 + 자주 쓰는 언어:
- TypeScript / JavaScript / TSX / JSX
- Python / Rust / Go / Java
- HTML / CSS / JSON / YAML / TOML
- Bash / SQL / Markdown / Diff
- Plain text

### 9.2 UI

- 우상단: 언어 선택 드롭다운
- 우상단: 복사 버튼 (호버 시 표시)
- 좌측: 줄 번호 (선택적, 설정)
- Tab 키 → 2칸 공백 삽입 (tab out은 Shift+Tab)

### 9.3 MD 매핑

```md
```typescript
const x = 1;
```
```

---

## 10. 체크리스트 (TaskList)

### 10.1 MD 매핑

```md
- [ ] 할 일
- [x] 완료
```

### 10.2 UI

- 체크박스 클릭 시 토글
- 체크 시 텍스트 취소선 + 투명도 0.5
- 중첩 가능 (Tab으로 들여쓰기)

### 10.3 단축키

- Cmd+Shift+8: 체크리스트 토글
- Cmd+Enter: 체크박스 체크/해제

---

## 11. YAML Frontmatter

### 11.1 감지 규칙

- 파일 최상단이 `---\n`으로 시작
- 다음 `---\n`까지가 frontmatter
- 그 이후가 body

### 11.2 에디터 처리

**옵션 A (선택): 숨김 처리**
- 에디터에는 body만 로드
- frontmatter는 별도 `useFrontmatter()` 훅으로 관리
- 저장 시 frontmatter + body 조합

**옵션 B: 전용 블록 노드**
- 최상단에 편집 가능한 frontmatter 블록 표시
- Tiptap 커스텀 노드로 구현

→ v1에서는 **옵션 A** 채택 (단순)

### 11.3 자동 업데이트 필드

저장 시 자동 갱신:
- `updated`: 현재 ISO timestamp
- 최초 생성 시 `created` 추가

### 11.4 인터페이스

```ts
// src/hooks/useFrontmatter.ts
interface Frontmatter {
  created?: string;
  updated?: string;
  tags?: string[];
  [key: string]: unknown;
}

function useFrontmatter(filePath: string): {
  data: Frontmatter;
  update: (patch: Partial<Frontmatter>) => void;
};
```

---

## 12. 마크다운 변환 규칙

### 12.1 지원 문법 (GFM 기준)

| 문법 | 지원 | 비고 |
|------|-----|------|
| Headings `#` ~ `######` | ✅ | h1~h6 |
| Bold `**` | ✅ | |
| Italic `*` | ✅ | |
| Strike `~~` | ✅ | GFM |
| Inline code `` ` `` | ✅ | |
| Code block ` ``` ` | ✅ | 언어 지정 가능 |
| Link `[text](url)` | ✅ | |
| Image `![alt](src)` | ✅ | |
| Bullet list `-`, `*` | ✅ | |
| Ordered list `1.` | ✅ | |
| Task list `- [ ]` | ✅ | GFM |
| Blockquote `>` | ✅ | |
| HR `---` | ✅ | |
| Table | ✅ | GFM |
| Footnote `[^1]` | ❌ | v1.1+ |
| Wikilink `[[page]]` | ❌ | v2+ (Obsidian 호환) |
| Embed `![[file]]` | ❌ | v2+ |
| Highlight `==text==` | ❌ | v1.1+ |
| Math `$...$` | ❌ | v1.1+ (KaTeX) |

### 12.2 입력 규칙 (Input Rules)

| 입력 | 자동 변환 |
|------|---------|
| `# ` (공백) | H1 |
| `## ` | H2 |
| `- ` | 글머리 기호 |
| `1. ` | 번호 매기기 |
| `[] ` | 체크리스트 |
| `> ` | 인용 |
| ` ``` ` | 코드 블록 |
| `---` + Enter | 구분선 |
| `**text**` | Bold |
| `*text*` | Italic |

---

## 13. 에러 처리

| 에러 | 원인 | 처리 |
|------|------|------|
| MD 파싱 실패 | 잘못된 frontmatter, 깨진 syntax | Raw 텍스트 모드로 폴백, 사용자 알림 |
| 이미지 저장 실패 | 권한, 디스크 공간 | 토스트 에러 + 원본 유지 (붙여넣기 취소) |
| 확장 로드 실패 | 코드 블록 언어 지원 안 함 | plain text로 표시 |
| 초기 로드 중 파일 수정 | 외부 편집 | `conflict` 이벤트 → 자동저장 스펙 참조 |

---

## 14. 엣지 케이스

- **빈 파일**: Placeholder 표시, 즉시 편집 가능
- **매우 큰 파일 (>1MB)**: 경고 다이얼로그, 읽기 전용 모드 제안
- **바이너리 파일 실수 열기**: MIME/확장자 검증 후 거부
- **중첩된 리스트 탭 키**: Tab = 들여쓰기, Shift+Tab = 내어쓰기
- **코드 블록 안의 Tab**: 2칸 공백 삽입 (탈출은 ESC → Tab)
- **이미지 경로 절대/상대**: 저장 시 항상 상대 경로로 정규화

---

## 15. 테스트 케이스

### 15.1 단위 테스트

- [ ] `parseDocument(raw)` — frontmatter 분리
- [ ] `serializeDocument(doc)` — 재조립 일관성
- [ ] 슬래시 커맨드 fuzzy 검색
- [ ] 이미지 파일명 생성 (중복 방지)

### 15.2 통합 테스트

- [ ] MD → ProseMirror → MD 라운드트립 (100개 샘플)
- [ ] Obsidian에서 작성한 파일 로드/편집/저장 → Obsidian에서 재열기
- [ ] 대용량 파일(10,000 라인) 로드 시간
- [ ] 이미지 붙여넣기 → assets 폴더 확인

### 15.3 E2E 시나리오

1. 빈 파일 열기 → `/heading1` 입력 → H1 삽입 → 저장 → 파일에 `# ` 기록됨
2. 이미지 붙여넣기 → assets 저장 → 본문에 참조 → 재로드 시 이미지 표시
3. YAML 있는 파일 열기 → 본문 편집 → 저장 → frontmatter 보존 + `updated` 갱신

---

## 16. 제목 = 파일명 (Obsidian 호환)

> ADR-029 참조. 에디터 본문 위에 제목 입력란을 두고, 표시 제목과 실제 파일 rename을 즉시 동기화한다. 단, editor instance 생명주기는 path 변경과 분리한다.

### 16.1 동작

- 에디터 본문 위에 `<EditorTitleInput>` 컴포넌트 노출
- 표시값: 현재 탭의 `titleDraft ?? basename(currentPath)` (`.md` 제거)
- 사용자가 입력 → `Tab.titleDraft` 즉시 갱신. 제목 입력창, 탭 라벨, split pane 탭 라벨, 파일 트리의 해당 markdown 파일명은 draft를 우선 표시한다.
- 동시에 `rename_entry` IPC를 직렬 큐로 즉시 실행한다. rename 진행 중 추가 입력이 들어오면 최신 입력값만 pending으로 보관하고 현재 rename 성공 직후 이어서 실행한다.
- rename 성공 시 새 path로 `currentPath` 와 모든 탭/pane path를 업데이트하고 `titleDraft` 제거
- editor instance는 `currentPath` 변경만으로 재생성하지 않는다. path 변경은 저장 대상 메타데이터로만 반영하고 본문 editor는 유지한다.
- blur / Enter → 현재 입력값을 rename 큐에 즉시 반영
- Enter로 제목 입력을 완료해도 에디터 본문으로 포커스를 이동하지 않는다.
- rename 성공 직후 탭/분할 pane path와 파일 트리를 직접 갱신한다. watcher 이벤트를 기다리지 않아도 탭 제목과 파일 트리에 새 이름이 즉시 반영된다.
- 외부 rename (watcher `vault:fs-changed` kind=`renamed`) → 입력값 자동 동기화

### 16.2 검증

| 케이스 | 동작 |
|---|---|
| 빈 문자열 | revert (직전 값 복원) + 에러 토스트 안 띄움 (단순 무시) |
| `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` 포함 | revert + 토스트 |
| 선행 `.` (숨김 파일) | revert + 토스트 |
| 100자 초과 | 100자에서 잘라 적용 |
| 같은 디렉터리에 동일 파일 존재 | rename 실패 → 직전 값 revert + 충돌 토스트 |
| 같은 값 (no-op) | rename 호출 안 함 |

### 16.3 자동저장과 race

```
사용자 본문 편집(dirty) → 1500ms 후 자동저장
사용자 제목 편집(dirty title) → titleDraft 즉시 갱신 + rename 트랜잭션 즉시 큐잉
```

이 둘이 겹칠 때 순서:

1. **rename 우선**: 제목 rename 큐 실행 → 본문 자동저장 디바운스 cancel + flush로 강제 저장 → rename 실행 → `currentPath` 갱신 → 후속 자동저장은 새 path 사용
2. 그 반대 (저장 먼저 → rename) 도 안전: 저장은 옛 path에 끝나고, rename이 옛 path → 새 path로 옮김

핵심: rename 직전에 `flushSave` 강제 호출하여 옛 path에 본문 변경이 디스크에 반영되도록.

### 16.4 인터페이스

```ts
// src/components/editor/editor-title-input.tsx
interface EditorTitleInputProps {
  className?: string;
}
// currentPath / setCurrentPath / flushSave 는 useEditorStore에서 직접 가져옴

// src/store/editor-store.ts 추가 액션
renameCurrent: (newName: string) => Promise<RenameResult>;
type RenameResult =
  | { ok: true; newPath: string }
  | { ok: false; reason: "invalid" | "conflict" | "ipc_error"; message: string };
```

`renameCurrent` 가 한 일:
1. 입력값 sanitize + validate
2. `flushSave()` 호출 (현재 본문 디스크에 반영)
3. `ipc.renameEntry(oldPath, newPath)` 호출
4. 성공 시 `currentPath` 갱신, 탭/검색 인덱스 emit
5. 실패 시 reason 반환

### 16.5 인덱스 갱신

ADR-027 후속과 동일 패턴: rename 성공 직후 직접 호출
- `useTabStore.rename(oldPath, newPath)`
- `useSearchStore.index.renameDoc(oldPath, newPath)` — 신규 메서드 필요
- `useTagStore.renamePath(oldPath, newPath)` — 신규
- `useBacklinkStore.renamePath(oldPath, newPath)` — 신규

각 index는 path 기반 키이므로 swap 후 외부 query 재실행.

### 16.6 UI

```
┌─────────────────────────────────────────┐
│  제목 입력란 (h1 스타일, border 없음)    │
│  ┌────────────────────────────────────┐ │
│  │ 가나다라                            │ │
│  └────────────────────────────────────┘ │
│                                          │
│  속성 패널 (Properties Panel)            │
│  🏷  tags     [chip] [chip] |____|     │
│  ...                                     │
│                                          │
│  ──── 본문 ────                          │
│  여기서 자유롭게 작성...                 │
└─────────────────────────────────────────┘
```

- title input: `text-3xl font-semibold` 정도, 단일 라인, placeholder "제목 없음"
- focus 스타일은 약간만 (border-bottom)
- Enter → 제목 rename만 확정하고 제목 입력창 포커스 유지
- Tab → 본문 첫 라인으로 포커스 이동
- 본문에서 ↑ 키로 첫 라인일 때 → 제목으로 포커스 (P1)

### 16.7 엣지케이스

| 상황 | 동작 |
|---|---|
| `currentPath` null (파일 안 열림) | title input 자체를 렌더하지 않음 |
| 파일이 외부에서 삭제됨 | watcher → `closeFile` → title 입력란 사라짐 |
| 동시에 본문 + 제목 둘 다 dirty | flushSave 먼저, 그 다음 rename |
| rename 도중 사용자가 또 입력 | 새 `titleDraft`를 즉시 갱신하고 최신 입력값만 pending rename으로 보관한다. 현재 rename 성공 후 새 path 기준으로 다음 rename을 이어서 실행한다. |
| 한글 IME 조합 중 | 조합 중엔 로컬 value만 갱신하고, `compositionend` 후 `titleDraft`에 반영한다. |

---

## 17. Editor view 자식 패널 마운트 정책 (ADR-030)

**규칙:** `<EditorView>` 의 `<div ref={scrollRef}>` 안에 React 컴포넌트로 들어가는 모든 패널 (PropertiesPanel, BlockMenu, BubbleMenu wrapper, TableMenu wrapper 등) 은 **조건부 mount/unmount 를 하지 않는다**. 가시성은 `hidden` 클래스 / `aria-hidden` 으로만 토글한다.

**이유:** 같은 부모 div 에 `<EditorContent>` (PM 이 직접 DOM 관리) + PM plugin views (DragHandle, BubbleMenu 등 imperative DOM 조작) 가 형제로 존재한다. 사용자 입력으로 PM tr 적용과 React 의 mount commit 이 같은 task tick 에 일어나면 두 reconciler 가 같은 child list 를 두고 race → WebKit `NotFoundError: The object can not be found here` throw.

**적용 패턴:**

```tsx
// ❌ Race 위험
if (someCondition) return null;
return <div>...</div>;

// ✅ 안전
return (
  <div className={cn("...", !visible && "hidden")} aria-hidden={!visible}>
    ...
  </div>
);
```

진짜 mount/unmount 가 필요한 케이스 (예: 메모리 무거운 위젯) 는 **portal 로 분리** — `document.body` 같은 PM 부모와 무관한 root 로 옮긴다. context menu / popover 같이 위치 자유로운 컴포넌트엔 portal 이 자연스럽다.

**디버깅 인프라**: 비슷한 race 가 의심될 때 `<ErrorBoundary>` (panel 단위 inline) + `tauri-plugin-log` 로그 (`~/Library/Logs/app.munix.desktop/munix.log`) + `window.error` 글로벌 트랩 모두 셋업되어 있음. ADR-030 참조.

---

## 18. 오픈 이슈

1. **ProseMirror 충실도**: Tiptap의 `@tiptap/markdown`이 일부 노드(예: 인용 내 코드 블록)에서 round-trip 깨짐 → 자체 직렬화기 고려?
2. **이미지 캐시**: 큰 이미지 매번 파일 시스템 읽기 부담 → WebView의 Tauri asset protocol 사용
3. **Undo 범위**: 외부 파일 변경 병합 후 undo 스택을 유지할지 초기화할지
4. **멀티 커서**: v1에서 지원? (Tiptap 기본 미지원)
5. **Syntax highlighting 번들 크기**: lowlight 전체 포함 시 400KB+ → dynamic import로 언어별 lazy load?

---

**문서 버전:** v0.1
**작성일:** 2026-04-25
**관련 문서:**
- [auto-save-spec.md](./auto-save-spec.md)
- [keymap-spec.md](./keymap-spec.md)
