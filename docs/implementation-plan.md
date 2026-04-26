# Munix — 구현 계획

> Phase 0 ~ 6 세부 체크리스트. 각 Phase는 완료 기준(**Exit Criteria**)이 있다.
> 완료 시 체크박스 채우고 PR 머지 후 다음 Phase로 이동.

---

## 📊 진행 현황

| Phase | 제목 | 예상 기간 | 상태 |
|-------|------|---------|------|
| 0 | 환경 세팅 | 0.5일 | ✅ 완료 |
| 1 | MVP — 에디터 + 단일 파일 | 1주 | ✅ 완료 |
| 2 | Vault + File Tree | 1주 | ✅ 완료 (가상 스크롤은 v1.1로 이월) |
| 3 | 파일 조작 + Watcher | 1주 | ✅ 완료 (DnD는 v1.1로 이월) |
| 4 | 에디터 UX 고급 | 2주 | ✅ 완료 (이미지/YAML/드래그 핸들/버블 메뉴/표/슬래시/코드블럭 언어) |
| 5 | 탭 + 검색 + 팔레트 | 1-2주 | ✅ 완료 (탭/Mod+F/Mod+Shift+F/Mod+P/Mod+K + prefix 모드) |
| 6 | 설정 + 테마 + 배포 | 1주 | 🟡 부분완료 (설정·테마·온보딩·LICENSE·README·THIRD_PARTY·Rust app_config_dir·썸네일 캐시 ✓, 아이콘·각 OS 빌드·CSP 미완) |

### 완료된 기능 요약

v1.0 앱 기능은 대부분 구현 완료. 핵심 범위는 Tauri/Rust vault backend, Markdown editor, Obsidian-compatible frontmatter/properties, 파일 트리/CRUD/watcher, 탭/split workspace, 검색/팔레트/패널, 설정/테마/i18n, 온보딩 샘플 vault다.

세부 이력은 `git log --oneline`과 각 스펙/ADR을 기준으로 추적한다. 이 문서는 앞으로 **남은 작업과 부채** 중심으로 유지한다.

---

## Phase 0 — 환경 세팅 (0.5일)

**상태:** ✅ 완료

React 19 + TypeScript + Vite + Tauri 2 프로젝트 생성, Tailwind v4, Tiptap 3, Zustand, Radix primitives, lucide, Vitest, ESLint, Prettier, Rust watcher/FS/image 관련 크레이트까지 기본 개발 환경 구성이 끝났다.

