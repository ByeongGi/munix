# Munix — 프로젝트 컨텍스트

> 이 파일은 Codex 세션 시작 시 자동으로 로드되는 프로젝트 컨텍스트다.
> 새 대화에서도 이 정보를 기반으로 즉시 작업 가능하도록 작성.

---

## 🎯 프로젝트 개요

**Munix (무닉스)** — Obsidian 호환 `.md` 파일을 블록 기반 에디터로 편집하는 로컬 퍼스트 데스크톱 노트앱.

- **기원**: Mu(無, 불필요한 것을 덜어냄) + Onyx(단단하고 차분한 검은 보석)
- **원작자**: 개인 프로젝트
- **타겟**: 클라우드 동기화가 보안상 불가한 환경에서 Obsidian/Notion 대체

---

## 🏗 기술 스택 (확정)

| 레이어 | 선택 |
|-------|------|
| 앱 셸 | **Tauri 2.x** (Rust + WebView) |
| UI 프레임워크 | **React 19** + TypeScript |
| 에디터 | **Tiptap 3.x** + `@tiptap/markdown` |
| 컴포넌트 | **shadcn/ui + Radix** |
| Variant 시스템 | **tailwind-variants** (not CVA) |
| 스타일 | **Tailwind CSS v4** |
| 상태 관리 | **Zustand** |
| 빌드 | **Vite** |
| 패키지 매니저 | **pnpm 9** |
| 검색 (v1) | **fuse.js** + **MiniSearch** |
| 검색 (v1.2) | **Tantivy** (Rust, `lindera-tantivy`) |
| 이미지 처리 | **image crate** (Rust) |
| 라이선스 | **MIT** |

**버전 요구:** Node 20 LTS+, Rust 1.77+

---

## 📁 프로젝트 디렉터리 구조

```
note-app/
├── AGENTS.md                    # 이 파일
├── docs/                         # 설계/ADR/스펙 문서
│   ├── decisions.md              # ADR 기록
│   ├── implementation-plan.md    # Phase 0-6 체크리스트
│   └── specs/                    # 기능별 상세 설계
│       ├── README.md
│       ├── editor-spec.md
│       ├── vault-spec.md
│       ├── auto-save-spec.md
│       ├── file-tree-spec.md
│       ├── keymap-spec.md
│       ├── search-spec.md
│       ├── settings-spec.md
│       └── theme-spec.md
└── munix/                        # 구현 코드 (Phase 0에서 생성)
    ├── src/                      # React
    ├── src-tauri/                # Rust
    └── ...
```

---

## 🎨 브랜딩

- **컬러 팔레트**
  - 베이스: `#0A0A0A` (딥 블랙, 오닉스)
  - 액센트: `#0F766E` (오닉스 틸)
  - 화이트: `#FFFFFF`
- **폰트**: Pretendard(한글), JetBrains Mono(코드)
- **디자인 철학**: 오닉스 모노크롬 × 옵시디언 다크 × Notion UX

---

## 🧭 핵심 의사결정 (요약)

중요한 결정은 [decisions.md](./docs/decisions.md) 참조. 반드시 알아둬야 할 것:

1. **`.md` 네이티브 저장** — Obsidian 100% 호환, 메타 폴더는 `.munix/`
2. **멀티 vault** — cmux 스타일 좌측 세로 Vault Dock 으로 여러 vault 를 동시에 열고 전환. 글로벌 목록은 backend `munix.json`, 워크스페이스(탭/사이드바)는 vault 별 `.munix/workspace.json`. (ADR-031, ADR-032 — 이전 ADR-004 단일 vault 결정은 supersede)
3. **탭 멀티 문서** — v1.0에 포함 (최대 10개)
4. **자동 저장** — 750ms debounce, blur 시 즉시
5. **백업** — 매 저장마다 `.munix/backup/{hash}/previous.md`
6. **YAML frontmatter** — 전용 블록 노드로 편집 가능하게
7. **이미지** — `assets/{yyyymmdd}-{uuid}.{ext}`, 썸네일 캐시 `.munix/cache/thumbs/`
8. **검색** — fuse(파일명) + MiniSearch(본문), v1.2에 Tantivy 옵션
9. **다크모드** — system 기본, 사용자 override 가능
10. **라이선스** — MIT

