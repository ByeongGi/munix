# Munix — 개발 설계 초안 v0.3

> Obsidian과 호환되는 `.md` 파일을 블록 기반 에디터로 편집하는 로컬 퍼스트 데스크톱 앱.
>
> **프로젝트명:** Munix (무닉스)
> **기원:** Mu(無, 불필요한 것을 덜어냄) + Onyx(단단하고 차분한 검은 보석)
> **원작자:** 개인 프로젝트

---

## 1. 프로젝트 개요

### 1.1 배경

- Notion/Obsidian의 클라우드 동기화가 보안상 사용 불가한 환경이 있음
- 기존 로컬 노트 앱들은 블록 에디터 UX가 약하거나(Obsidian) 라이선스 제약이 있음(SiYuan AGPL)
- Tauri + 모던 에디터 스택을 실무 레벨로 검증하는 사이드 프로젝트 가치 있음

### 1.2 목표

1. **로컬 저장** — 모든 데이터는 사용자 디스크에만. 서버/클라우드 0
2. **`.md` 네이티브** — Obsidian/VSCode와 같은 파일을 편집할 수 있는 완전 상호운용
3. **Notion급 블록 편집 UX** — 슬래시 메뉴, 드래그 핸들, 인라인 포맷팅
4. **라이선스 자유** — 전 스택 MIT/Apache 계열. 추후 오픈소스 공개/상용화 제약 없음
5. **가벼움** — 번들 크기 50MB 이하, 메모리 200MB 이하 지향

### 1.3 비목표 (명시적 제외)

- 실시간 협업 (단일 사용자 전제)
- 클라우드 동기화, 자체 호스팅 백엔드
- 모바일 지원 (v1에서는 데스크톱만)
- AI 기능 (v1 이후 검토)
- 커스텀 플러그인 시스템 (v2 이후)

---

## 2. 기술 스택

### 2.1 전체 구성

| 레이어 | 선택 | 라이선스 | 선택 근거 |
|---|---|---|---|
| 앱 셸 | Tauri 2.x | Apache 2.0 / MIT | Electron 대비 10배 가벼움, Rust 백엔드 |
| UI 프레임워크 | React 19 | MIT | 기존 실무 스택 |
| 에디터 코어 | Tiptap 3.x + @tiptap/markdown | MIT | 블록 UX, 공식 MD 양방향 지원 |
| UI 레퍼런스 | novel (참고용 복붙) | Apache 2.0 | Notion UX 검증된 구현 |
| 컴포넌트 | shadcn/ui + Radix | MIT | 커스터마이징 자유 |
| 스타일 | Tailwind CSS v4 | MIT | 기존 실무 스택 |
| 상태 관리 | Zustand | MIT | 간단, React 친화적 |
| 빌드 | Vite | MIT | Tauri 공식 권장 |
| 런타임 (Rust) | tokio, serde, notify | MIT/Apache | 표준 Rust 생태계 |
| 검색 (옵션) | MiniSearch (JS) 또는 Tantivy (Rust) | MIT | 단계적 도입 |

### 2.2 의존성 원칙

- 모든 런타임 의존성은 **MIT/Apache/BSD** 계열만
- MPL/LGPL/GPL/AGPL 제외 → 미래 라이선스 자유 확보
- 개발 의존성(빌드 도구)은 제약 없음

### 2.3 Node/Rust 버전

- Node.js 20 LTS 이상
- Rust 1.77 이상 (Tauri 2 요구사항)
- pnpm 9 (모노레포는 아니지만 워크스페이스 확장 대비)

---

## 3. 아키텍처