**주요 산출물:** `munix/`, `src-tauri/`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.editorconfig`, `src/lib/cn.ts`, 기본 Tauri IPC 구조.

**결정:** shadcn/ui CLI 초기화는 하지 않고 Radix primitives + 로컬 컴포넌트로 진행.

---

## Phase 1 — MVP: 에디터 + 단일 파일 (1주)

**상태:** ✅ 기능 완료 / 테스트 부채 있음

Tiptap 기반 Markdown 에디터, `read_file`/`write_file`, 원자적 저장, mtime 충돌 감지, 750ms auto-save, blur flush, `Mod+S`, 저장 상태 표시까지 구현 완료.

**남은 부채:**
- [ ] Rust: `write_atomic` 단위 테스트
- [ ] TS: `useAutoSave` debounce 동작 테스트

---

## Phase 2 — Vault + File Tree (1주)

**상태:** ✅ 완료

Vault open/close/info, path traversal 방지, `.munix/` 생성, `validate_name`, 파일 트리, 가상 스크롤, 키보드 네비, `munix.json` 기반 vault registry와 자동 reopen까지 완료.

**결정:** `list_children` lazy load는 구현하지 않고 eager walk + `react-virtuoso`로 대체.

---

## Phase 3 — 파일 조작 + Watcher (1주)

**상태:** ✅ 기능 완료 / UX 개선 부채 있음

파일/폴더 생성, rename, 휴지통 삭제, 이동 DnD, 컨텍스트 메뉴, 경로 복사, Finder reveal, watcher, 자기쓰기 echo suppression, dirty 충돌 감지, 검색/tag/backlink 증분 갱신까지 완료.

**결정:** 영구 삭제 IPC는 제공하지 않음. 로컬 노트앱 안전 정책상 휴지통 삭제만 유지.

**남은 부채:**
- [ ] 충돌 다이얼로그 diff 보기

---

## Phase 4 — 에디터 UX 고급 (2주)

**상태:** ✅ 기능 완료 / 캐시 정리 부채 있음

슬래시 메뉴, 블록 drag handle, BlockMenu, 버블 메뉴, 표, task list, code block 언어/복사, 이미지 paste/drop/resize/alt, YAML frontmatter, Obsidian 호환 Properties, `---` trigger, 제목=파일명, callout, highlight, wikilink, footnote, KaTeX까지 v1.0 에디터 UX로 포함 완료.

**참조:** [editor-spec.md](./specs/editor-spec.md), [frontmatter-properties-spec.md](./specs/frontmatter-properties-spec.md), ADR-028, ADR-029.

**남은 부채:**
- [ ] 이미지 썸네일 캐시 TTL / LRU 정리

---

## Phase 5 — 탭 + 검색 + 팔레트 (1-2주)

**상태:** ✅ 기능 완료 / 검색 성능 부채 있음

탭 시스템, tab DnD, Quick Open, Command Palette prefix 모드, MiniSearch 기반 vault 검색, regex 검색, 검색 결과 line jump 보정, 인파일 검색, Outline/Backlink/Tag/Recent 패널까지 완료.

**참조:** [search-spec.md](./specs/search-spec.md), [keymap-spec.md](./specs/keymap-spec.md)

**남은 부채:**
- [ ] 검색 인덱스 빌드를 Web Worker로 분리
- [ ] 인덱스 localStorage 캐시
- [ ] 1000 파일에서 전문 검색 < 200ms 성능 측정

---

## Phase 6 — 설정 + 테마 + 배포 (1주)

**상태:** 🟡 앱 기능 완료 / 배포 미완

설정 저장(Rust app_config_dir + localStorage fallback), 테마, 폰트 번들, 사용자 CSS, 사용자 정의 단축키, 치트시트, 온보딩 샘플 vault, README/LICENSE/THIRD_PARTY_NOTICES까지 완료.

**참조:** [settings-spec.md](./specs/settings-spec.md), [theme-spec.md](./specs/theme-spec.md)

**남은 부채:**
- [ ] settings version migration
- [ ] CSP 활성화 및 asset protocol 영향 검증
- [ ] 아이콘 세트 생성
- [ ] macOS / Windows / Linux 빌드
- [ ] 새 환경 설치 후 첫 실행 검증

---

## Phase 7+ — v1.1 이후 로드맵

> **2026-04-25 갱신**: 플러그인 시스템(ADR-022)을 v2.0 → **v1.1 핵심 인프라**로 격상.
> 터미널(ADR-023)과 CLI/URI scheme(ADR-024)을 그 위/연관 작업으로 등재. 모두 proposed 상태 — 다음 세션 정식 결정.

**v1.0 후반 — 출시 전 추가 작업 (v1.0 스코프 내):**
- [ ] **CLI + URI scheme 계층 1** — 🆕 [ADR-024](./decisions.md#adr-024-cli--uri-scheme-munix) / [specs/cli-spec.md](./specs/cli-spec.md)
  - `munix://open?vault=...&file=...` URI 처리
  - `munix path/to/note.md` args 파싱
  - single-instance forwarding (`tauri-plugin-single-instance`)
  - OS 통합 (`tauri-plugin-deep-link`) — macOS/Win/Linux
  - 보안: vault 외부 경로 차단, 첫 호출 사용자 승인

**v1.1 (릴리스 후 2-3주):**

v1.1 후보 중 백링크, 태그 패널, Highlight, 각주, KaTeX, 사용자 정의 단축키, 사용자 CSS, 파일 트리 가상 스크롤, 탭/file tree DnD, 블록 액션, Heading fold, i18n Phase A~C는 v1.0에 포함 완료.