---

## 📐 코드 컨벤션

### TypeScript

- **엄격 모드 필수**: `strict: true`, `noUncheckedIndexedAccess: true`
- **함수형 선호**: class보다 function + hook
- **path alias**: `@/` = `src/`
- **타입 정의 위치**: `src/types/*.ts` (공통), 컴포넌트 옆 (로컬)
- **Enum 금지**: union string literal 사용 (`'light' | 'dark' | 'system'`)

### React

- **파일/폴더명**: **kebab-case** (소문자 + 대시) 고정
  - 컴포넌트: `file-tree.tsx`, `slash-menu.tsx`, `editor-toolbar.tsx`
  - 훅: `use-editor.ts`, `use-auto-save.ts`
  - 유틸: `format-date.ts`, `path-utils.ts`
  - 폴더: `src/components/editor/`, `src/hooks/`, `src/components/file-tree/`
- **export 이름은 원래 규칙 유지**: 컴포넌트 `PascalCase`, 훅 `useXxx`, 함수/변수 `camelCase`, 타입 `PascalCase`
- **파일당 컴포넌트 1개** 원칙 (유틸 헬퍼는 같이 OK)
- **useEffect 사용 최소화**: 파생 상태는 렌더 시 계산
- **Prop drilling 3단계 이상이면 Zustand로**
- **신규 UI 텍스트는 `t()` 사용** (i18n) — 하드코딩 한글 금지. namespace는 영역별 분리 (`settings`, `editor`, `palette`, `vault`, `search`, `tabs`, `common`). 점진적 마이그레이션 진행 중 — [specs/i18n-spec.md](./docs/specs/i18n-spec.md) 참조. 기존 한글 하드코딩은 만져야 할 때 같이 추출

### Rust

- **에러 타입**: `thiserror` + `serde::Serialize` (프론트 공유용)
- **Async**: `tokio` 런타임
- **파일 I/O**: vault 모듈 통해서만 (직접 `std::fs` 금지)
- **경로**: 항상 vault root 기준 상대 경로로 IPC 주고받기
- **clippy warning을 error로**

### Tailwind

- **토큰 사용**: 하드코딩된 색상 금지, `var(--color-bg-primary)` 등 CSS 변수 기반
- **arbitrary value 최소화**: `[13px]` 같은 것 대신 스케일 사용
- **반응형**: 앱 특성상 데스크톱 고정, 최소 900px 너비
- **Variant 시스템**: `tailwind-variants`의 `tv()` 사용 (slots 기능 적극 활용)
- **className 병합**: `@/lib/cn.ts` 유틸(`clsx + twMerge`) 사용

### 커밋 메시지

```
{타입}({스코프}): {요약}

{본문 (선택)}
```

- 타입: feat, fix, refactor, chore, docs, test, style
- 스코프: editor, vault, tree, search, settings, theme, infra
- 예: `feat(editor): add slash command menu`

---

## 🚀 구현 단계 요약

| Phase | 내용 | 기간 (주말 기준) |
|-------|------|-----|
| 0 | 환경 세팅 (Tauri+React+Tiptap) | 0.5일 |
| 1 | MVP — 에디터 + 단일 파일 | 1주 |
| 2 | Vault + File Tree | 1주 |
| 3 | 파일 조작 + Watcher | 1주 |
| 4 | 에디터 UX 고급 | 2주 |
| 5 | 탭 + 검색 + 팔레트 | 1-2주 |
| 6 | 설정 + 테마 + 배포 | 1주 |

자세한 체크리스트는 [implementation-plan.md](./docs/implementation-plan.md) 참조.

---

## 📚 문서 네비게이션

