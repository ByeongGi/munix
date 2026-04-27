# Architecture Decision Records — Munix

> 프로젝트의 주요 의사결정 기록. 각 결정은 **컨텍스트 → 결정 → 결과**로 정리.

---

## Index

| # | 결정 | 날짜 | 상태 |
|---|------|------|------|
| [ADR-001](#adr-001-tauri-선택) | Tauri (not Electron) | 2026-04-24 | Accepted |
| [ADR-002](#adr-002-tiptap-에디터-선택) | Tiptap (not BlockNote/Lexical) | 2026-04-24 | Accepted |
| [ADR-003](#adr-003-md-파일-네이티브-저장) | `.md` 파일 네이티브 저장 | 2026-04-24 | Accepted |
| [ADR-004](#adr-004-단일-vault-방식) | 단일 vault 선택 방식 | 2026-04-24 | ⛔ Superseded by ADR-031 |
| [ADR-005](#adr-005-zustand-상태-관리) | Zustand (not Redux/Jotai) | 2026-04-24 | Accepted |
| [ADR-006](#adr-006-shadcnui-컴포넌트) | shadcn/ui + Radix | 2026-04-24 | Accepted |
| [ADR-007](#adr-007-프로젝트명-munix) | 프로젝트명 Munix | 2026-04-25 | Accepted |
| [ADR-008](#adr-008-yaml-frontmatter-전용-블록-노드) | YAML frontmatter를 전용 블록으로 | 2026-04-25 | Accepted |
| [ADR-009](#adr-009-검색-엔진-fuse--minisearch-병행) | 검색: fuse + MiniSearch 병행 | 2026-04-25 | Accepted |
| [ADR-010](#adr-010-탭-기반-멀티-문서-v10-포함) | 탭 기반 멀티 문서 v1.0 포함 | 2026-04-25 | Accepted |
| [ADR-011](#adr-011-이미지-썸네일-캐시) | 이미지 썸네일 캐시 | 2026-04-25 | Accepted |
| [ADR-012](#adr-012-매-저장마다-백업-파일-생성) | 매 저장마다 백업 파일 생성 | 2026-04-25 | Accepted |
| [ADR-013](#adr-013-다크모드-기본값-system) | 다크모드 기본값 `system` | 2026-04-25 | Accepted |
| [ADR-014](#adr-014-mit-라이선스) | MIT 라이선스 | 2026-04-25 | Accepted |
| [ADR-015](#adr-015-파일명-패턴-untitled-방식) | 파일명 패턴 Untitled 방식 | 2026-04-25 | Accepted |
| [ADR-016](#adr-016-macos-폴더-권한-lazy-요청) | macOS 폴더 권한 lazy 요청 | 2026-04-25 | Accepted |
| [ADR-017](#adr-017-rust가-fs--검색-인덱스tantivy-담당) | Rust가 FS + Tantivy 담당 | 2026-04-25 | Accepted |
| [ADR-018](#adr-018-tailwind-variants-not-cva) | tailwind-variants (not CVA) | 2026-04-25 | Accepted |
| [ADR-019](#adr-019-wikilink-디자인) | Wikilink `[[target\|alias]]` 디자인 | 2026-04-25 | Accepted (사후 기록) |
| [ADR-020](#adr-020-backlink-인덱싱-전략) | Backlink 인덱싱 (메모리 + 증분) | 2026-04-25 | Accepted (사후 기록) |
| [ADR-021](#adr-021-fs-watcher-self-write-suppression) | FS Watcher self-write suppression | 2026-04-25 | Accepted (사후 기록) |
| [ADR-022](#adr-022-플러그인-시스템-extism-wasm) | 플러그인 시스템 (Extism WASM) | 2026-04-25 | 🟡 Proposed |
| [ADR-023](#adr-023-터미널-플러그인-1호) | 터미널 (플러그인 1호) | 2026-04-25 | 🟡 Proposed |
| [ADR-024](#adr-024-cli--uri-scheme-munix) | CLI + URI scheme (`munix://`) | 2026-04-25 | 🟡 Proposed |
| [ADR-025](#adr-025-다국어-지원-i18next--react-i18next) | 다국어 지원 (i18next) | 2026-04-25 | ✅ Accepted |
| [ADR-026](#adr-026-파일-트리-가상-스크롤-react-virtuoso) | 파일 트리 가상 스크롤 (react-virtuoso) | 2026-04-25 | ✅ Accepted |
| [ADR-027](#adr-027-frontmatter-파싱은-gray-matter-안-쓰고-js-yaml-직접-사용) | Frontmatter 파싱은 js-yaml 직접 | 2026-04-25 | ✅ Accepted |
| [ADR-028](#adr-028-frontmatter-속성-타입은-obsidian-obsidiantypesjson-호환) | Frontmatter 속성 타입 Obsidian 호환 | 2026-04-25 | ✅ Accepted (2026-04-26) |
| [ADR-029](#adr-029-uxui-결정은-obsidian-사용성에-최대한-일치-hr-vs-frontmatter-입력-규칙-포함) | UX/UI는 Obsidian 사용성 우선 | 2026-04-25 | ✅ Accepted (구현 완료 2026-04-26) |
| [ADR-030](#adr-030-pmeditorcontent-형제로-들어가는-react-패널은-항상-마운트-조건부-hidden-토글) | PM 형제 React 패널은 항상 마운트 (조건부 hidden) | 2026-04-26 | ✅ Accepted |
| [ADR-031](#adr-031-멀티-vault-워크스페이스-cmux-스타일-좌측-세로-탭) | 멀티 vault 워크스페이스 (cmux 스타일 좌측 세로 탭) | 2026-04-26 | ✅ Accepted (2026-04-26) |
| [ADR-032](#adr-032-글로벌-vault-레지스트리--munixjson-백엔드-파일) | 글로벌 vault 레지스트리 `munix.json` (backend) | 2026-04-26 | ✅ Accepted (2026-04-26) |

---

## ADR-001: Tauri 선택

**상태:** Accepted
**날짜:** 2026-04-24

### 컨텍스트

데스크톱 앱 프레임워크 선택 필요. 사내 보안 정책상 클라우드 동기화 없는 로컬 퍼스트 앱이어야 함.

### 결정

**Tauri 2.x**를 앱 셸로 채택.

### 결과

**긍정:**
- 바이너리 크기 Electron 대비 ~10배 작음 (~5-15MB)
- 메모리 사용량 1/3 수준
- Rust 백엔드로 안전한 FS 접근
- Apache 2.0 / MIT 라이선스

**부정:**
- WebView 플랫폼별 차이 (Safari/Edge/Webkit)
- Rust 학습 곡선
- 일부 Node.js 생태계 도구 직접 사용 불가

### 대안

- Electron: 친숙하지만 무겁고 느림
- Flutter Desktop: 타이포그래피·텍스트 편집이 약함
- 네이티브 (Swift/Kotlin): 크로스 플랫폼 불리

---

## ADR-002: Tiptap 에디터 선택

**상태:** Accepted
**날짜:** 2026-04-24

### 컨텍스트

블록 기반 WYSIWYG 에디터 필요. 라이선스 제약 없고, MD 호환이 쉬운 것.

### 결정

**Tiptap 3.x** + `@tiptap/markdown` 채택.

### 결과

**긍정:**
- MIT 라이선스 (상업화 자유)
- ProseMirror 기반으로 안정적
- 확장 시스템이 유연
- 공식 Markdown 확장 제공
- React 친화

**부정:**
- `@tiptap/markdown`은 early release, 엣지 케이스 가능
- 자체 가상 DOM 아니라 커스텀 뷰 작성 시 주의
- 번들 크기 ~200KB

### 대안

- BlockNote: UX 좋지만 MPL 라이선스 → 제외
- Lexical (Meta): MIT, 강력함 / MD 지원 약함
- Slate: MIT, 유연하나 직접 모든 걸 만들어야
- Milkdown: MD 중심 / 생태계 작음

---

## ADR-003: `.md` 파일 네이티브 저장

**상태:** Accepted
**날짜:** 2026-04-24

### 컨텍스트

내부 포맷을 무엇으로 할 것인가? JSON(Notion 방식), SQLite(Apple Notes), Markdown(Obsidian) 선택 가능.

### 결정

**`.md` 파일을 원본 저장소로 사용**. 에디터 상태는 메모리에만.

### 결과

**긍정:**
- Obsidian/VSCode와 100% 호환
- 사용자가 vault를 통째로 다른 앱에서도 사용
- 파일 단위 Git 버전 관리 가능
- 앱이 사라져도 데이터는 안전

**부정:**
- 블록 에디터의 고유 속성(색상, 칼럼 등) 표현 제약
- 검색 인덱스는 별도 구축 필요
- 대용량 vault에서 오버헤드

### 대안

- SQLite: 빠르고 풍부한 쿼리 가능하나 종속성
- JSON 블록 배열: Notion 스타일, 호환성 없음

---

## ADR-004: 단일 vault 방식

**상태:** ⛔ Superseded by [ADR-031](#adr-031-멀티-vault-워크스페이스-cmux-스타일-좌측-세로-탭) (2026-04-26)
**날짜:** 2026-04-24

> **2026-04-26 갱신:** 본 결정은 ADR-031(멀티 vault 워크스페이스)로 superseded. "v1 단일 vault" 가정은 더 이상 유효하지 않음. 멀티 vault 모델·IPC·UX는 ADR-031 및 [multi-vault-spec.md](./specs/multi-vault-spec.md) 참조.

### 컨텍스트

여러 vault를 동시에 열 수 있게 할 것인가?

### 결정 (Historical)

**v1에서는 한 번에 하나의 vault만**. Obsidian의 vault 모델 그대로.

### 결과

**긍정:**
- 상태 관리 단순
- 사용자 혼동 적음
- 권한 요청 범위 명확

**부정 (이게 supersede 의 동기):**
- 여러 vault 빠른 전환 UX 부족 → ADR-031에서 cmux 스타일 좌측 세로 탭으로 해결
- 크로스 vault 검색 불가능 → ADR-031에서도 의도적으로 유지 (격리 가치)

### 대안 (지금은 채택안)

- 멀티 vault: ~~v2에서 탭처럼 전환 가능하게 (열린 상태)~~ → ADR-031에서 v1.5 스코프로 끌어옴 (cmux 스타일)

---

## ADR-005: Zustand 상태 관리

**상태:** Accepted
**날짜:** 2026-04-24

### 결정

**Zustand** 채택.

### 결과

**긍정:**
- 보일러플레이트 최소
- React Context보다 성능 좋음
- 훅 기반, React 친화
- 번들 크기 작음 (<1KB)

**부정:**
- DevTools 경험이 Redux보다 약함 (middleware로 해결 가능)

### 대안

- Redux Toolkit: 오버엔지니어링
- Jotai: atom 단위 선호하면 좋지만 단위가 더 커짐
- Valtio: proxy 기반, 디버깅 복잡

---

## ADR-006: shadcn/ui 컴포넌트

**상태:** Accepted
**날짜:** 2026-04-24

### 결정

**shadcn/ui + Radix UI** 채택.

### 결과

**긍정:**
- MIT, 소스 복사 방식이라 커스터마이징 자유
- Radix의 접근성 보장
- Tailwind와 찰떡
- 의존성 폭증 없음

**부정:**
- 업데이트가 수동 (버전 관리 주의)
- 컴포넌트 수 제한적

### 대안

- MUI: 무겁고 커스터마이징 어려움
- Mantine: 좋지만 독립 디자인 언어
- headlessui: 접근성 OK, 디자인 직접

---

## ADR-007: 프로젝트명 Munix

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

초기 후보: Mupe(무페), 무닉스, 무시디언 등.

### 결정

**Munix (무닉스)** — Mu(無, 불필요한 것을 덜어냄) + Onyx(단단하고 차분한 검은 보석)에서 출발한 이름.

### 결과

**긍정:**
- 짧고(3글자) 기억 쉬움
- 미니멀리즘(Mu) + 오닉스 모노크롬 스토리
- 도메인·앱스토어 충돌 거의 없음 (검증 필요)
- 로컬에 단단히 남는 Markdown 작업 공간이라는 제품 방향과 맞음

**부정:**
- "Unix"와 혼동 가능성 소량
- 영문 발음 "뮤닉스"/"무닉스" 분기

### 대안

- Mupe: 제품 방향과 연결되는 스토리가 약함
- 무시디언: 옵시디언 그대로라 차별성 부족
- Onyx: 선점된 브랜드 많음

### 브랜딩

- 로고 컨셉: 흑요석 커팅 실루엣 + 블랙
- 컬러: `#0A0A0A` 베이스 + `#0F766E` 액센트
- 부제: "Minimal Markdown. Local by design."

---

## ADR-008: YAML frontmatter를 전용 블록 노드

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

`.md` 상단의 YAML 블록을 에디터에서 어떻게 다룰지.

### 결정

**Tiptap 커스텀 노드 `Frontmatter`**를 만들어 편집 가능한 블록으로 표시.

### 결과

**긍정:**
- 사용자가 GUI로 frontmatter 편집 가능
- `tags`, `aliases` 등 빠른 접근
- Obsidian 호환 (같은 YAML 형식 유지)

**부정:**
- 커스텀 노드 구현 부담 (파싱/직렬화/렌더)
- 잘못된 YAML 입력 시 에러 처리 복잡
- 초기 개발 시간 +3일 정도

### 대안 (기각)

- **숨김 처리**: 단순하지만 편집 UX 부족
- **원시 텍스트 블록**: 다루긴 쉬우나 GUI 이점 없음

### 구현 방향

- yaml 라이브러리: `js-yaml` (MIT)
- 노드 종류: `blockGroup`, `atom: false`
- UI: 테이블 형태 (key | value) + `+ 필드 추가`
- 자동 갱신 필드: `updated` (저장 시), `created` (생성 시)

---

## ADR-009: 검색 엔진 fuse + MiniSearch 병행

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

v1.0에서 검색 기능 범위 결정.

### 결정

**fuse.js(파일명 Quick Open) + MiniSearch(전문 검색)** 둘 다 v1.0에 포함.

### 결과

**긍정:**
- 사용자가 처음부터 강력한 검색 경험
- 두 라이브러리 모두 MIT, JS 인메모리
- 개별 역할 명확 (quick vs full-text)

**부정:**
- 인덱스 빌드 시간 추가 (1000 파일 기준 ~1s)
- 메모리 사용량 ↑ (본문 포함)
- 두 인덱스 동기화 유지 필요

### 마이그레이션 경로

- v1.2에서 MiniSearch → Tantivy 교체 (ADR-017과 연계)
- Quick Open은 계속 fuse 사용

### 구현 포인트

- Web Worker에서 인덱스 빌드 (UI 블록 방지)
- 초기 로드 시 non-blocking
- 파일 수 < 100이면 즉시, 그 이상은 lazy

---

## ADR-010: 탭 기반 멀티 문서 v1.0 포함

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

여러 파일을 동시에 열어볼 수 있게 할 것인지.

### 결정

**탭 UI를 v1.0에 포함**. 에디터 상단에 탭 바.

### 결과

**긍정:**
- Obsidian/VSCode와 동등한 UX
- 파일 비교·참조 작성 편리
- 뒤로 가기/앞으로 가기 히스토리 가능

**부정:**
- 상태 관리 복잡도 증가 (단일 문서 → 배열)
- keymap 추가: `Cmd+T`, `Cmd+W`, `Cmd+1~9` 등
- 개발 기간 +1~2주

### 구현 영향

- `useDocuments` 스토어 신설
- 에디터 인스턴스 여러 개 관리 (메모리 주의)
- 자동 저장은 탭별 독립적으로 동작
- 충돌 감지는 탭별 baseline 보유

### 제약 (v1.0)

- 탭 수 최대 10개 (그 이상은 메모리 이슈)
- 드래그로 순서 변경: v1.1+
- 분할 뷰 (split): v2+

---

## ADR-011: 이미지 썸네일 캐시

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

큰 이미지가 많은 경우 로딩 성능 이슈.

### 결정

**Rust `image` crate로 썸네일 생성, `.munix/cache/thumbs/` 저장**.

### 결과

**긍정:**
- 스크롤 시 큰 이미지 디코딩 비용 절감
- 트리 미리보기(v1.1+) 가능
- 네트워크 드라이브에서 특히 유리

**부정:**
- 초기 구현 부담 (`image` crate 의존성 추가)
- 디스크 공간 사용 (원본 대비 5~10%)
- 원본 변경 감지 후 캐시 무효화 로직 필요

### 캐시 규칙

- 썸네일 크기: 256x256 fit (JPEG q80)
- 파일명: `{sha1(rel_path)}.jpg`
- TTL: 원본 mtime 기반 (mtime 변경 시 재생성)
- 총 용량 상한: 500MB (초과 시 LRU 제거)

---

## ADR-012: 매 저장마다 백업 파일 생성

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

앱 충돌, 디스크 오류, 사용자 실수 등으로 인한 데이터 손실 방지.

### 결정

**매 저장 시 `.munix/backup/last.md`에 원본 + 변경 전 내용 2-파일 구조로 백업**.

### 결과

**긍정:**
- 즉각적인 복구 가능
- 앱 강제 종료 후 재시작 시 복구 제안
- 사용자 신뢰도 ↑

**부정:**
- 저장 시 I/O 2배 (성능 영향 미미, 대개 <10MB)
- `.munix/backup/` 크기 관리 필요

### 구현 상세

- 쓰기 순서: (1) 백업 `previous.md`로 복사 → (2) 새 내용 쓰기
- 보관: 현재 파일별 최신 1건 + 전역 최근 10건 일별 스냅샷
- 경로: `.munix/backup/{hash(rel_path)}/previous.md`
- 일 스냅샷: `.munix/backup/daily/{yyyy-mm-dd}/`
- 용량 상한: 200MB (초과 시 오래된 일 스냅샷부터 삭제)

### 복구 UI

- 파일 우클릭 → "이전 버전 복원"
- 메뉴: 파일 → 버전 히스토리 → 타임라인

---

## ADR-013: 다크모드 기본값 system

**상태:** Accepted
**날짜:** 2026-04-25

### 결정

앱 첫 실행 시 **OS 다크모드 설정을 따름**.

### 결과

- 사용자 기대에 부합
- 설정에서 명시적 라이트/다크 선택 가능

---

## ADR-014: MIT 라이선스

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

오픈소스 공개 또는 상용화를 자유롭게 하고 싶음.

### 결정

**MIT License**.

### 결과

- 모든 의존성이 MIT/Apache 호환 (이미 원칙)
- 특허 보호 필요 시 Apache 2.0으로 변경 가능 (미래)
- LICENSE 파일 루트에 추가 필수

### 대안

- Apache 2.0: 특허 조항 명시, 엔터프라이즈 친화
- GPL: 파생 작품도 GPL 강제 → 제외

---

## ADR-015: 파일명 패턴 Untitled 방식

**상태:** Accepted
**날짜:** 2026-04-25

### 결정

새 노트 생성 시 기본 이름: **`Untitled.md`**, 충돌 시 `Untitled 2.md`, `Untitled 3.md` ...

### 결과

- 사용자가 자유롭게 제목 붙일 수 있음
- macOS Finder 관행과 일치

### 확장

- 설정에서 `fileNamingPattern`을 `iso-date`로 변경하면 `2026-04-25.md` 생성
- `custom`은 Mustache 템플릿 (`{{date:YYYY-MM-DD}}-memo.md`)

---

## ADR-016: macOS 폴더 권한 lazy 요청

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

macOS는 앱이 사용자 폴더 접근 시 권한 요청 필요 (`~/Documents`, `~/Desktop` 등).

### 결정

**Vault 첫 오픈 시 요청** (앱 첫 실행 시 X).

### 결과

**긍정:**
- 사용자가 맥락을 이해한 상태로 권한 부여
- 앱 첫 실행 장벽 낮음

**부정:**
- vault 오픈 전에 일부 기능(최근 파일 목록 등) 제약

---

## ADR-017: Rust가 FS + 검색 인덱스(Tantivy) 담당

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

검색 인덱스를 어디서 관리할지. JS(MiniSearch)만 쓰면 대용량에서 한계.

### 결정

**v1.0에서는 MiniSearch(JS) 기본 + Tantivy(Rust) 옵션**. 사용자가 1000 파일 초과 시 Tantivy 자동 전환 제안.

### 결과

**긍정:**
- 대용량 vault에서도 빠른 검색
- 한국어 형태소 분석(`lindera-tantivy`) 지원
- 디스크 기반 인덱스 → 앱 시작 속도 유지

**부정:**
- Rust 의존성 증가 (`tantivy`, `lindera-tantivy`)
- 바이너리 크기 +~8MB
- 초기 구현 시간 +1주

### 구현 순서

1. Phase 5에서 MiniSearch 먼저 완성
2. Phase 5 후반에 Tantivy 대체 옵션 추가
3. 설정에서 `advanced.searchEngine`으로 선택 (`minisearch` | `tantivy`)

### 인덱스 위치

- MiniSearch: 메모리 + localStorage 캐시
- Tantivy: `{vault}/.munix/index/`

---

## ADR-018: tailwind-variants (not CVA)

**상태:** Accepted
**날짜:** 2026-04-25

### 컨텍스트

shadcn/ui 기본 스택은 `class-variance-authority`(CVA)를 variant 시스템으로 사용. 하지만 Munix는 multi-slot 컴포넌트(탭 바, 명령 팔레트, 다이얼로그, 슬래시 메뉴)가 많아 slots 기능이 필요했고, `twMerge` 호출을 매번 걸어야 하는 번거로움도 있었다.

### 결정

`class-variance-authority` 대신 **`tailwind-variants` (tv)**를 사용한다.

### 이유

| 항목 | CVA | tailwind-variants |
|------|-----|-------------------|
| API 호환 | baseline | 상위 호환 |
| `twMerge` 내장 | ❌ | ✅ |
| slots (root/header/body 등) | ❌ | ✅ |
| compound variants | 제한적 | 강력 |
| responsive variants | ❌ | ✅ |
| TypeScript 추론 | 보통 | 뛰어남 |

### 마이그레이션

- shadcn/ui CLI가 생성하는 `cva(...)` 호출은 거의 동일한 API의 `tv(...)`로 1:1 치환 가능.
- 새로 작성하는 컴포넌트는 처음부터 `tv` 사용.
- `cn()` 유틸은 `clsx + tailwind-merge` 조합 유지 (임의 merge가 필요한 경우).

### 결과

- **장점:** 단일 라이브러리로 variant + slots + merge 모두 해결, 엔터프라이즈 컴포넌트에 잘 맞음
- **단점:** shadcn/ui 공식 예제와 일부 괴리 (하지만 최소)

---

## ADR-019: Wikilink 디자인

**상태:** ✅ 채택 (사후 기록)
**결정일:** 2026-04-25

### 컨텍스트

Obsidian과 호환되는 `[[target]]` / `[[target|alias]]` 표기를 에디터에서 어떻게 다룰지 결정 필요. Tiptap은 표준 Markdown만 인식하므로 Obsidian 확장 문법은 별도 처리가 필요하다. 선택지는 크게 세 갈래:

1. Markdown 입력 시 preprocess로 HTML로 변환한 뒤 Tiptap에 삽입
2. Tiptap inputRule을 정의해서 타이핑 중에 즉시 노드로 변환
3. Mark로 처리 (텍스트 위에 의미 부여) vs Inline atom Node (불가분 단위)

또한 자동완성, 클릭 동작, 저장 시 round-trip(원본 `[[…]]` 표기 보존)도 함께 결정해야 한다.

### 결정

**Inline atom 노드 + 로드 시 preprocess + suggestion 자동완성** 조합을 채택했다.

구체적으로:

- 노드는 `Node.create({ name: "wikilink", inline: true, group: "inline", atom: true, selectable: true })`로 정의 — 즉 인라인 atom 노드 (`munix/src/components/editor/wikilink/wikilink-node.ts:8-13`).
- 마크다운 본문이 에디터에 들어가는 경로는 `preprocessMarkdown` 단일 진입점 — 정규식 `/\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g`로 `[[target|alias]]`를 `<span data-wikilink-target="..." data-wikilink-alias="...">[[display]]</span>` HTML로 변환 후 Tiptap에 setContent (`munix/src/components/editor/editor-view.tsx:25-45`, `:93`, `:122`).
- 자동완성 trigger char는 `[[`, `allowSpaces: true`, `startOfLine: false`, `pluginKey: new PluginKey("wikilinkSuggestion")` (`munix/src/components/editor/wikilink/wikilink-suggestion.ts:14, 33-36`).
- 클릭 핸들러는 별도 ProseMirror 플러그인(`WikilinkClick`)이 `.munix-wikilink` DOM에 대한 클릭을 가로채 `useTabStore.getState().openTab(path)` 호출 — 새 탭에서 대상 파일 오픈 (`munix/src/components/editor/wikilink/wikilink-click.ts:29-48`).
- 저장 직렬화는 노드의 `addStorage().markdown.serialize`에서 `[[target]]` 또는 `[[target|alias]]` 원본 표기로 그대로 출력 (`munix/src/components/editor/wikilink/wikilink-node.ts:55-69`).

### 결과

**긍정:**
- atom 노드라 wikilink가 한 단위로 선택·삭제·드래그됨 — Backspace 한 번에 통째로 제거되고 부분 편집은 불가능 (의도된 UX).
- preprocess 단일 진입점이라 `currentPath` 변경/`setContent` 두 경로 모두 일관된 변환 적용 (`editor-view.tsx:93, 122`).
- suggestion plugin과 click plugin이 분리돼 있어 각각 독립적으로 끌 수 있음.
- round-trip 보존: 로드된 `[[A|B]]`가 저장 시에도 그대로 `[[A|B]]`로 직렬화 → Obsidian 호환 100%.

**부정:**
- Inline 정규식 preprocess라 코드 펜스(```` ``` ````) 안의 `[[...]]`도 변환됨 — 현재 미구현 (코드 블록 회피 로직 없음).
- atom 노드라 alias만 별도 편집은 불가 — 노드 통째로 지우고 다시 자동완성으로 입력.
- `findFileByTitle`이 `basename === target` 또는 `path === target`만 매칭 — 폴더 다른 동명 파일 충돌 시 첫 발견 우선이고 별칭/aliases frontmatter 매칭은 현재 미구현 (`wikilink-click.ts:7-20`).
- `[[` trigger는 같은 시점에 슬래시(`/`) suggestion과 두 개의 Suggestion plugin을 등록하므로 PluginKey 충돌이 한 번 발생했음 (issues-log.md "Tiptap suggestion plugin key 충돌" 참조). 두 PluginKey 분리로 해결.

### 대안 (검토 후 기각)

- **Markdown inputRule로 타이핑 중 즉시 변환**: 사용자가 alias 부분을 타이핑하는 중에 노드로 굳어버려서 alias 수정이 어색해짐. preprocess는 "최종 형태가 닫힌 `]]`까지 완성된 후"라는 명확한 시점을 잡을 수 있음.
- **Mark 기반 처리**: 텍스트가 그대로 노출돼 alias 같은 "표시 ↔ 실제 다름" 모델 표현이 어색. 사용자가 mark 안의 `|` 등을 우발적으로 깨뜨릴 수 있음.
- **`[` 단일 trigger**: 표준 마크다운 링크(`[text](url)`)와 충돌. `[[` 더블 trigger로 명시적 구분.
- **별도 Markdown extension으로 등록**: tiptap-markdown은 표준만 지원해서 결국 커스텀 paragraph parser를 만들어야 했음 — preprocess 정규식이 더 단순하다고 판단.

### 참고

- 노드 정의: `munix/src/components/editor/wikilink/wikilink-node.ts:8-70`
- Suggestion: `munix/src/components/editor/wikilink/wikilink-suggestion.ts:14-135`
- 클릭 핸들러: `munix/src/components/editor/wikilink/wikilink-click.ts:23-53`
- preprocessMarkdown: `munix/src/components/editor/editor-view.tsx:25-45`
- 등록: `munix/src/components/editor/extensions.ts:20-22, 69-71`
- 관련 이슈: issues-log.md "Tiptap suggestion plugin key 충돌", "DragHandle props 불안정으로 suggestion menu가 사라지는 현상"
- 관련 ADR: ADR-002 (Tiptap 채택), ADR-020 (Backlink 인덱싱이 같은 정규식 재사용)

---

## ADR-020: Backlink 인덱싱 전략

**상태:** ✅ 채택 (사후 기록)
**결정일:** 2026-04-25

### 컨텍스트

Wikilink(ADR-019)가 동작하는 이상, "현재 파일을 가리키는 다른 파일들"을 찾아서 보여주는 backlink 패널이 필요하다. 해결해야 할 결정 포인트:

- 인덱스 위치: 메모리 vs 디스크(`.munix/index/`) vs Rust(Tantivy)
- 빌드 시점: 앱 시작 / vault 오픈 / lazy 처음 요청 시
- 갱신 방식: 매 호출마다 vault 전체 재스캔 vs watcher 이벤트 기반 증분
- 자료구조: `Map<source, targets>` 한 방향 vs 양방향 (`forward + reverse`)
- 정합성: 외부 편집(VSCode) 대응

### 결정

**JS 메모리 보관 + 양방향 Map + watcher 이벤트 기반 증분 업데이트**.

구체적으로:

- 클래스 `BacklinkIndex`가 세 개의 Map을 보유 (`munix/src/lib/backlink-index.ts:27-33`):
  - `forward: Map<sourcePath, Set<targetBasename>>` — 어떤 파일이 누구를 참조하는가
  - `reverse: Map<targetBasename, Set<sourcePath>>` — 누가 이 파일을 참조하는가 (조회 핵심)
  - `bodies: Map<sourcePath, string>` — 스니펫 생성용 raw 본문
- 빌드는 vault 오픈 시 `OutlinePanel`에서 트리거 — 모든 `.md` 파일을 `ipc.readFile`로 읽고 `parseDocument`로 frontmatter 분리 후 정규식 `/\[\[([^\]|\n]+)(?:\|[^\]\n]+)?\]\]/g`로 target 추출 (`backlink-index.ts:5, 35-49`, `outline-panel.tsx:63-66`).
- 증분 갱신은 `useVaultWatcher`가 `vault:fs-changed` 이벤트를 받아 분기 (`munix/src/hooks/use-vault-watcher.ts:47-57`):
  - `deleted` → `useBacklinkStore.getState().removePath(path)`
  - `modified` / `created` (`.md`) → `useBacklinkStore.getState().updatePath(path)` (해당 파일만 다시 읽고 `applyPath`로 forward/reverse 동기 갱신)
- target 매칭은 **basename 기준** — 파일명 `Foo.md`라면 reverse map의 키는 `"Foo"` (`backlink-index.ts:7-11, 91`).
- Zustand store(`useBacklinkStore`)가 인덱스를 감싸고 갱신마다 `set({})`로 빈 트랜잭션을 보내 React 리렌더 트리거 (`munix/src/store/backlink-store.ts:42-49`).
- 상태 머신: `idle` → `building` → `ready` | `error` (`backlink-store.ts:5, 26-37`).

### 결과

**긍정:**
- 양방향 Map이라 `backlinksOf(path)` 조회는 O(1) (reverse 한 번 lookup) — 파일 수와 무관하게 즉시 응답.
- 증분 갱신은 변경된 파일 1건만 다시 읽으므로 watcher 이벤트당 비용 ≈ 1 file IO + 정규식 한 번.
- `applyPath`가 prev 링크들의 reverse 엔트리를 먼저 정리한 뒤 새 링크 등록 — stale 링크가 남지 않음 (`backlink-index.ts:51-67`).
- snippet은 `bodies`에 저장된 raw 본문에서 추출하니 vault 전체 재스캔 불필요 (`backlink-index.ts:126-139`).

**부정:**
- 전체 vault 빌드 비용: 파일 수 × (IPC readFile + parseDocument + 정규식 1회). 1000 파일이면 IPC round-trip만으로 수 초. Web Worker로 옮기지 않은 상태라 메인 스레드 블록 가능성.
- 메모리에 모든 파일의 `body`까지 들고 있음 (`bodies` Map) — 대용량 vault는 메모리 압박. 디스크 기반 인덱스로 옮길 여지 있음.
- 앱 재시작마다 빌드를 처음부터 다시 함 — 캐시 없음.
- basename 매칭이라 같은 이름 다른 폴더의 파일 충돌 시 모두 같은 reverse 키로 들어감 → 어떤 source든 둘 모두에 backlink로 표시됨. 경로 기준 정확 매칭은 현재 미구현.
- aliases frontmatter 기반 매칭, heading anchor (`[[file#section]]`), block ref (`[[file^block]]`)는 현재 미구현.
- watcher가 self-write를 suppress하므로(ADR-021), 우리가 저장한 파일의 backlink는 watcher 이벤트로 갱신되지 않음 — 다만 `useEditorStore`가 직접 `updatePath`를 호출하면 되는데 현재는 외부 변경 시에만 갱신 경로가 동작.

### 대안 (검토 후 기각)

- **단방향 Map (`forward`만)**: `backlinksOf`마다 모든 source를 순회해야 하므로 O(N). 양방향이 메모리 두 배지만 조회 성능 우선.
- **매 호출마다 전체 재스캔**: backlink 패널이 빈번하게 열리므로 매번 IO는 비현실적.
- **Rust(Tantivy)로 처음부터**: ADR-017과 동일한 trade-off — JS 단순함 우선, Tantivy는 v1.2 검색 통합 시 backlink도 같이 옮길 여지.
- **IndexedDB / localStorage 캐시**: 정합성 관리(외부 편집 시 캐시 무효화)가 복잡. 현재 메모리 only가 단순.

### 참고

- 인덱스 클래스: `munix/src/lib/backlink-index.ts:27-113`
- Wikilink 정규식: `munix/src/lib/backlink-index.ts:5` (`WIKILINK_RE`)
- Zustand store: `munix/src/store/backlink-store.ts:20-53`
- Watcher 통합: `munix/src/hooks/use-vault-watcher.ts:47-57`
- 패널 UI: `munix/src/components/outline-panel.tsx:58-67`
- 관련 ADR: ADR-019 (Wikilink가 인덱스의 입력), ADR-021 (self-write suppression이 갱신 경로에 영향), ADR-017 (Tantivy 마이그레이션 후보)

---

## ADR-021: FS Watcher self-write suppression

**상태:** ✅ 채택 (사후 기록)
**결정일:** 2026-04-25

### 컨텍스트

ADR-003에 따라 `.md` 파일을 디스크에 직접 쓰고, Phase 3에서 외부 편집 감지를 위해 `notify` crate 기반 watcher를 도입했다(`munix/src-tauri/src/watcher.rs`). 그런데 우리 앱이 자동저장으로 파일을 쓰면 OS는 똑같이 `Modify` 이벤트를 발행 — watcher가 그 이벤트를 수신해서 `vault:fs-changed`를 emit하면, 프론트의 `use-vault-watcher.ts`가 "외부에서 변경됨" 분기로 들어가 에디터를 reload함 (`use-vault-watcher.ts:60-67`). 결과: 사용자가 입력 → 자동저장 → reload → 커서 위치 리셋 + 입력 유실 위험.

이걸 막으려면 "방금 우리가 쓴 파일"의 watcher 이벤트는 무시해야 한다. 결정해야 할 것:

- 어떻게 self-write를 식별하는가 (path 기록 / mtime 비교 / content hash)
- 시간 윈도우는 얼마나
- watcher 디바운스(150ms)와의 상호작용
- edge case: suppress window 안에서 외부 수정이 발생하면

### 결정

**write 직후 절대경로를 `Instant`와 함께 `HashMap`에 기록하고, watcher가 해당 경로의 이벤트를 1500ms 동안 무시**한다.

구체적으로:

- 공유 자료구조: `pub type RecentWrites = Arc<Mutex<HashMap<PathBuf, Instant>>>` — `AppState`가 보유 (`munix/src-tauri/src/state.rs:10, 18`, `munix/src-tauri/src/watcher.rs:15`).
- 모든 쓰기 명령(`write_file`, `create_file`, `create_folder`, `rename_entry`, `save_asset`, `delete_entry`)이 명령 처리 끝에 `record_write(&state.recent_writes, &[&abs])`를 호출 (`munix/src-tauri/src/commands/fs.rs:56, 72, 86, 102, 117, 142`).
- `record_write`는 path → 현재 `Instant`를 삽입하고, 동시에 5초 초과 엔트리를 GC (`munix/src-tauri/src/watcher.rs:67-78`).
- watcher의 `map_event`가 이벤트를 emit 하기 직전에 `recent_writes`를 lock하고 해당 path가 1500ms 안에 기록됐는지 확인 — 그러면 `None` 반환해서 emit 스킵 (`munix/src-tauri/src/watcher.rs:18, 119-129`).
- watcher 자체 디바운스(`DEBOUNCE_MS = 150`)와 별개로 동작 — 디바운스가 150ms이고 suppress가 1500ms이므로 디바운스된 단일 이벤트는 확실히 suppress window 안에 들어옴.

상수:

```rust
const DEBOUNCE_MS: u64 = 150;
const SELF_WRITE_SUPPRESS_MS: u128 = 1500;
```

(`munix/src-tauri/src/watcher.rs:17-18`)

### 결과

**긍정:**
- path 기반 + 시간 윈도우 조합이 단순. mtime 비교나 content hash보다 구현 부담이 적고 의존성 추가 없음.
- 1500ms는 자동저장 750ms debounce(CLAUDE.md "자동 저장 — 750ms debounce") + 디스크 쓰기 + watcher 디바운스 150ms를 모두 포함하기에 충분.
- rename은 두 path(old + new) 모두 기록 — rename으로 발생하는 두 이벤트(remove + create) 모두 suppress (`fs.rs:102`).
- GC 기준 5초로 윈도우 본 값보다 길게 잡아서 race로 누락된 이벤트도 안전하게 청소.

**부정:**
- **Edge case 1**: 우리가 저장한 직후 1500ms 안에 외부 편집기가 *같은 파일*을 수정하면 그 이벤트도 같이 suppress됨 → 외부 변경을 놓침. 1500ms 안에 정확히 같은 파일을 다른 도구로 수정하는 건 흔치 않다고 판단.
- **Edge case 2**: 디스크 느린 NFS/네트워크 드라이브에서 watcher 이벤트가 1500ms를 넘어 도달하면 suppress가 풀림 → 우리 쓰기가 외부 편집으로 오인. CLAUDE.md "네트워크 드라이브에서 특히 유리"는 썸네일 한정이고, watcher는 보장 안 함.
- **Edge case 3**: suppress 이후의 후속 이벤트(예: 같은 저장이 두 번의 `Modify` 이벤트로 쪼개졌을 때)는 watcher 디바운서가 이미 합쳐주지만, 합쳐지지 않으면 두 번째 이벤트는 "한 번의 echo만 억제"라는 코드 주석(`watcher.rs:124`)에도 불구하고 실제로는 같은 path의 같은 timestamp면 두 번 다 통과됨. 현재 코드는 GC만 하고 hit 시 entry를 제거하지는 않는다 — 즉 윈도우 안의 *모든* 이벤트가 무시됨. 의도와 코멘트가 약간 어긋나 있음.
- mtime이나 content hash와 달리 "내용 검증"은 없음 — path만 보고 무시하므로 외부 편집기가 우리 쓰기와 거의 동시에 다른 내용으로 덮어쓰는 race는 잡을 수 없음.

**프론트 측 추가 방어선:**

- `use-vault-watcher.ts`는 `modified` 이벤트가 와도 에디터 상태가 `idle`/`saved`일 때만 reload. `dirty`/`saving`/`conflict`면 방치 — 사용자 미저장 변경이 덮이지 않게 (`use-vault-watcher.ts:62-66`).
- 즉 self-write suppression을 빠져나간 echo가 와도 상태 머신이 한 번 더 막아줌 (defense-in-depth).
- 또한 ADR-003 + 충돌 감지 흐름(`expected_modified` mtime 비교)이 save-time 검증 레벨에서 실제 충돌은 잡음.

### 대안 (검토 후 기각)

- **mtime 비교**: write 후 mtime을 기록 → watcher 이벤트의 파일 mtime과 비교. 같은 mtime이면 self. 단점: FAT32 등 일부 파일시스템은 mtime 해상도가 1~2초라 분간 어려움. macOS/Linux는 ns 단위지만 fsync 직후 mtime 읽기에 race.
- **Content hash 비교**: 우리가 쓴 내용의 SHA-256을 저장 → watcher 이벤트 시 파일을 다시 읽어 비교. 정확하지만 IO 비용 추가 + 큰 파일에서 무거움.
- **Watcher 일시정지/재시작**: 쓰기 직전에 stop → 쓴 후 restart. notify의 `Debouncer` API는 이 패턴을 우아하게 지원하지 않고, 그 사이의 외부 변경을 놓치는 더 큰 위험.
- **이벤트 무시 윈도우 더 길게(예: 5초)**: 외부 편집을 놓칠 위험이 더 큼. 1500ms는 자동저장 1사이클 + 안전 마진.

### 참고

- 자료구조: `munix/src-tauri/src/watcher.rs:15` (`RecentWrites` typedef)
- 상수: `munix/src-tauri/src/watcher.rs:17-18`
- 기록 함수: `munix/src-tauri/src/watcher.rs:67-78` (`record_write`)
- suppress 분기: `munix/src-tauri/src/watcher.rs:119-129` (`map_event` 안쪽)
- 호출 지점들: `munix/src-tauri/src/commands/fs.rs:56, 72, 86, 102, 117, 142`
- AppState 통합: `munix/src-tauri/src/state.rs:7-21`
- 프론트 방어선: `munix/src/hooks/use-vault-watcher.ts:60-67`
- 관련 ADR: ADR-003 (.md 네이티브 저장), ADR-012 (백업), ADR-017 (Rust FS 책임)
- 관련 이슈: issues-log.md "외부 편집 감지가 Obsidian/VSCode보다 느리게 느껴짐", "Rust expected_modified 충돌 감지가 안 도는 것처럼 보이는 현상"

---

## ADR-022: 플러그인 시스템 (Extism WASM)

**상태:** 🟡 Proposed (다음 세션에 정식 결정)
**결정일:** 2026-04-25 (논의 시작)

### 컨텍스트

v1.1+에서 무거운 기능들(터미널, 그래프 뷰, 외부 도구 통합 등)을 코어에 욱여넣지 말고 플러그인으로 빼야 한다는 방향성이 사용자 요청과 함께 제기됨. 옵시디언이 살아남은 결정적 이유. 다만 Munix는 CLAUDE.md에 명시된 대로 **"클라우드 동기화가 보안상 불가한 환경"** 타겟이라, 옵시디언처럼 임의 JS 실행을 허용하면 보안 정책에 정면으로 위배.

플러그인 시스템 후보 4가지 비교:

| 방식 | 보안 | 성능 | 개발 편의 | Munix 적합도 |
|---|---|---|---|---|
| Obsidian 스타일 (JS + manifest) | 🔴 낮음 (full DOM access) | 🟢 | 🟢 | ❌ 보안 타겟 충돌 |
| VS Code 스타일 (extension host IPC) | 🟡 중 | 🟡 | 🟢 | 🟡 복잡 |
| Tauri sidecar (네이티브 바이너리) | 🔴 낮음 (임의 exec) | 🟢 | 🟡 | ❌ |
| **WASM 플러그인 ([Extism](https://extism.org))** | 🟢 강력 샌드박싱 | 🟢 | 🟡 | ✅ **최적** |

### 결정 (잠정)

**Extism 기반 WASM 플러그인 시스템 채택 (proposed)**.

- 플러그인 패키지: `.munix/plugins/{name}/{manifest.json, plugin.wasm, ui/}`
- manifest에 capability 명시 (`pty`, `fs:vault`, `fs:asset`, `net`, `clipboard`, `shell:exec`, `notification`)
- 사용자가 첫 활성화 시 권한 명시적 승인 (capability별 설명 표시)
- UI 통합은 Sandbox iframe (`munix://plugin/{name}/ui/index.html`) + postMessage
- 플러그인 ↔ 코어 통신: Extism host function (typed). 모든 host call은 capability 검사를 거침
- 플러그인 무결성: WASM 모듈 SHA-256 해시 manifest에 명시 → 검증 후 로드

자세한 설계는 [specs/plugin-spec.md](./specs/plugin-spec.md) 참조.

### 결과

**긍정:**
- WASM 자체로 메모리/시스템 콜 격리 — 임의 fs/net 호출 불가능
- Capability 모델로 권한이 manifest에 명시 — 감사 가능, 보안 타겟 사용자에게 설득력
- Rust/Go/JS/Python 어떤 언어든 WASM으로 컴파일하면 플러그인 — 생태계 자유
- Tauri는 이미 Rust 기반이라 Extism Rust SDK 통합 자연스러움
- 플러그인 panic이 코어에 영향 없음 (격리)

**부정:**
- 플러그인 개발 진입장벽 옵시디언 JS보다 높음 (WASM 컴파일 필요)
- WASM 모듈 로드 + 초기 실행 지연 (수십 ms)
- UI 통합 패턴이 옵시디언만큼 자유롭지 못함 (iframe 격리 제약)
- 플러그인 ABI 안정성 관리 부담 (`munixApiVersion` 도입 필요)
- Extism 자체가 비교적 새 프로젝트 — 장기 안정성 베팅 요소

### 대안 (검토 후 보류)

- **Obsidian 스타일 JS 플러그인**: 보안 타겟 충돌. 옵시디언 사용자가 Munix로 넘어오는 가치 명제가 보안인데, 같은 보안 모델을 답습하면 의미 없음.
- **VS Code extension host (Node 별도 프로세스)**: Node 런타임 번들 부담 + 별도 프로세스 관리. 옵시디언보다 안전하지만 Extism보다 무거움.
- **Tauri sidecar 네이티브 바이너리**: 임의 네이티브 실행 — Munix 가치 명제 위반.
- **플러그인 시스템 없이 가기**: 터미널/그래프뷰 같은 기능마다 코어 비대화. v1.1+ 로드맵 폭발.

### 참고

- Extism: https://extism.org
- 의존: 이 ADR이 [ADR-023](#adr-023-터미널-플러그인-1호)(터미널), 일부 [ADR-024](#adr-024-cli--uri-scheme-munix)(CLI 후크) 통합 지점의 전제
- 스펙: [specs/plugin-spec.md](./specs/plugin-spec.md)
- 관련: CLAUDE.md "보안" 섹션 (FS 접근/CSP/sandbox 원칙과 정합)

---

## ADR-023: 터미널 (플러그인 1호)

**상태:** 🟡 Proposed (다음 세션에 정식 결정)
**결정일:** 2026-04-25

### 컨텍스트

사용자 요청: 옵시디언 Terminal 플러그인 같은 기능 — vault 안에서 git/build/grep 등 셸 명령. 노트 ↔ 코드 워크플로우 결합.

cmux 사례 분석 ([github.com/manaflow-ai/cmux](https://github.com/manaflow-ai/cmux)):
- macOS **네이티브 GUI 앱** (Tauri WebView 아님)
- libghostty의 OpenGL/Metal 컨텍스트를 직접 임베드
- → Munix(Tauri WebView 기반)는 같은 방식 불가능. WebView 안에 GPU 컨텍스트를 그대로 가져올 수 없음

PTY/렌더링 옵션 3가지:

| 옵션 | 품질 | 안정성 | 비고 |
|---|---|---|---|
| xterm.js + portable-pty (Rust) | 표준 | 🟢 높음 | VS Code 방식. 검증됨 |
| coder/ghostty-web + portable-pty | 🟢 최상 | 🟡 in flux | xterm.js API 호환 layer 위 Ghostty 파서. libghostty API "stable functionality, signatures still in flux" |
| 별도 윈도우로 Ghostty spawn | 최상 | 🟢 | 진짜 임베드 아님, vault 컨텍스트 공유 어려움 |

### 결정 (잠정)

1. **터미널은 v1.0 코어 기능 아님** — [ADR-022](#adr-022-플러그인-시스템-extism-wasm) 위 1호 reference 플러그인으로 구현
2. **렌더러는 xterm.js**: ghostty-web은 v1.2+ 검토 후보로 보류 (libghostty API 안정화 후)
3. **PTY는 Rust [portable-pty](https://github.com/wez/wezterm/tree/main/pty) crate**, host function으로 노출
4. **권한 capability**: `pty` (필수), `fs:vault` (cwd 제한), `net` 거부 기본
5. **Windows ConPTY** 별도 처리 (Win10 1809+ 필수, 그 이전은 미지원 명시)

자세한 설계는 [specs/terminal-spec.md](./specs/terminal-spec.md) 참조.

### 결과

**긍정:**
- 코어 단순성 유지 — 터미널 안 쓰는 사용자는 영향 없음 (보안 환경 사용자가 미설치로 셸 실행 차단 가능)
- xterm.js 생태계 (addon, 테마) 활용
- 플러그인 시스템의 reference 구현 — capability 모델 검증
- ghostty-web 안정화 후 마이그 옵션 열려있음 (v1.2)

**부정:**
- ADR-022 의존 — 플러그인 시스템 작업이 선행
- 터미널 UI를 iframe sandbox에 넣을 때 키보드/리사이즈 통합 복잡 (xterm fit addon + postMessage 라우팅)
- starship/p10k 같은 prompt 호환성을 위해 너드 폰트 글리프 필수 (폰트 번들에 JBMono Nerd Font Mono 포함 — Phase 6 폰트 번들 작업과 연결)
- ghostty-web으로 마이그하지 못하면 v1.2 이후 품질 격차 발생 가능

### 대안 (검토 후 기각/보류)

- **코어 기능으로 통합**: 스코프 폭발 + 보안 사용자에게 강제됨. 플러그인 모델의 가치 부정.
- **ghostty-web을 v1.1에 바로**: libghostty API 불안정 + Munix 안정성 우선. v1.2 재평가.
- **Ghostty 별도 윈도우 spawn**: vault 컨텍스트(현재 디렉터리, 환경 변수) 공유 어려움.

### 참고

- **참고 구현 (핵심 참조)**: [lavs9/obsidian-ghostty-terminal](https://github.com/lavs9/obsidian-ghostty-terminal) — 옵시디언 + Ghostty 통합 플러그인. vault 컨텍스트 + 터미널 모델이 우리와 가장 유사. 사이드 패널 UI, cwd 동기, 셸 lifecycle 처리 패턴 참조 권장
- cmux: https://github.com/manaflow-ai/cmux
- libghostty 로드맵: https://mitchellh.com/writing/libghostty-is-coming
- coder/ghostty-web: https://github.com/coder/ghostty-web
- xterm.js: https://xtermjs.org
- portable-pty: https://github.com/wez/wezterm/tree/main/pty
- 의존: [ADR-022](#adr-022-플러그인-시스템-extism-wasm) 선행 필요
- 스펙: [specs/terminal-spec.md](./specs/terminal-spec.md)
- 폰트 번들 연결: implementation-plan.md Phase 6 "폰트 번들" — JBMono Nerd Font Mono 포함

---

## ADR-024: CLI + URI scheme (`munix://`)

**상태:** 🟡 Proposed (다음 세션에 정식 결정)
**결정일:** 2026-04-25

### 컨텍스트

사용자 요청: "옵시디언처럼 CLI 지원". 옵시디언은 공식 CLI 없음 — 두 가지가 사실상 표준:

1. **URI scheme** (공식): `obsidian://open?vault=foo&file=bar.md`. OS 레벨 URL handler.
2. **커뮤니티 CLI 래퍼** (npm `obsidian-cli` 등): 결국 URI scheme이나 파일 직접 조작.

Munix CLI/URI가 필요한 이유:
- 셸에서 빠르게 노트 열기/생성 (`munix open ~/notes/today.md`)
- 외부 도구가 노트 작성 트리거 (스크립트, 단축키 매크로, OS 자동화)
- 데일리 노트 자동화
- 옵시디언 사용자 멘탈 모델과 연속성

### 결정 (잠정)

**계층화 접근** — 단계별 출시:

**계층 1 (v1.0 후반):**
- `munix://` URI scheme 등록 — `tauri-plugin-deep-link`
- `munix path/to/note.md` args 파싱 + single-instance forwarding (`tauri-plugin-single-instance`)
- URI 형식: `munix://open?vault=...&file=...&line=...`
- macOS Info.plist / Windows registry / Linux .desktop 통합

**계층 2 (v1.1):**
- 풍부한 CLI: `munix new <title>`, `munix daily`, `munix search <query>`
- `--vault`, `--new-window` 옵션
- 같은 바이너리에서 args 분기 (별도 cli 바이너리 X)

**계층 3 (v1.2+):**
- Unix socket API (`/tmp/munix.sock`) — JSON-RPC. cmux 스타일. 외부 도구/플러그인 통합용
- x-callback-url 패턴 (Apple 표준) 검토

**보안:**
- URI는 외부 호출 가능 → 위험한 액션(파일 삭제 등)은 사용자 확인 prompt 필수
- vault 외부 경로 차단 (path traversal, ADR-016 vault sandbox와 정합)

자세한 설계는 [specs/cli-spec.md](./specs/cli-spec.md) 참조.

### 결과

**긍정:**
- 플러그인 시스템 의존 없음 — v1.0/v1.1에서 독립 진행 가능
- Tauri 공식 플러그인이 OS 통합 처리 — 우리는 라우팅만
- 옵시디언 사용자 멘탈 모델과 일치 (전환 비용 낮음)
- 자동화 워크플로우(데일리 노트, 빠른 캡처) 지원

**부정:**
- URI scheme 등록은 OS-level — 사용자 거부/IT 정책 차단 가능 (특히 macOS Gatekeeper, Windows SmartScreen 첫 호출)
- 보안 환경에서 IT 정책이 URI 핸들러 등록 자체를 차단할 수 있음 → 우아한 폴백 필요
- single-instance 라우팅이 다중 vault 시나리오(v2.0)에서 모호 — 가장 최근 vault 휴리스틱 또는 prompt
- URI는 누구나 만들 수 있음 → 위험 액션은 prompt 필수

### 대안 (검토 후 기각/보류)

- **Unix socket만 (CLI 없이)**: 외부 의존성 적지만 일반 사용자가 socket 직접 호출 불가.
- **URI scheme 없이 args만**: 이미 실행 중인 인스턴스에 routing 어려움. single-instance 패턴이 필수.
- **별도 `munix-cli` 바이너리**: 메인 앱과 통신/상태 동기 부담. 같은 바이너리 args 분기가 단순.
- **계층 한 번에 다 출시**: 스코프 부담. 계층 1 (URI + open)만으로도 충분히 가치 있음.

### 참고

- Tauri deep-link plugin: https://v2.tauri.app/plugin/deep-linking/
- Tauri single-instance plugin: https://v2.tauri.app/plugin/single-instance/
- Obsidian URI: https://help.obsidian.md/Concepts/Obsidian+URI
- 스펙: [specs/cli-spec.md](./specs/cli-spec.md)
- 관련 ADR: ADR-016 (vault sandbox와 path traversal 방어선 정합)

---

## ADR-025: 다국어 지원 (i18next + react-i18next)

**상태:** ✅ Accepted (Phase A 구현 완료, 2026-04-25)
**결정일:** 2026-04-25

### 컨텍스트

Munix는 한국어 사용자 환경을 베이스로 시작했고, UI 문자열이 한글로 하드코딩되어 있다. 다음 시점에 i18n 필요성 등장:

1. MIT 오픈소스로 GitHub 배포 시 영어권 사용자 진입장벽 제거
2. 사용자 명시 요청 ("사용자 설정 메뉴 UI ... 언어 설정(다국어 지원)")
3. settings-dialog UX 강화 흐름 — 단축키 UI(P1-9, 별개 작업)와 함께 진행

라이브러리 후보 비교 (Munix 라이선스 정책: MIT/Apache/BSD/ISC만):

| 라이브러리 | 라이선스 | 번들 (gz) | 풍부도 | React 통합 |
|---|---|---|---|---|
| **i18next + react-i18next** | MIT | ~15KB + ~5KB | 🟢 plurals/context/fallback | 🟢 |
| `lingui` | MIT | ~5KB | 🟡 (컴파일 타임 추출, 빌드 도구 의존) | 🟢 |
| `react-intl` (Format.js) | BSD-3 | ~30KB | 🟢 (ICU 표준, 학습 부담) | 🟢 |
| 자체 구현 | — | <1KB | 🔴 plurals 직접 | 🟡 |

### 결정 (잠정)

**i18next 24.x + react-i18next 15.x 채택**.

- 라이선스: MIT (정책 정합)
- 번역 파일: `munix/public/locales/{lang}/{namespace}.json`
- namespace 분리: `common`, `settings`, `editor`, `vault`, `search`, `palette`, `tabs` 등
- 동적 로드: `i18next-http-backend` (namespace 단위 lazy)
- 시스템 감지: `i18next-browser-languagedetector`
- React: `useTranslation('namespace')` 훅
- 사용자 설정: `settings.language: 'auto' | 'ko' | 'en'` (확장 가능)
- 점진적 마이그레이션: 인프라 + settings-dialog 첫 적용 → 나머지 별도 PR들

자세한 설계는 [specs/i18n-spec.md](./specs/i18n-spec.md) 참조.

### 결과

**긍정:**
- 표준 라이브러리 — 가장 큰 React i18n 생태계, 풍부한 문서
- pluralization, interpolation, context, fallback 모두 지원
- 동적 로드로 번들 크기 영향 최소 (사용 안 하는 namespace는 안 받음)
- 한국어 plurals 단순 (단/복수 구분 없음) → 문제 없음
- DX 좋음 (`t('settings.title')` 자연스러움)

**부정:**
- 라이브러리 크기 (~20KB minified+gz, namespace 별 JSON 추가)
- Suspense + lazy load 패턴 학습 필요 (또는 동기 init 폴백)
- 모든 UI 문자열 추출 작업이 큼 — **점진적 마이그레이션 필수** (Phase A/B/C로 분할)
- 새 컴포넌트마다 `t()` 강제 — 컨벤션 docs로 해소

### 대안 (검토 후 기각)

- **lingui**: 컴파일 타임 추출로 번들 가벼움. 다만 babel/swc 플러그인 필요 — Vite + Tauri 빌드 체인 통합 부담. i18next가 더 단순한 시작.
- **react-intl (Format.js)**: ICU MessageFormat 강력. 번들 더 크고 학습 부담. 우리 케이스(한/영 두 언어, 단순 plurals)에 오버스펙.
- **자체 구현**: plurals/날짜/숫자 포맷 직접 (Intl API 활용). i18next가 그 위 추상화 + 생태계 제공. ROI 낮음.
- **번역 안 함**: 영어권 진입장벽 + 오픈소스 가치 제한.

### 참고

- i18next: https://www.i18next.com
- react-i18next: https://react.i18next.com
- ICU MessageFormat: https://unicode-org.github.io/icu/userguide/format_parse/messages/
- 스펙: [specs/i18n-spec.md](./specs/i18n-spec.md)
- 관련 ADR: ADR-013 (다크모드 system 기본값과 동일 패턴 — 시스템 환경 감지 + 사용자 override)
- 관련 spec: [settings-spec.md](./specs/settings-spec.md) (`settings.language` 필드 추가)

---

## ADR-026: 파일 트리 가상 스크롤 (react-virtuoso)

**상태:** proposed → **accepted** (2026-04-25)
**작성일:** 2026-04-25

### 배경

200+ 파일 vault에서 파일 트리 전체를 DOM에 렌더하면 레이아웃 비용이 선형 증가. CLAUDE.md 성능 정책: "대량 파일 트리: 200개 초과 시 가상 스크롤".

### 결정

**react-virtuoso** 채택. 재귀 `FileTreeInner` → flat 배열 기반 `<Virtuoso>` + `FlatTreeRow` 단일 아이템 컴포넌트로 재작성.

- 라이선스: MIT
- 버전: 4.18.6
- `flatten()` 함수 + `FlatNode` 타입 이미 존재 → 전환 경로 명확
- `overscan={20}` 설정으로 DnD dragover 중 인접 아이템 DOM 유지
- `expandTimerRef` (기존 재귀 레벨별) → `FileList` 컨테이너로 끌어올림

### 대안 검토

| 방식 | 이유 기각 |
|---|---|
| `react-window` | 고정 높이 강제, 가변 높이 지원 불가 |
| `@tanstack/virtual` | API 복잡, DnD 결합 사례 희박 |
| 직접 구현 | ResizeObserver + 스크롤 오프셋 계산 ROI 낮음 |

### 위험 포인트 (해결책)

- dragover 중 아이템 언마운트 → `overscan` 조정으로 완화
- rename 중 blur → rename active 항목 index 기반 `scrollIntoView`
- Tauri WebView 호환 → react-virtuoso가 ResizeObserver 사용, 검증 필요

---

## ADR-027: Frontmatter 파싱은 gray-matter 안 쓰고 js-yaml 직접 사용

**상태:** ✅ 채택
**결정일:** 2026-04-25

### 배경

`src/lib/markdown.ts`의 `parseDocument` / `serializeDocument`는 초기 구현에서 `gray-matter@4.0.3` 을 사용해 frontmatter YAML 블록(`---\n…\n---\n`)을 처리했다. Phase 5/6 기간 frontmatter 패널 작업 중 다음 증상들이 동시에 발견:

1. Frontmatter 새 필드 추가 → 저장 상태가 "저장 대기중"에 영구 고착, 디스크에 안 써짐.
2. 탭 전환 후 같은 파일 재오픈 → 에디터 본문에 `---\n tags: …\n---` 가 텍스트로 노출, frontmatter 패널은 비어있음.

콘솔 스택 추적으로 근본 원인 확인: `gray-matter` 가 `lib/utils.js:36` 에서 `Buffer.from(input)` 을 호출하는데 Tauri WebView 에는 Node `Buffer` 전역이 없어서 `ReferenceError: Can't find variable: Buffer` 로 throw. parse(`matter()`)·stringify(`matter.stringify()`) 양쪽 모두 영향.

원래 throw가 `parseDocument` 의 `try/catch` 폴백(`{ frontmatter: null, body: raw }`)으로 흡수되고, `doSave` 의 `serializeDocument` 호출은 `try` 블록 밖이라 unhandled rejection으로 사라져 status가 dirty에 고착됐었다. 두 증상이 같은 원인의 다른 표현이었음.

### 결정

**`gray-matter` 의존성 제거. parse·serialize 둘 다 `js-yaml` 직접 호출 + 자체 라인 스캔으로 구현.**

- `package.json`: `gray-matter` 제거, `js-yaml@4.1.1` + `@types/js-yaml@4.0.9` 직접 의존성으로 추가.
- `parseDocument`: 첫 줄이 정확히 `---` 인지 확인 → 다음 `---` 라인까지 스캔 → 사이를 `yaml.load()` 로 파싱 → 빈/비-객체/배열은 `null` 처리.
- `serializeDocument`: `yaml.dump(fm, { lineWidth: -1, noRefs: true })` 결과를 `---\n${yaml}---\n${body}` 로 wrap.
- 첫 줄이 `---` 이지만 `---foo` 같이 horizontal rule 인 경우는 정확 일치 검사로 frontmatter 처리 회피.

### 대안 검토

| 방식 | 기각 사유 |
|---|---|
| `gray-matter` 유지 + `Buffer` polyfill (`vite-plugin-node-polyfills`, `buffer` 패키지) | 번들 크기 +~50KB, Tauri 환경에 불필요한 Node shim 도입. 진단도 어려워짐 (다음 사람이 "왜 Buffer가 있지?" 라고 헷갈림) |
| `gray-matter` 의 다른 진입점 사용 | v4 는 string/Buffer 입력을 동일 경로로 처리, 우회 진입점 없음 |
| `front-matter` / `yaml-front-matter` 같은 다른 라이브러리 | `js-yaml` 내부 사용은 같음. 얇은 래퍼 한 겹 더 추가하는 의미 없음 |
| 정규식 한 방 (`/^---\r?\n([\s\S]+?)\r?\n---\r?\n?([\s\S]*)$/`) | 빈 frontmatter, 라인 끝에 `---`만 있는 케이스 등에서 미묘하게 깨짐. 라인 스캔이 더 명료 |

### 영향

- 번들에서 `gray-matter` + 그 transitive deps (`section-matter`, `kind-of`, `extend-shallow`, `is-extendable` 등) 제거.
- API 호환: `ParsedDocument` 타입과 `parseDocument` / `serializeDocument` 시그니처는 그대로. 호출부 수정 불필요.
- 동작 차이 가능성:
  - YAML timestamp (`date: 2024-01-01`): gray-matter 와 js-yaml 모두 default schema 에서 Date 객체로 파싱 — 동일.
  - 키 순서: `yaml.dump` 는 객체 prop 순서대로 출력. gray-matter 도 같음 (둘 다 js-yaml 사용). 차이 없음.
  - Trailing newline: `yaml.dump` 출력 마지막에 `\n` 한 번만. 우리 wrap 도 `---\n` 닫는 마커 후 본문 직결 → 기존 gray-matter 출력 형식과 일치.

### 일반화된 교훈

Tauri 프로젝트는 **브라우저 환경**임을 항상 의식해야 한다. 새 Node 라이브러리 도입 전 체크리스트:

1. `package.json` 의 `browser` 필드 / 명시적 호환성 표기
2. 소스에서 `Buffer`, `process`, `fs`, `path`, `__dirname` 등의 Node 전역/모듈 사용
3. README 에 "browser support" 섹션
4. `npm` 키워드/범주에 `browser` / `isomorphic` / `universal`

위 4개 모두 부재하면 Node-only 가능성이 높음. 차라리 30줄 직접 짜는 것이 의존성·번들·디버깅 비용을 절감.

`js-yaml` 처럼 명시적으로 isomorphic 한 라이브러리만 사용. 미래에 누군가 "왜 gray-matter 안 쓰지?" 라며 다시 도입하지 않도록 이 ADR을 근거로 거절.

---

## ADR-028: Frontmatter 속성 타입은 Obsidian `.obsidian/types.json` 호환

**상태:** ✅ accepted (2026-04-26 — 9단계 전체 구현 완료)
**제안일:** 2026-04-25
**채택일:** 2026-04-26

### 배경

현재 `FrontmatterPanel`은 모든 필드를 텍스트 input 단일 위젯으로 보여주고, 키 이름·값 휴리스틱(`fieldKind` — DATE_KEY_RE, ISO_DATE_RE, 값 typeof)으로 input 타입만 다르게 분기한다. 한계:

1. **타입을 영속화하지 않음** — 빈 list (`tags: []`), 미입력 date 등은 휴리스틱으로 추론 불가. 사용자가 "이 필드는 날짜다"라고 명시할 방법 없음.
2. **위젯이 단조** — 태그를 쉼표 문자열로만 받음. 칩 + 자동완성, 날짜 picker, 체크박스 토글 같은 타입 적합 UI 없음.
3. **Obsidian과 UX 차이** — Obsidian은 우클릭 → "속성 유형"으로 타입 명시 변경 + 타입별 위젯 제공. Munix는 Obsidian 대체 포지션이므로 같은 vault를 양쪽에서 열었을 때 동일한 속성 UI가 보여야 한다.

### 결정

**`.obsidian/types.json` (Obsidian 표준 포맷) 을 master 저장소로 채택.** 

- **위치**: vault 루트의 `.obsidian/types.json`
- **포맷** (Obsidian과 정확히 일치):
  ```json
  {
    "types": {
      "tags": "tags",
      "aliases": "aliases",
      "created": "datetime",
      "due": "date",
      "rating": "number",
      "draft": "checkbox",
      "cssclasses": "multitext"
    }
  }
  ```
- **타입 vocabulary** (Obsidian과 동일, 한글 라벨은 UI 레이어에서):

  | 타입 | 한글 라벨 | 위젯 |
  |---|---|---|
  | `text` | 텍스트 | `<input type="text">` |
  | `multitext` | 목록 | chip input |
  | `number` | 숫자 | `<input type="number">` |
  | `checkbox` | 체크박스 | toggle |
  | `date` | 날짜 | `<input type="date">` |
  | `datetime` | 날짜 및 시간 | `<input type="datetime-local">` |
  | `tags` | 태그 (특수 multitext) | chip + TagIndex 자동완성 |
  | `aliases` | 별칭 (특수 multitext) | chip |

- **`.obsidian/` 디렉터리 처리**: vault 루트에 없으면 처음 타입 변경/저장 시 자동 생성. 사용자가 Obsidian을 안 쓰더라도 호환 비용은 빈 디렉터리 하나뿐.
- **타입 미지정 fallback**: `.obsidian/types.json`에 키가 없으면 기존 `fieldKind` 휴리스틱으로 추론. 사용자가 우클릭 → 속성 유형으로 명시하는 순간 `types.json`에 기록.
- **읽기 시점**: vault open 시 1회 로드 + Rust watcher의 `.obsidian/types.json` 변경 이벤트로 핫 리로드 (Obsidian이 수정한 경우 즉시 반영).
- **쓰기 시점**: 사용자가 우클릭 메뉴로 타입 변경 시. fire-and-forget IPC, optimistic UI.

### 대안 검토

| 방식 | 기각 사유 |
|---|---|
| Munix 전용 `.munix/types.json` 사용 | Obsidian에서 같은 vault를 열면 타입 정보 누락. 대체 포지션 정책에 반함 |
| Frontmatter 자체에 타입 인코딩 (`tags__type: list`) | `.md` 파일 오염. ADR-001 (Obsidian 100% 호환) 위반 |
| 휴리스틱만 유지 (현재 방식 그대로) | 빈 list/date 영속화 불가, 사용자 의도 표현 불가 |
| `.obsidian/types.json` 읽기는 하되 쓰기는 `.munix/`에 | 우선순위 충돌 시 결정 복잡 (master가 둘?). 일관성 깨짐 |

### 영향

- **새 파일 생성**: `.obsidian/types.json` (vault에 처음 타입 지정 시)
- **`.munix/`는 그대로**: backup, cache, settings 만 보관. 타입 정보는 Obsidian 정책 따름
- **마이그레이션**: 기존 vault는 `.obsidian/types.json` 없는 상태로 시작 → 휴리스틱으로 동작 → 사용자가 명시하면 그때 파일 생성
- **Watcher**: `.obsidian/types.json` 도 watch 대상 (외부 변경 감지). suppress window 동일 적용 (자기 쓰기 echo 방지)
- **권한**: 모든 FS 접근은 vault 모듈 통과 (CLAUDE.md 보안 정책). `.obsidian/` 도 예외 아님

### 위험

- **Obsidian 포맷 변경**: Obsidian이 향후 `types.json` 스키마를 바꾸면 호환 깨질 수 있음. 완화: 알려지지 않은 타입은 `text`로 폴백. 우리가 모르는 키는 그대로 보존 (overwrite 시 spread).
- **사용자가 Obsidian을 안 씀**: `.obsidian/` 디렉터리 자동 생성이 거슬릴 수 있음. 완화: 사용자가 첫 타입을 명시할 때까지 생성 안 함 (빈 vault에 자동 생성 X).

### 후속

- **spec**: `specs/frontmatter-properties-spec.md` 에서 위젯/우클릭 메뉴/키보드 단축키/마이그레이션/엣지케이스 상세화.
- **구현**: ADR-027처럼 인프라(타입 store + IPC) → 위젯 → UX 순으로 분리 커밋.

---

## ADR-029: UX/UI 결정은 Obsidian 사용성에 최대한 일치 (HR vs Frontmatter 입력 규칙 포함)

**상태:** ✅ 채택
**결정일:** 2026-04-25

### 배경

ADR-001 ("`.md` 네이티브 + Obsidian 100% 파일 호환"), ADR-028 (속성 타입 메타 `.obsidian/types.json` 호환) 으로 **파일/데이터** 레벨 호환은 명시되어 있다. 하지만 **UX/UI 결정**은 그동안 사례별로 결정되면서 일부 영역에서 Obsidian과 다른 동작이 누적됐다. 예:

- 제목 입력란 부재 (Obsidian은 에디터 최상단 제목 = 파일명, Munix는 파일 트리에서만 rename)
- `---` 입력 시 Munix는 항상 HR 처리, Obsidian은 문서 최상단에서만 frontmatter 트리거
- 우클릭 메뉴 vs 더블클릭 (이미 ADR 외 수정으로 정렬됨)

사용자는 Munix를 "Obsidian 대체"로 사용하므로, **같은 vault를 양쪽에서 열었을 때 학습한 입력 습관이 그대로 통해야** 한다. 사례별 결정 누적은 일관성을 깨뜨린다.

### 결정

**기본 원칙: UX/UI 의사결정은 Obsidian의 사용성을 우선 참조하고, 명시적 사유 없이는 다른 동작으로 가지 않는다.**

#### 운영 규칙

1. **새 UX 결정 시 Obsidian 동작 먼저 확인** — 동일 시나리오에서 Obsidian이 어떻게 처리하는지 조사.
2. **차이점 채택은 ADR 필수** — 의도적으로 Obsidian과 다르게 가는 경우, 그 이유를 ADR에 명시 (보안/성능/Munix만의 가치 등).
3. **단축키, 입력 규칙, 패널 레이아웃, 우클릭 메뉴, 컨텍스트 메뉴 항목, 트리거 시점** 모두 적용 대상.
4. **차이가 불가피한 경우** (예: Tauri 한계로 OS 통합 다른 방식): 사용자가 학습할 새 동작을 최소화. 가능하면 Obsidian 명령과 같은 이름.
5. **i18n**: Obsidian 한국어 라벨 (예: "속성", "잘라내기", "속성 유형") 그대로 차용해 학습 비용 0.

#### ✅ 적용 완료 (2026-04-26) — HR vs Frontmatter 입력 규칙

| 입력 | 위치 | 시점 | 동작 |
|---|---|---|---|
| `---` (3개) | 문서 시작 + frontmatter 없음 + 빈 라인 | 3번째 dash 입력 즉시 | frontmatter 생성, 속성 패널 포커스, dash 제거 |
| `---` + Enter | 그 외 모든 위치 | Enter 시 | HR 삽입 (기존 Tiptap 동작) |
| `---` + Enter | frontmatter 이미 존재 | Enter 시 | HR (명시적으로 HR 원하는 경로 보장) |

상세 구현은 `specs/frontmatter-properties-spec.md` §11 참조 (구현 상태: ✅ implemented 2026-04-26 — `FrontmatterTrigger` Tiptap Extension input rule).

#### ✅ 적용 완료 (2026-04-26) — 제목 = 파일명

- 에디터 본문 위에 제목 입력란 노출 (`<EditorTitleInput />`)
- 입력값을 **blur/Enter 시점에만** rename (Obsidian 동작 매칭). 스펙 v0.1 의 1500ms 디바운스는 시각 반영 지연 + race 문제로 폐기
- 외부 rename은 watcher로 자동 반영
- Obsidian과 동일한 위치 (속성 패널 위, 본문 위)

상세 구현은 `specs/editor-spec.md` §16 참조 (구현 상태: ✅ implemented 2026-04-26).

### 대안 검토

| 방식 | 기각 사유 |
|---|---|
| 사례별 결정 (현행) | 일관성 부재, 사용자 학습 비용 누적 |
| Obsidian 100% 클론 | Munix의 차별화 가치 (Tauri 보안, 플러그인 시스템 등) 희생 |
| Obsidian/Notion 혼합 | 두 모델이 충돌 시 결정 기준 모호. 우선순위 불명확 |

### 영향

- 향후 모든 UX/UI 변경 PR/제안에 "Obsidian이 어떻게 하는가?" 절 필수 (PR 설명 또는 ADR).
- 기존 차이점 점진 정렬: 발견 시마다 ADR로 명시 + 수정 (대규모 일괄 변경은 안 함).
- 신규 기능 (속성 패널 등) 은 처음부터 Obsidian 매칭으로 설계.

### 위험

- **Obsidian 업데이트로 동작 변경 가능**: 새로운 Obsidian 버전이 UX를 바꾸면 우리도 따라가야 할지 결정 필요. 완화: 메이저 변경 시에만 재검토, 마이너 UX는 현행 유지.
- **Munix 차별화 위축**: 모든 결정이 Obsidian 추종으로 흘러가면 차별점 약화. 완화: 운영 규칙 #2 (차이는 ADR 필수)로 의식적 결정 강제.

### 후속

- 신규 ADR/spec 작성 시 "Obsidian 동작" 절 필수 포함 (템플릿 추가 권장).
- 기존 차이점 audit: keymap, slash menu, context menu, panel layout, drag&drop 등 영역별로 비교표 작성 (낮은 우선순위, 발견 시 ADR로 정렬).

---

## ADR-030: PM(EditorContent) 형제로 들어가는 React 패널은 항상 마운트 (조건부 hidden 토글)

**상태:** ✅ 채택
**결정일:** 2026-04-26
**관련 코드:** `properties-panel.tsx`, `frontmatter-trigger.ts`, `editor-view.tsx`

### 배경

`---` 입력으로 frontmatter trigger 가 발동했을 때 PropertiesPanel 이 처음 마운트되는 순간 다음 에러가 재현됐다:

```
NotFoundError: The object can not be found here.
componentStack: div → PropertiesPanel → ErrorBoundary
flushLayoutEffects → commitLayoutEffectOnFiber (× 다수) → componentDidCatch
```

우리 코드엔 `useLayoutEffect` 가 0개인데 commit phase 의 layout effect 단계에서 throw. WebKit 의 `NotFoundError` 는 DOM 노드가 기대된 위치에 없을 때 (보통 `Node.insertBefore` / `removeChild` 의 reference 가 detached) 발생.

### 진짜 원인

`editor-view.tsx` 의 자식 구조:

```tsx
<div ref={scrollRef}>
  <EditorTitleInput />
  <PropertiesPanel />              {/* 조건부 mount/unmount */}
  <BubbleMenuBar editor={...} />   {/* PM plugin view (tippy.js portal) */}
  <DragHandle editor={...} />      {/* PM plugin view (imperative DOM) */}
  <BlockMenu />                    {/* 조건부 mount */}
  <EditorContent editor={...} />   {/* PM 이 직접 DOM 관리 */}
</div>
```

`---` 입력 시 일어나는 일을 시간순으로:

1. PM input rule handler 가 `chain().deleteRange(range).run()` (또는 `state.tr.delete()`) — PM 이 `EditorContent` 자식 DOM 을 mutate
2. 같은 task 내 microtask 에서 `setFrontmatter({})` → React 가 PropertiesPanel mount commit 스케줄
3. React 의 commit phase 에서 PropertiesPanel 형제 노드들 (BubbleMenu / DragHandle 의 plugin view 가 만들어낸 imperative DOM 포함) 사이에 새 노드를 `insertBefore` 하려는데, **PM plugin view 가 이미 같은 부모 div 의 child list 를 imperative 하게 손댄 상태** → React 가 기대한 reference node 를 못 찾음 → WebKit 이 `NotFoundError` throw

요컨대 **React reconciler 와 PM plugin view 가 같은 부모 div 의 child list 를 두고 동시 mutation race**.

### 시도해본 것 (모두 실패)

| 시도 | 결과 |
|---|---|
| `state.tr.delete` ↔ `chain().deleteRange().run()` 교체 | 동일 에러. tr 패턴은 무관 |
| `queueMicrotask` 로 사이드이펙트 deferral (이미 적용됨) | microtask 도 같은 task tick 안에서 실행되므로 React commit 회피 못 함 |
| `setTimeout(0)` 으로 focus deferral (AddProperty 옛 패턴) | focus 만 늦춰지고 mount race 본체는 그대로 |

### 결정

**PM(EditorContent) 형제로 들어가는 React 패널은 조건부 mount/unmount 를 하지 않는다. 항상 마운트 + visibility 토글로 가시성 변경.**

```tsx
// ❌ Race 위험
if (frontmatter === null) return null;
return <div>...</div>;

// ✅ 안전
const visible = frontmatter !== null;
return (
  <div className={cn("...", !visible && "hidden")} aria-hidden={!visible}>
    ...
  </div>
);
```

### 운영 규칙

- **에디터 영역 내 패널 (PropertiesPanel, BlockMenu, BubbleMenu, TableMenu, DragHandle 등 인접한 React 컴포넌트)** 은 가능하면 항상 마운트.
- 조건부 표시는 `hidden` 클래스 / `aria-hidden` 으로 처리.
- DOM 부담 우려 시: 내부 비싼 children 만 조건부 렌더 (`{visible && <ExpensiveChild/>}`) 해도 됨. 외곽 컨테이너 div 자체가 mount/unmount 토글되지만 않으면 race 회피 가능.
- AddProperty 의 `editing` 상태 input 처럼 **leaf node** 의 mount/unmount 는 안전 (PM plugin view 와 부모 공유 안 함).

### 대안 검토

| 방식 | 기각 사유 |
|---|---|
| **Portal 로 분리** (`document.body` 등 다른 root 에 portal) | PropertiesPanel 은 에디터 본문 위 inline 위치라 portal 부적합. context menu / popover 류엔 적용 가능 |
| **PM 영역 격리 wrap** (`<EditorContent>` 한 단계 더 div 로 감싸기) | 이미 EditorContent 가 자체 div 를 가짐. 한 번 더 감싸면 스크롤/스타일 영향 분석 필요. 미래 옵션 |
| **commit 후 RAF 로 mount 지연** | 추가 timer 의존. 사용자 피드백상 setTimeout/clearTimeout 회피 방향 (memory: `feedback_munix_no_unpredictable_timing`) |
| **항상 마운트** (채택) | 가장 단순, 추가 timing 의존 없음, DOM 부담 미미 |

### 일반화: 비슷한 증상 다시 만나면

다음 상황에서 동일 race 의심:

1. 슬래시 메뉴 / quick open / context menu 로 새 패널이 `editor-view` 자식으로 마운트
2. BubbleMenu / DragHandle / TableMenu 같은 PM plugin view 와 같은 부모 div 에 React 컴포넌트가 조건부로 들어옴
3. 사용자 입력으로 PM tr 발동 + 같은 액션이 React state 변경도 트리거 → mount/unmount

**해결 우선순위:** 항상 마운트 (1순위) → portal (2순위) → PM 영역 격리 wrap (3순위).

### 디버깅 인프라

이 race 는 production 에선 console 한 줄 워닝만 남고 실체가 사라진다 (`react-dom-client.development.js` 가 워닝만 출력). 잡으려면 다음 셋업이 떴 있어야 함:

| 도구 | 역할 |
|---|---|
| React `<ErrorBoundary>` (panel 단위 inline) | `error.stack` + `componentStack` 화면 노출 |
| `tauri-plugin-log` + `attachConsole()` | webview console + LogDir 영속화 (재현 후 분석 가능) |
| `window.error` / `unhandledrejection` 글로벌 트랩 (`src/lib/dev-error-trap.ts`) | boundary 가 못 잡는 비동기 케이스 |

세 가지 모두 [src/components/error-boundary.tsx](../munix/src/components/error-boundary.tsx), [src/lib/dev-error-trap.ts](../munix/src/lib/dev-error-trap.ts), [src/main.tsx](../munix/src/main.tsx), [src-tauri/src/lib.rs](../munix/src-tauri/src/lib.rs) 에 셋업되어 있음. 비슷한 증상 발생 시 `~/Library/Logs/app.munix.desktop/munix.log` 부터 확인.

### 위험

- **항상 마운트로 인한 초기 렌더 비용 미미하게 증가**: PropertiesPanel 의 빈 컨테이너 div 1개 + 헤더 1개 + AddProperty 버튼 1개 정도. 측정상 무시할 수준
- **`hidden` 클래스가 접근성/포커스 관리에 영향**: `aria-hidden` 같이 적용해서 screen reader 영향 차단 (적용 완료)
- **다른 패널에도 일관 적용 필요**: 운영 규칙 #1 로 명시. 신규 패널 PR 시 이 ADR 참조

### 후속

- BlockMenu, SlashMenu 가 추후 같은 위치에 들어올 때 동일 패턴 적용 검토
- `specs/frontmatter-properties-spec.md` §11 (트리거) 에 "PropertiesPanel must remain mounted before/after `---` trigger" 한 줄 추가
- `specs/editor-spec.md` 에 "Editor view 자식 패널은 PM plugin view 와 부모 공유 → 항상 mount 원칙" 절 추가 권장

---

## ADR-031: 멀티 vault 워크스페이스 (cmux 스타일 좌측 세로 탭)

**상태:** ✅ Accepted (구현 완료 2026-04-26)
**제안일:** 2026-04-26
**Accepted:** 2026-04-26
**Supersedes:** [ADR-004](#adr-004-단일-vault-방식)
**관련 스펙:** [multi-vault-spec.md](./specs/multi-vault-spec.md), [vault-spec.md](./specs/vault-spec.md), [workspace-split-spec.md](./specs/workspace-split-spec.md), [keymap-spec.md](./specs/keymap-spec.md), [settings-spec.md](./specs/settings-spec.md), [search-spec.md](./specs/search-spec.md), [cli-spec.md](./specs/cli-spec.md)

### 컨텍스트

ADR-004에서 "v1은 단일 vault만"으로 결정했다. 그러나 실제 사용 패턴을 검토한 결과 다음 욕구가 강하게 드러났다:

1. **컨텍스트 스위칭 비용 0** — 회사 vault / 개인 vault / 학습 vault를 빠르게 오감 (회의 중 todo 슬쩍, 개인 메모 빠른 캡처 등)
2. **참조 + 작성 동시** — 한 vault는 참고, 다른 vault에 정리
3. **격리감 = 안전감** — 회사 정보가 개인 검색 결과에 안 섞임, 자동완성·태그 인덱스도 vault 경계 유지
4. **cmux의 탭 격리 경험** — 사용자가 cmux의 "탭 = 독립 워크스페이스" 패턴에서 강한 UX 가치를 검증함. 도구 일관성 측면에서도 동일 모델 채택이 자연스러움

ADR-004의 단일 vault는 "상태 관리 단순"의 가치를 줬지만, **"vault 빠른 전환 UX 부족"** 이 실제 사용에서 상위 마찰로 확인됐다. 이 ADR로 ADR-004를 superseded 한다.

### 검토한 모델

| | 모델 | 평가 |
|---|---|---|
| **A-1** | Tauri 멀티 윈도우 + 단일 프로세스 + `HashMap<VaultId, VaultState>` | OS 윈도우 매니저 부담, 동시 표시 강함, 멀티 모니터 활용 ◎ |
| **A-2** | 멀티 인스턴스 (Obsidian 방식, 프로세스 N개) | 격리 무료지만 메모리 N배. 우리는 플러그인 격리 압력 아직 없음 → 과함 |
| **B (탭=파일, 섞기)** | 한 창에 vault 무관한 파일 탭 혼합 | 사이드바·검색·자동완성 scope 모호, 격리 가치 훼손 → 거부 |
| **B' (탭=vault 워크스페이스, cmux)** | 좌측 세로 탭 = vault, 클릭 시 워크스페이스 통째 swap | 격리 유지 + 전환 비용 최소 + cmux 사용자 멘탈 모델 일치 |
| **C** | VS Code multi-root (한 창에 여러 vault 트리 동시) | 크로스 vault 검색·이동 재설계 부담 큼, v2 이후로 보류 |

### 결정

**기본 모델은 B' (cmux 스타일 좌측 세로 vault 탭) + A-1 (탭 → 새 창 승격)** 의 하이브리드.

- **격리 단위:** vault. Rust backend는 `HashMap<VaultId, VaultState>`로 N개 vault 동시 운영 (자체 watcher / 인덱스 / save queue)
- **표시 단위:** 좌측 세로 vault 탭(=Vault Dock). 탭 = vault 워크스페이스 1개. 탭 클릭 = 우측 메인 영역 통째 swap (사이드바 트리 / 파일 탭 / 검색 상태 / undo 스택 / 스크롤 위치 모두)
- **탭 → 창 승격:** 탭 우클릭 → "새 창으로 분리" 또는 드래그 아웃 (Chrome 패턴). 동시 표시·멀티 모니터 시나리오는 이걸로 해결
- **격리 강도:** 검색·자동완성·태그·백링크는 항상 그 vault scope. 크로스 vault 검색은 v2까지 의도적으로 안 함 (격리 가치 보호)
- **공유 자원:** 글로벌 settings, 테마, 단축키는 모든 vault 공통. vault별 override는 `.munix/settings.json` (settings-spec)

상세 구조·IPC 변경·UX 디테일은 [specs/multi-vault-spec.md](./specs/multi-vault-spec.md) 참조.

### 결과

**긍정:**
- vault 전환 비용 0에 수렴 (cmux 검증된 UX)
- 격리 유지 (검색·인덱스·자동완성 vault scope, 의도된 프라이버시)
- 멀티 모니터·동시 표시는 탭 승격으로 옵셔널 지원
- 메모리 효율: 단일 프로세스 + 인덱스만 N개 (Obsidian 멀티 인스턴스 대비 절감)
- 도구 일관성 (cmux 사용자 멘탈 모델 즉시 매칭)

**부정:**
- 모든 vault 관련 IPC 커맨드에 `vault_id` 인자 추가 필요 (하위 호환 깨짐 → 일괄 마이그레이션)
- Frontend store가 vault 탭별로 인스턴스 관리 (현재 단일 글로벌 store 가정 → 슬라이스 분리 + 탭 swap 시 복원/저장 인프라 필요)
- FS watcher를 vault별로 N개 운영 (메모리·파일 핸들 증가 → idle vault 인덱스 자동 unload 정책 필요)
- 다른 spec 영향 큼: keymap (vault-aware vs 글로벌 명령 분리), settings (글로벌 vs vault override), search (scope 명시), cli (URI에 vault 라우팅)

**중립:**
- vault-spec.md의 보안·경로 안전성·원자적 쓰기 본질은 그대로. `Vault` 구조체 단위 자체엔 변경 없음
- workspace-split-spec과 자연스럽게 결합 (각 split pane은 자기 vault scope 유지)

### 마이그레이션 전략

1. **Backend**: `AppState.vault: Mutex<Option<Vault>>` → `AppState.vault_manager: VaultManager` (`HashMap<VaultId, VaultState>` 보유)
2. **IPC**: 모든 vault-bound 커맨드 시그니처에 `vault_id: VaultId` 추가. 단일 vault 시점 호출은 한 번에 일괄 변경
3. **Frontend store**: `vaultStore` / `tabStore` / `editorStore` / `searchStore`를 vault 탭별 인스턴스로 분리. 탭 swap 시 메모리 보존 + IndexedDB 영구화
4. **UI**: 좌측 Vault Dock 신규. 기존 단일 vault UI는 "vault 1개 열림" 상태로 자연스럽게 호환
5. **단일 vault 사용자**: 첫 실행 시 last_vault를 첫 탭으로 자동 등록 → 전환 비용 없이 멀티 vault 환경으로 이행

### 대안 (검토 후 거부/보류)

- **A-2 (Obsidian 멀티 인스턴스)**: 메모리 비용 N배. 플러그인 격리 압력이 커지는 시점(v2 플러그인 생태계 확장)에 재검토
- **B (탭=파일, vault 섞기)**: 격리 본질 훼손, 사용자 안전감 가치 손상 → 거부
- **C (VS Code multi-root, 한 창 다중 vault 트리)**: 크로스 vault 검색·이동 설계 부담 큼. B' + 탭 승격으로 80% 가치 확보, v2 이후 검토

### 선례 (Prior Art)

| 제품 | 모델 | 시사점 |
|---|---|---|
| **cmux** | 좌측 세로 탭 = worktree 워크스페이스 | 우리 모델의 직접 레퍼런스 (검증된 UX) |
| **Claude Code Desktop** | project = cwd, 세션·메모리·설정 project-scoped | A-1 단일 프로세스 멀티 워크스페이스 선례 |
| **VS Code** | folder/workspace 단위 + 멀티 윈도우 | 글로벌 vs 워크스페이스 settings 패턴 차용 |
| **Obsidian** | vault = 멀티 인스턴스 (A-2) | 격리는 따라가되 프로세스 격리는 미채택 |
| **JetBrains** | project = 프로세스 (A-2) | 메모리 비용 교훈 |
| **Slack/Discord** | 좌측 워크스페이스 사이드바 | 좌측 세로 탭 메타포 검증 |

### 참고

- [specs/multi-vault-spec.md](./specs/multi-vault-spec.md) — 본 ADR의 상세 스펙
- [ADR-004](#adr-004-단일-vault-방식) — superseded
- [ADR-029](#adr-029-uxui-결정은-obsidian-사용성에-최대한-일치-hr-vs-frontmatter-입력-규칙-포함) — vault 단위 격리는 Obsidian 동작과 정합. 단, vault 동시 표시 UX는 cmux를 우선

---

## ADR-032: 글로벌 vault 레지스트리 — `munix.json` 백엔드 파일

**상태:** ✅ Accepted (구현 완료 2026-04-26)
**제안일:** 2026-04-26
**Accepted:** 2026-04-26
**관련:** [ADR-031](#adr-031-멀티-vault-워크스페이스-cmux-스타일-좌측-세로-탭) (멀티 vault), [multi-vault-spec.md](./specs/multi-vault-spec.md)
**Supersedes (부분):** ADR-031 D2 의 localStorage 의존 부분 — 워크스페이스 영구화는 그대로 `<vault>/.munix/workspace.json`, **글로벌 vault 목록**만 backend 파일로 이관

### 컨텍스트

ADR-031 채택 후, vault 목록과 마지막 active vault 가 frontend `localStorage` 에 저장되어 왔다 (`munix:vaultHistory`, `munix:lastVault`, `munix:vaultDockVisible`, `munix:recent:<root>`). 운영 중 다음 마찰이 누적:

1. **localStorage 깨짐 시 vault 정보 소실** — devtools 에서 storage clear, 캐시 reset, dev 모드 변경 등으로 사라지면 사용자가 직접 vault 다시 찾아야 함.
2. **백업/이동 어려움** — Obsidian 은 `obsidian.json` 한 파일 복사로 vault 목록 이전 가능. Munix 는 localStorage 라 export 도 어려움.
3. **백엔드 단일 source 의 가치** — vault 메타가 backend 파일 1개에 모이면 export/백업/회복 모두 단순. (※ 원래 멀티 윈도우 대비 사유였으나, 멀티 윈도우는 2026-04-26 폐기 — backend 단일 source 가치 자체는 유효.)
4. **"꼬였다" 사고 회복 도구 부재** — vault 정리 명령을 만들기 어려움 (localStorage 직접 손대야).

Obsidian 은 `~/Library/Application Support/obsidian/obsidian.json` 한 파일에 vault 목록·마지막 상태를 저장한다. 이 모델이 검증돼 있음.

### 결정

**`~/Library/Application Support/app.munix.desktop/munix.json` 단일 backend 파일에 글로벌 vault 레지스트리를 둔다.** localStorage 의 `munix:vaultHistory` / `munix:lastVault` 는 폐지 + 부팅 1회 자동 마이그레이션.

#### 파일명 / 위치

- **파일명:** `munix.json` (D5 결정, 2026-04-26)
- **위치:** Tauri `app_config_dir()` 하위 — macOS: `~/Library/Application Support/app.munix.desktop/munix.json`. Linux/Windows 도 OS 표준 위치.
- Obsidian 의 `obsidian.json` 과 **같은 위치 공유 안 함** — race / 호환 모호 회피. 포맷만 비슷하게.

#### 스키마 v1

```json
{
  "version": 1,
  "vaults": {
    "<uuid v4>": {
      "path": "/Users/example/notes-work",
      "ts": 1714112000000,
      "open": true,
      "active": true
    },
    "<uuid v4>": {
      "path": "/Users/example/notes-personal",
      "ts": 1714000000000,
      "open": false
    }
  }
}
```

- `path`: canonical absolute path (resolve 후)
- `ts`: 마지막 open 한 unix ms — recent 정렬용
- `open`: 마지막 부팅 종료 시 열려 있었는지 — 다음 부팅 시 자동 reopen 대상
- `active`: 마지막 active vault 표시 (한 번에 1개만 true)

#### 부팅 정책

**(ii) 마지막에 열려있던 모든 vault 자동 reopen** (D5 결정, 2026-04-26).

- 부팅 시 `open: true` 인 모든 entry 를 backend 에서 `VaultManager.open()` 호출 → vault-dock-store 에 등록
- `active: true` 인 vault 를 active 로 설정 (없으면 ts 가장 큰 것)
- 신뢰 prompt 는 vault 별로 한 번씩 (vault-trust-spec)

#### 마이그레이션

부팅 시 1회 자동:
1. `munix.json` 이 없고 `localStorage[munix:vaultHistory]` 가 있으면:
   - history 의 각 path 에 대해 `path`, `ts`(현재 시각), `open: false` 로 entry 만들기
   - `localStorage[munix:lastVault]` 가 있으면 그 path 의 entry 를 `open: true, active: true` 로
   - `munix.json` 저장
   - `localStorage[munix:vaultHistory]`, `localStorage[munix:lastVault]` 제거
2. `munix:recent:<root>` 는 vault scope 라 그대로 유지 (vault 안의 `.munix/workspace.json` 으로 옮기는 별도 후속)
3. `munix:vaultDockVisible` 는 UI 설정이라 유지

### 결과

**긍정:**
- localStorage 깨짐 사고에 대한 방어
- vault 목록 백업/이동 한 파일로 가능
- vault 정리 명령 (palette) 깔끔하게 구현 가능
- Obsidian 모델 정합 (ADR-029 의 정신과 일치)

**부정:**
- IPC round-trip 1번 추가 (부팅 시) — 비용 미미
- 마이그레이션 로직 1회성 코드 추가
- `munix.json` 직접 수정 시 충돌 가능 (atomic write 로 완화)

### 대안 (검토 후 거부/보류)

- **Obsidian 의 `obsidian.json` 그대로 공유** — 동시 수정 race 위험. 대신 같은 포맷만 채택.
- **localStorage 유지 + sync 만 추가** — 진실의 원천 두 곳 → race. 처음부터 backend 로.

### 참고

- [multi-vault-spec.md §4](./specs/multi-vault-spec.md) — 모델 변경 (registry 추가)
- ADR-031 D2 — workspace.json (vault 안) 그대로 유지
- 구현은 Phase B-ε.4 (커밋 `8edaf45` `8a63cd1` `8147ee3` `5ea5ba8` `399bca1`) 로 마무리

### Phase D (멀티 윈도우) 폐기 (2026-04-26)

ADR-031 multi-vault-spec §17.1 의 Phase D — OS 레벨 멀티 윈도우 (Tauri `WebviewWindow` 동적 생성 + 같은 vault 두 OS 창 동시 운영) — 는 채택하지 않는다.

**사유:**
- Munix 의 앱 컨셉 (로컬 퍼스트 + 단순함 + Obsidian-style 단일 창 워크스페이스) 과 불일치
- OS 창 분리는 사용자 멘탈 모델 분산 — "어느 창에 무엇이 열려 있나" 추적 부담
- 가치 대비 backend 부담 큼: `VaultManager.subscribers` ref count, ActiveVault 창별 분기 (`HashMap<WindowLabel, VaultId>`), capability scope 윈도우 라벨 패턴 (`vault-*`), workspace.json 충돌 정책 (owner 락) — 모두 신규 작업

**대체:**
- 멀티 문서 비교/참조 욕구 → [workspace-split-spec.md](./specs/workspace-split-spec.md) (한 창 안 split tree, Obsidian 패턴)
- 멀티 vault 동시 운영 → 이미 좌측 Vault Dock (Phase A~C, accepted) 으로 충족
- 두 욕구의 80% 가치를 한 창 안에서 확보 — 멀티 모니터 사용자만 진짜 OS 창 분리 혜택

**향후 처리:** OS 멀티 윈도우 제안이 다시 제기되면 거부하고 multi-vault-spec §17.1 + 본 footnote 를 가리킬 것.

---

## 참고

- [스펙 문서](./specs/README.md)

**다음 리뷰:** Phase 1 완료 후, 또는 중대한 요구사항 변경 시
**최근 업데이트:** 2026-04-26 — ADR-031 Phase D (멀티 윈도우) 폐기 footnote 추가 (앱 컨셉 불일치, workspace-split 으로 대체). ADR-031 본문은 Accepted 유지 (Phase A~C + F 구현 완료).