- [ ] 🆕 **플러그인 시스템 (Extism WASM)** — [ADR-022](./decisions.md#adr-022-플러그인-시스템-extism-wasm) / [specs/plugin-spec.md](./specs/plugin-spec.md)
  - capability 기반 권한 모델 (`pty`, `fs:vault`, `net`, `clipboard`, `shell:exec` 등)
  - `.munix/plugins/{name}/{manifest.json, plugin.wasm, ui/}`
  - host function (Rust) + WASM hook + iframe sandbox UI
  - WASM hash 검증 + 사용자 capability 승인 모달
  - **2-3주 작업** — v1.1 핵심 인프라
- [ ] 🆕 **터미널 (플러그인 1호)** — [ADR-023](./decisions.md#adr-023-터미널-플러그인-1호) / [specs/terminal-spec.md](./specs/terminal-spec.md)
  - 플러그인 시스템 의존 (선행 필수)
  - xterm.js 5.x + portable-pty (Rust)
  - 사이드/하단 패널, 다중 탭, 셸 선택
  - 너드 폰트 글리프 (starship/p10k) 호환
  - **참고 구현**: [lavs9/obsidian-ghostty-terminal](https://github.com/lavs9/obsidian-ghostty-terminal), [cmux](https://github.com/manaflow-ai/cmux), VS Code terminal
- [ ] 🆕 **CLI 계층 2** — `munix new`, `munix daily`, `munix search`, shell completion (zsh/bash/fish)

**v1.2:**
- [ ] Tantivy 검색 엔진 옵션화
- [ ] 한국어 형태소 분석
- [ ] 전문 검색 고도화 (AND/OR, 폴더 필터)
- [ ] 정규식 검색 안전성 개선
- [ ] 🆕 **ghostty-web 마이그레이션 검토** — libghostty API 안정화 시 xterm.js → ghostty-web 교체 평가 (ADR-023)
- [ ] 🆕 **CLI 계층 3** — Unix socket API (`/tmp/munix.sock`, JSON-RPC), x-callback-url

**v2.0:**
- [ ] 그래프 뷰
- [x] 다중 vault 동시 열기 — ADR-031/032, v1.0 포함
- [x] 분할 뷰 (split) — workspace split, v1.0 포함
- ~~플러그인 시스템~~ → **v1.1로 격상** ([ADR-022](./decisions.md#adr-022-플러그인-시스템-extism-wasm))
- [ ] AI 요약/재작성 (BYOK)
- [ ] 모바일 (iOS/Android Tauri 지원 시)

---

## 🗂 리스크 & 대응

| 리스크 | Phase | 대응 |
|-------|-------|------|
| Tiptap Markdown 확장 round-trip 버그 | 1 | 자체 직렬화 유틸 준비 |
| Windows 경로 처리 버그 | 2, 3 | 초기부터 Windows 검증 |
| 파일 수 > 10,000 퍼포먼스 | 2, 3 | lazy load + 가상 스크롤 |
| 탭 다중 에디터 메모리 | 5 | 비활성 탭 리소스 해제 검토 |
| 이미지 캐시 무효화 버그 | 4 | TTL + checksum 이중 검증 |
| macOS 코드 서명 복잡도 | 6 | 초기에는 서명 없이 배포 (경고 감수) |

---

## 📝 Phase 완료 체크리스트 공통

각 Phase PR 머지 전 확인:

- [ ] `pnpm lint` 통과
- [ ] `pnpm test` 통과
- [ ] `cd src-tauri && cargo clippy -- -D warnings` 통과
- [ ] `cd src-tauri && cargo test` 통과
- [ ] 수동 테스트 체크리스트 수행
- [ ] decisions.md에 새 ADR 추가 (중대 결정 있을 경우)
- [ ] CLAUDE.md 업데이트 (새 컨벤션/모듈 추가 시)
- [ ] 해당 Phase Exit Criteria 모두 달성

---

**문서 버전:** v3.7
**작성일:** 2026-04-25
**최근 업데이트:** 2026-04-26 — Frontmatter Properties (ADR-028) + 제목=파일명 + `---` 트리거 (ADR-029) **9단계 전체 구현 완료**. Onboarding 샘플 vault + Command Palette prefix 모드 + 검색 결과 line jump 보정 완료.
**남은 큰 작업:** 단위 테스트 인프라 강화 / Web Worker 검색 인덱스 빌드 / CSP 활성화 / CLI+URI scheme / 각 OS 빌드+코드 서명.
**관련 문서:** [issues-log.md](./issues-log.md) — 개발 중 겪은 이슈 (Tauri dragDropEnabled, DragHandle props 등 함정 3개 명시)