| 문서 | 용도 | 읽어야 할 때 |
|------|------|------------|
| [decisions.md](./docs/decisions.md) | ADR 기록 | "왜 이렇게 결정했지?" |
| [implementation-plan.md](./docs/implementation-plan.md) | 구현 체크리스트 | 다음 할 일 찾을 때 |
| [specs/README.md](./docs/specs/README.md) | 스펙 인덱스 | 기능별 상세 필요할 때 |
| [specs/editor-spec.md](./docs/specs/editor-spec.md) | 에디터 상세 | 에디터 작업 시 |
| [specs/vault-spec.md](./docs/specs/vault-spec.md) | Vault 상세 | Rust 작업 시 |
| [specs/auto-save-spec.md](./docs/specs/auto-save-spec.md) | 자동저장 | 저장 로직 |
| [specs/file-tree-spec.md](./docs/specs/file-tree-spec.md) | 파일 트리 | 사이드바 작업 |
| [specs/keymap-spec.md](./docs/specs/keymap-spec.md) | 단축키 | 단축키 추가/변경 |
| [specs/search-spec.md](./docs/specs/search-spec.md) | 검색 | 검색 기능 |
| [specs/settings-spec.md](./docs/specs/settings-spec.md) | 설정 | 설정 추가 |
| [specs/theme-spec.md](./docs/specs/theme-spec.md) | 테마 | 스타일/색상 |

---

## 🧪 테스트 전략

- **단위 테스트**: Vitest (프론트), `cargo test` (Rust)
- **통합 테스트**: Playwright (Tauri용으로 제한적)
- **수동 검증 체크리스트**: 각 Phase 완료 시 실행 ([implementation-plan.md](./docs/implementation-plan.md) 참조)
- **커버리지 목표**: 핵심 모듈(vault, save, markdown 변환) 80%+, UI는 기능 확인 위주

---

## ⚠️ 중요한 주의 사항

### 보안

- **모든 FS 접근은 vault 모듈을 통과**해야 함 (경로 검증 포함)
- path traversal (`..`) 항상 차단
- 심볼릭 링크 기본 미따라감
- CSP 설정 활성화
- Tauri `allowlist.fs` 비활성화 (자체 커맨드만 사용)

### 성능

- 대량 파일 트리: 200개 초과 시 가상 스크롤
- 자동 저장: 파일당 pending 1개로 제한
- 인덱스 빌드: Web Worker에서 (v1.1+)
- 이미지: 썸네일 캐시 활용

### 호환성

- **Obsidian 호환 유지 절대 원칙**
  - `.md` 파일은 표준 GFM
  - `.munix/`만 앱 전용, 나머지는 건드리지 않음
  - frontmatter도 표준 YAML
- Windows 경로: `PathBuf` 일관, 프론트와는 `/` 구분자로 통일

### 라이선스

- 모든 런타임 의존성: **MIT/Apache/BSD 계열만**
- MPL/LGPL/GPL/AGPL 제외
- 추가 시 `LICENSE` + `THIRD_PARTY_NOTICES.md` 업데이트

---

## 🔧 개발 환경

### 로컬 실행

```bash
cd munix
pnpm install
pnpm tauri dev         # 개발 서버 + Tauri 창
pnpm test             # Vitest
pnpm lint             # ESLint
cd src-tauri && cargo test
cd src-tauri && cargo clippy
```

### 빌드

```bash
pnpm tauri build       # 플랫폼 네이티브 빌드
```

### 아이콘/에셋

- `src-tauri/icons/` — 플랫폼별 아이콘
- 로고 소스: `design/` 폴더에 보관 (Figma 등)

---

## 💡 작업 시 참고 팁

1. **먼저 관련 스펙 읽기** — 각 기능은 `docs/specs/` 하위 문서에 상세 설계 있음
2. **결정이 필요하면 `docs/decisions.md` 확인** — 이미 결정된 게 있을 수 있음
3. **Rust 커맨드는 IPC 계약** — 변경 시 TS 타입도 반드시 동기화
4. **Tiptap 확장 추가는 extensions.ts에** — 한 곳에 모음
5. **경로는 항상 `/`** — Windows도 프론트 쪽은 `/` 사용
6. **로깅**: 개발 모드만 `console.log` 허용, 프로덕션은 `warn`/`error`만

---

## 📞 피드백 & 변경

- 중대한 설계 변경: `docs/decisions.md`에 새 ADR 추가
- 스펙 변경: 해당 `docs/specs/*.md` 업데이트 + 버전 증가
- 이 파일은 스토어 변경, 새 모듈 추가, 컨벤션 변경 시 갱신

---

**문서 버전:** v1.0
**작성일:** 2026-04-25
**최근 업데이트:** 2026-04-25 (초안 작성)