### 3.1 프로세스 구조

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri App (단일 프로세스)              │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │              WebView (Chromium/WebKit)             │  │
│  │                                                    │  │
│  │   React App (Vite 빌드)                            │  │
│  │   ├─ Editor (Tiptap + Markdown extension)          │  │
│  │   ├─ Sidebar (File tree)                           │  │
│  │   ├─ Command Palette (Cmd+K)                       │  │
│  │   └─ Search UI                                     │  │
│  │                                                    │  │
│  │   ↕ invoke() / event                               │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↕ IPC                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Rust Core (Tauri backend)             │  │
│  │                                                    │  │
│  │   ├─ FS Commands (read/write/list/watch)           │  │
│  │   ├─ Vault Manager (워크스페이스 경로 관리)         │  │
│  │   ├─ Index (검색 인덱스, 옵션)                     │  │
│  │   └─ App State (현재 vault, 설정)                  │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↕                                 │
└─────────────────────────────────────────────────────────┘
                          ↕
           ┌─────────────────────────────┐
           │  Local File System           │
           │  ~/Documents/Munix/          │
           │  ├─ notes/*.md               │
           │  ├─ assets/*.png             │
           │  └─ .munix/ (앱 메타)         │
           └─────────────────────────────┘
```

### 3.2 데이터 흐름

**파일 열기:**

```
User clicks file
  → Sidebar.onFileClick(path)
  → invoke('read_file', { path })
  → Rust: std::fs::read_to_string(path)
  → return markdown string
  → Editor.setContent(md, { contentType: 'markdown' })
  → Tiptap parses → ProseMirror state → render
```

**파일 저장 (자동):**

```
User types in editor
  → onUpdate callback
  → debounce 750ms
  → editor.getMarkdown()
  → invoke('write_file', { path, content })
  → Rust: std::fs::write(path, content)
  → emit event 'file-saved'
  → UI updates "saved" indicator
```

**파일 시스템 변경 감지:**

```
External change (git pull, Obsidian 편집 등)
  → notify crate detects mtime change
  → Rust emits 'file-changed' event
  → React listens, prompts reload
```

---

## 4. 프로젝트 구조

```
munix/
├── src/                          # React (프론트엔드)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── editor/
│   │   │   ├── Editor.tsx         # Tiptap 래퍼
│   │   │   ├── extensions.ts      # Tiptap 확장 모음
│   │   │   ├── SlashMenu.tsx      # 슬래시 커맨드
│   │   │   ├── BubbleMenu.tsx     # 선택 시 툴바
│   │   │   └── DragHandle.tsx     # 드래그 핸들
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── FileTree.tsx
│   │   │   └── FileTreeItem.tsx
│   │   ├── search/
│   │   │   ├── SearchDialog.tsx
│   │   │   └── SearchResult.tsx
│   │   ├── palette/
│   │   │   └── CommandPalette.tsx  # Cmd+K
│   │   └── ui/                     # shadcn 컴포넌트
│   ├── hooks/
│   │   ├── useVault.ts
│   │   ├── useFile.ts
│   │   ├── useAutoSave.ts
│   │   └── useFileWatcher.ts
│   ├── lib/
│   │   ├── fs.ts                   # Tauri invoke 래퍼
│   │   ├── markdown.ts             # MD 유틸
│   │   └── paths.ts                # 경로 계산
│   ├── store/
│   │   ├── vault.ts                # Zustand: 현재 vault
│   │   ├── editor.ts               # Zustand: 현재 문서
│   │   └── settings.ts             # Zustand: 설정
│   └── styles/
│       └── globals.css
│
├── src-tauri/                     # Rust (백엔드)
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── fs.rs               # read/write/list/rename/delete
│   │   │   ├── vault.rs            # vault 선택/전환
│   │   │   └── watch.rs            # 파일 감시
│   │   ├── vault.rs                # Vault 구조체
│   │   ├── state.rs                # AppState
│   │   └── error.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
│
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json                # shadcn 설정
├── .gitignore
└── README.md
```

---

## 5. 핵심 모듈 상세

### 5.1 Editor

**핵심 요구사항:**
- `.md` 파일 로드 → 시각적 편집 → `.md` 저장 라운드트립
- 슬래시 커맨드로 블록 삽입 (heading, list, quote, code, image, divider)
- 선택 시 인라인 포맷팅 (bold, italic, code, link, strike)
- 드래그 핸들로 블록 순서 변경
- 이미지 drag & drop → `assets/` 폴더로 복사 후 상대 경로 참조

**확장 구성:**

```ts
// src/components/editor/extensions.ts
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';

export const extensions = [
  StarterKit.configure({ codeBlock: false }),
  CodeBlockLowlight, // 구문 강조
  Link.configure({ openOnClick: false }),
  Image,
  Table, TableRow, TableCell, TableHeader,
  TaskList, TaskItem,
  Placeholder.configure({ placeholder: '뭐든 써보세요…' }),
  Markdown.configure({ markedOptions: { gfm: true } }),
  // 커스텀: 슬래시 커맨드, 드래그 핸들 (novel 참고)
];
```

**라운드트립 전략:**
- 저장 시: `editor.getMarkdown()` → 파일에 그대로 기록
- 로드 시: `editor.commands.setContent(md, { contentType: 'markdown' })`
- 일부 Tiptap 고유 속성은 MD로 표현 불가 → **문서 상단 YAML frontmatter로 메타데이터 저장 고려**
  - → Properties UI / 타입 시스템 상세는 ADR-028, ADR-029, specs/frontmatter-properties-spec.md 참조

```md
---
created: 2026-04-24T10:00:00Z
updated: 2026-04-24T15:30:00Z
tags: [project, prepay]
---

# 실제 본문
```

### 5.2 Vault Manager (Rust)

**Vault** = 사용자가 선택한 루트 폴더 (Obsidian의 vault 개념 그대로)

```rust
// src-tauri/src/vault.rs
pub struct Vault {
    pub root: PathBuf,
    pub name: String,
}

impl Vault {
    pub fn open(path: PathBuf) -> Result<Self> {
        // .munix 폴더 생성 (없으면)
        // 유효성 검사
    }

    pub fn list_files(&self) -> Result<Vec<NoteMeta>> {
        // root 재귀 탐색, .md 파일만
    }

    pub fn read(&self, rel_path: &str) -> Result<String> {
        // root 기준 상대 경로로 읽기
    }

    pub fn write(&self, rel_path: &str, content: &str) -> Result<()> {
        // 원자적 쓰기 (temp file → rename)
    }
}
```

**보안 고려:**
- 모든 경로는 vault root 기준 상대 경로로만 허용
- `..` path traversal 차단
- 심볼릭 링크 따라가지 않음 (기본)

### 5.3 File Tree

**요구사항:**
- 트리 형태로 폴더/파일 표시
- 폴더 접기/펴기
- 파일 클릭 시 에디터에 로드
- 우클릭 컨텍스트 메뉴 (새 파일, 새 폴더, 이름 변경, 삭제)
- 파일 시스템 변경 실시간 반영

**상태 관리:**

```ts
// src/store/vault.ts
type VaultState = {
  rootPath: string | null;
  files: FileNode[];
  currentFile: string | null;
  openVault: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
};
```

### 5.4 자동 저장

**전략:**
- 타이핑 멈춘 후 750ms debounce
- 포커스 아웃 시 즉시 저장
- 파일 전환 시 즉시 저장
- 앱 종료 시 동기적 저장

```ts
// src/hooks/useAutoSave.ts
export function useAutoSave(editor: Editor, filePath: string) {
  const save = useDebouncedCallback(async () => {
    const md = editor.storage.markdown.getMarkdown();
    await invoke('write_file', { path: filePath, content: md });
  }, 750);

  useEffect(() => {
    editor.on('update', save);
    return () => { editor.off('update', save); save.flush(); };
  }, [editor, filePath]);
}
```

### 5.5 검색 (v1.1)

**v1:** 파일명 검색만 (instant)
**v1.1:** 전문 검색
- 옵션 A: MiniSearch (JS, 인메모리, ~1000 파일까지 OK)
- 옵션 B: Tantivy (Rust, 디스크 인덱스, 대용량)

v1에서는 단순하게 가고, 노트 개수가 늘어나면 옵션 B로 마이그레이션.

---

## 6. 로드맵

### Phase 0: 환경 세팅 (0.5일)

- [ ] Tauri 2 프로젝트 생성 (`create-tauri-app`)
- [ ] Vite + React + TS 템플릿 선택
- [ ] Tailwind v4 + shadcn/ui 세팅
- [ ] Tiptap + @tiptap/markdown 설치
- [ ] ESLint + Prettier + husky
- [ ] 기본 폴더 구조 생성

### Phase 1: MVP — 에디터 + 단일 파일 (주말 1)

- [ ] Tiptap 에디터 컴포넌트 + StarterKit + Markdown 확장
- [ ] Rust: `read_file`, `write_file` 커맨드
- [ ] React: 파일 경로 하드코딩해서 로드/저장
- [ ] 자동 저장 (debounce)
- [ ] 기본 스타일링 (Prose like)

**완료 조건:** 특정 `.md` 파일을 열어서 편집하고 저장하면 파일에 반영됨. Obsidian으로 열어서 확인 가능.

### Phase 2: Vault + File Tree (주말 2)

- [ ] 폴더 선택 다이얼로그 (Tauri dialog API)
- [ ] Rust: `open_vault`, `list_files` 커맨드
- [ ] React: Sidebar + FileTree 컴포넌트
- [ ] 파일 클릭 → 에디터 로드
- [ ] 폴더 접기/펴기 (localStorage에 상태 저장)
- [ ] 마지막 열었던 vault 기억 (앱 설정)

**완료 조건:** 폴더 선택 → 트리 표시 → 파일 클릭해서 편집.

### Phase 3: 파일 조작 (주말 3)

- [ ] 새 파일 생성 (컨텍스트 메뉴, 단축키)
- [ ] 새 폴더 생성
- [ ] 이름 변경
- [ ] 삭제 (휴지통으로 이동 — `trash` crate)
- [ ] 파일 이동 (drag & drop)
- [ ] 파일 시스템 변경 감지 (`notify` crate)

### Phase 4: 에디터 UX 고급 (주말 4~5)

- [ ] 슬래시 커맨드 메뉴
- [ ] 블록 드래그 핸들
- [ ] 선택 시 버블 메뉴 (bold/italic/link 등)
- [ ] 이미지 drag & drop → assets 폴더 복사
- [ ] 코드 블록 구문 강조 (lowlight)
- [ ] 체크박스 (task list)
- [ ] 테이블

### Phase 5: 검색 & 내비게이션 (주말 6)

- [ ] Cmd+P 파일 빠른 열기 (fuzzy)
- [ ] Cmd+K 커맨드 팔레트
- [ ] 전문 검색 (MiniSearch)
- [ ] 최근 파일 목록

### Phase 6: 품질 & 배포 (주말 7)

- [ ] 다크 모드 (시스템 연동)
- [ ] 단축키 커스터마이징 (최소한 기본 단축키 정의)
- [ ] 설정 화면
- [ ] macOS/Windows/Linux 빌드 스크립트
- [ ] 자동 업데이트 (옵션 — 개인용이면 스킵)
- [ ] README, 스크린샷

### Phase 7 이후 (v1.1+)

- 백링크 `[[wikilink]]` 지원
- 태그 `#tag` 패널
- 그래프 뷰
- 플러그인 시스템
- AI 기능 (요약, 재작성 — BYOK)

---

## 7. 주요 의사결정 기록

| # | 결정 | 근거 | 대안 |
|---|---|---|---|
| 1 | Tauri (not Electron) | 바이너리/메모리 효율, Rust 안전성 | Electron: 친숙하지만 무거움 |
| 2 | Tiptap (not BlockNote) | MIT 라이선스, 커스터마이징 자유 | BlockNote: 빠르지만 MPL |
| 3 | `.md` 저장 (not JSON/SQLite) | 이식성, Obsidian 호환 | JSON: 충실도 높지만 종속 |
| 4 | 단일 vault 선택 방식 | Obsidian 사용자 친화, 단순 | 다중 vault: v2 이후 검토 |
| 5 | Zustand (not Redux/Jotai) | 최소 보일러플레이트 | Redux Toolkit: 과함 |
| 6 | shadcn (not MUI/Mantine) | 복붙 기반, 라이선스 깔끔 | MUI: 무거움 |
| 7 | 단일 프로세스 + IPC | Tauri 표준 패턴 | 별도 서버: 불필요 |

---

## 8. 위험 및 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| Tiptap MD 확장이 얼리 릴리즈 | 엣지 케이스 버그 | 초기에는 단순 MD만 지원, 복잡한 블록은 v1.1에서 확장 |
| 대량 파일(1000+) 트리 성능 | UI 느려짐 | 가상 스크롤링(`react-virtuoso`), 폴더 lazy load |
| Windows 경로 처리 | 버그 빈발 | `pathe` 또는 Rust 쪽에서 `PathBuf` 일관 사용 |
| 파일 동시 편집 (외부 앱) | 데이터 손실 | mtime 비교 → 충돌 시 사용자에게 선택 제공 |
| WebView 보안 | XSS via 악성 MD | Tiptap의 sanitization 신뢰 + CSP |

---

## 9. 오픈 이슈 (결정 필요)

1. ~~**앱 이름**~~ — **Munix (무닉스)** 로 확정. 기원: Mu(無, 불필요한 것을 덜어냄) + Onyx(단단하고 차분한 검은 보석)
2. **라이선스** — 오픈소스 공개할 경우 MIT vs Apache 2.0 결정
3. **vault 메타 폴더 구조** — `.munix/` 안에 뭘 저장할지 (설정, 인덱스, 캐시)
4. **YAML frontmatter 파싱** — Tiptap으로 직접 할지, 별도 파서 둘지
5. **마크다운 변형** — CommonMark vs GFM vs Obsidian 확장 문법(`[[wikilink]]`, `![[embed]]`)을 어디까지 지원할지

---

## 10. 참고 자료

- [Tauri 2 Docs](https://v2.tauri.app/)
- [Tiptap Editor](https://tiptap.dev/)
- [@tiptap/markdown](https://tiptap.dev/docs/editor/markdown)
- [novel.sh](https://github.com/steven-tey/novel) — 구조 참고
- [Obsidian](https://obsidian.md/) — UX 참고
- [shadcn/ui](https://ui.shadcn.com/)

---

**문서 버전:** v0.3
**작성일:** 2026-04-25
**변경 이력:**
- v0.3 — 프로젝트명 Munix(무닉스)로 변경. 기원을 Mu(無) + Onyx 기반으로 재정의. 관련 경로/메타 폴더명(`~/Documents/Munix/`, `.munix/`) 업데이트
- v0.2 — 프로젝트명 Mupe 확정, 관련 경로/메타 폴더명 업데이트
- v0.1 — 초안 작성
**다음 리뷰:** Phase 0 완료 후
