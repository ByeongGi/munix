# Munix — 수동 검증 체크리스트

> **상태:** 자동화 전환 대기열.
> 최종 목표는 이 문서의 모든 회귀 항목을 자동화 테스트로 치환하는 것이다.
> 새 수동 회귀 항목은 추가하지 않는다. 불가피하게 남길 경우 자동화 대상 레이어와 만료 조건을 같이 적는다.
>
> 현재 남은 수동 테스트 부채는 `cd munix && pnpm test:manual-debt`로 집계한다.
> 전환 기준은 [test-automation-strategy.md](./test-automation-strategy.md)를 따른다.
>
> `pnpm tauri dev` 후 직접 확인하는 방식은 임시 fallback이다.
> 버그 발견 시 [issues-log.md](./issues-log.md)에 기록.
>
> **검증 완료된 항목은 본 문서에서 제거됨** — 회귀 검증 필요 시 git history (`git log --oneline`) 또는 [issues-log.md](./issues-log.md) 참조.

**사용 환경:** macOS (Tauri 2 + WKWebView)
**자동화 게이트:** `pnpm check`, `pnpm test:render`, `pnpm test:manual-debt`

범례: 🔴 미검증 · ⚠️ 알려진 이슈

---

## 0. 환경 · 부팅

- [ ] 🔴 첫 실행: 폴더 열기 버튼 → native folder picker → vault 활성화
- [x] ✅ 첫 실행 화면: "샘플 vault 만들기" → Documents/Munix Sample Vault 생성 → 샘플 노트 자동 생성 → Welcome.md 열림 (2026-04-26)
- [ ] 🔴 두 번째 실행 이후: `munix.json` 의 마지막 active vault 자동 reopen (open: true 인 다른 vault 도 모두 reopen — ADR-032)
- [ ] 🔴 vault 폴더가 외부에서 삭제된 후 재실행 → reopen 실패 catch 에서 entry 가 closed 로 옮겨짐
- [ ] 🔴 최근 vault 기록 제거 시 더 이상 참조되지 않는 trusted-vaults.json path도 같이 정리
- [ ] 🔴 vault 열기 실패 시 해당 path 가 히스토리에서 자동 제거

> 자동화 완료: no-vault picker 렌더, mock vault workspace 렌더, closed/missing recent vault disabled + "missing" 배지 표시, 최근 vault 클릭 오픈, 최근 vault history 제거 UI.

### 0a. 멀티 vault (ADR-031, ADR-032)

- [ ] 🔴 첫 vault open 시 trust prompt (네이티브 confirm "이 폴더를 vault 로 신뢰하시겠습니까?") → 동의 시 trusted-vaults.json 에 추가
- [ ] 🔴 같은 vault 두 번째 open 은 prompt 없이 바로 열림 (이미 trusted)
- [ ] 🔴 trust prompt cancel 시 silent — error toast 없음
- [ ] 🔴 Vault Dock (좌측 세로 탭) 표시: vault 이름 + 경로 + active 표시줄
- [ ] 🔴 Vault Dock + 버튼 으로 새 vault 추가 → 즉시 활성화 + dock 에 추가
- [ ] 🔴 Vault Switcher 팔레트 `⌘⇧O` — 열린 vault / 최근 닫힌 / 새 vault 액션 그룹
- [ ] 🔴 단축키: `⌘⇧N` 새 vault, `⌘⌥W` 닫기, `⌘⌥1~9` 점프, `⌘⌥[/]` prev/next, `⌘⌥B` Dock 토글
- [ ] 🔴 vault 전환 시: tabs / file tree / 검색 인덱스 / backlink / tag 인덱스가 그 vault 의 것으로 swap
- [ ] 🔴 vault 별 워크스페이스 영구화: 탭 / 사이드바 펼침 상태가 `<vault>/.munix/workspace.json` 에 저장 + 재오픈 시 복원
- [ ] 🔴 앱 종료 후 재실행: 마지막 active vault 의 열린 탭 목록 / active tab / active file 본문이 그대로 복원됨
- [ ] 🔴 split 상태에서 앱 종료 후 재실행: split tree / pane 별 탭 / active pane / active tab 이 그대로 복원됨
- [ ] 🔴 status bar: vault 이름 + 경로 + save status (idle/dirty/saving/saved/error/conflict) + 인덱싱 상태
- [ ] 🔴 settings 글로벌/Vault 그룹 분리: "Vault: <name>" 섹션 등장 + fontSize/editorWidth/autoSaveDebounceMs override + "글로벌 값으로 재설정" 버튼
- [ ] 🔴 vault 별 settings 영구화: `<vault>/.munix/settings.json` 에 override 저장 + 재오픈 복원
- [ ] 🔴 멀티 vault 동시 운영 안전성: vault A 활성 상태에서 vault B 의 .md 외부 수정 → vault B 의 search/backlink/tag 인덱스에만 반영 (active 인덱스 오염 X)
- [ ] 🔴 vault 닫기 + 기록에서 제거 (X 버튼 또는 우클릭) → munix.json + trusted-vaults.json 에서 같이 정리

## 1. Vault & 파일 트리 기본

- [ ] 🔴 비-md 파일 회색 표시, 클릭해도 열리지 않음
- [ ] 🔴 폴더 chevron 클릭으로 접기/펼치기
- [ ] 🔴 키보드 네비 (포커스 후): ↑/↓ 이동, → 폴더 펼침/자식 진입, ← 폴더 접기/부모, Enter 열기, F2 이름 변경

## 2. 파일 CRUD

- [ ] 🔴 새 파일 생성 → 자동 rename 모드 진입
- [ ] 🔴 새 폴더 생성 → 자동 rename 모드 진입
- [ ] 🔴 인라인 rename: Enter 커밋 / Esc 취소 / blur 커밋 / 확장자 자동 보정
- [ ] 🔴 rename input 실시간 유효성: 금지 문자 / Windows 예약어 / trailing dot · space → 빨간 테두리 + 에러 메시지 toast
- [ ] 🔴 컨텍스트 메뉴: "경로 복사" — 절대 경로 클립보드 복사
- [ ] 🔴 컨텍스트 메뉴: "시스템 파인더에서 보기" — 파일이면 부모 폴더 열기, 폴더면 자체 열기 (plugin-opener)

> 자동화 완료: Rust `validate_name` 금지 문자/Windows 예약어/trailing dot·space 검증, create_file/create_folder/rename InvalidName 회귀, vault relative path traversal 차단.

## 3. 파일/폴더 드래그 앤 드롭 (DnD) — ✅ 검증 완료

> 2026-04-25 픽스: c986f76 (Tauri dragDropEnabled), b8bad26 (호버 timer).
> 회귀 의심 시 [issues-log.md](./issues-log.md) 최상단 참조.

## 4. 탭 시스템

> 자동화 완료: tab helper 순수 로직(닫기/오른쪽 모두 닫기/모두 닫기/rename/remove/reorder)과 active pane 라우팅. 남은 항목은 실제 UI interaction.

- [ ] 🔴 새 파일 → 새 탭 생성
- [ ] 🔴 사이드바에서 클릭 → 새 탭 (또는 이미 열린 탭이면 활성)
- [ ] 🔴 탭 클릭 → 활성, 닫기 버튼, 휠 클릭 닫기
- [ ] 🔴 컨텍스트 메뉴: 닫기 / 다른 탭 모두 / 오른쪽 모두 / 모두
- [ ] 🔴 단축키: `Mod+T` (새), `Mod+W` (현재 닫기), `Mod+Shift+W` (모두), `Mod+1~9`, `Mod+Shift+[/]`
- [ ] 🔴 dirty dot: 편집 중 / 저장됨 표시 전환
- [ ] 🔴 탭 11개 이상 시 우측에 노란 경고 배지 (`N/10` + AlertTriangle) 표시
- [ ] 🔴 제목 입력 중: 제목 입력창 / active tab / inactive pane tab / 파일 트리 파일명이 같은 draft 값으로 즉시 표시됨
- [ ] 🔴 제목 입력 중: 실제 파일명이 즉시 rename 되며, 커서가 에디터 본문으로 이동하지 않음
- [ ] 🔴 제목 rename 실패(중복/금지 문자): draft 가 기존 파일명으로 revert 되고 탭/파일 트리 표시도 같이 되돌아감

## 5. 자동 저장 — ✅ 검증 완료

## 6. 충돌 감지 (저장 시점) — ✅ 검증 완료

## 7. FS Watcher (실시간 외부 변경)

- [ ] 🔴 외부에서 파일 생성 → 트리에 즉시 표시
- [ ] 🔴 외부에서 파일 삭제 → 트리에서 제거 + 열려있는 탭 닫힘
- [ ] 🔴 외부 수정 + 에디터 idle/saved → 자동 reload
- [ ] 🔴 외부 수정 + 에디터 dirty → 방치 (저장 시 충돌 다이얼로그)
- [ ] 🔴 vault 전환: 이전 watcher 정지 + 새 watcher 시작
- [ ] 🔴 자기 쓰기 echo suppression: 우리가 저장한 것이 reload 트리거 안 함

## 8. 검색

### 8a. 인파일 (Mod+F) — ✅ 검증 완료

### 8b. Vault 전체 (Mod+Shift+F)

- [ ] 🔴 🔄 재구성 버튼 동작 (코드 확인됨 — `search-panel.tsx:49-61`, 검증만 남음)
- [ ] 🔴 watcher가 deleted/created/modified 이벤트로 인덱스 자동 증분 갱신 (수동 재구성 없이도 결과 갱신)
- [ ] 🔴 정규식 모드 UI 토글 (`Regex` 아이콘) — 활성 시 입력창 monospace, 잘못된 정규식이면 빨간 에러 메시지 표시
- [ ] 🔴 결과를 폴더(부모 디렉터리)별로 그룹 헤더 (sticky `📁 path · N건`)로 묶어 표시
- [ ] 🔴 검색 결과 클릭 → 해당 파일 열림 + 검색어 하이라이트 + 결과에 표시된 `Line N` 근처로 스크롤
- [ ] 🔴 같은 파일에 동일 검색어가 여러 번 있을 때 첫 번째 결과가 아닌 항목을 클릭해도 해당 결과 라인 근처로 이동
- [ ] 🔴 검색 결과 이동 후 인파일 검색바가 열리고 Enter/Shift+Enter로 다음/이전 매치 이동

> 자동화 완료: `VaultSearchIndex` build/search, regex 검색 MiniSearch 우회, 잘못된 regex throw, update/rename/removeDoc 회귀.

## 9. QuickOpen / Command Palette / 치트시트 / 설정

> 자동화 완료: Command Palette prefix parser(`없음`, `>`, `#`, `@`, `:`)와 Markdown heading extraction. 남은 항목은 결과 렌더링과 Enter 실행 흐름.

- [ ] 🔴 `Mod+P` QuickOpen — 빈 쿼리 시 최근 파일 우선
- [ ] 🔴 결과 ↑↓ Enter Esc
- [ ] 🔴 `Mod+K` Command Palette — prefix 없음: 파일 검색 결과 표시, ↑↓ Enter로 파일 열기, 최근 파일 우선
- [ ] 🔴 `Mod+K` Command Palette — `>` prefix: 명령 검색/실행 (`> theme`, `> split`, `> vault` 등)
- [ ] 🔴 `Mod+K` Command Palette — `#` prefix: 태그 검색 결과 표시, Enter 시 검색 패널로 이동하고 `#tag` 쿼리 적용
- [ ] 🔴 `Mod+K` Command Palette — `@` prefix: 현재 파일 heading 목록 표시, Enter 시 해당 heading으로 스크롤
- [ ] 🔴 `Mod+K` Command Palette — `:` prefix: `:10` 같은 Markdown source line 기준 이동. 검색 결과 `Line N` 이동과 체감 위치가 크게 어긋나지 않는지 확인
- [ ] 🔴 `Mod+K` Command Palette — prefix hint/footer, badge, placeholder가 ko/en 언어 전환 후 즉시 갱신
- [ ] 🔴 `Mod+/` 단축키 치트시트
- [ ] 🔴 치트시트 내 검색 input — 단축키/동작/그룹 제목 fuzzy 필터, "지우기" 버튼, Esc로 닫기
- [ ] 🔴 `Mod+,` 설정 다이얼로그
- [ ] 🔴 설정: 테마 (system/light/dark) — 즉시 적용
- [ ] 🔴 설정: 본문 크기 (sm/base/lg/xl) — CSS 변수
- [ ] 🔴 설정: 에디터 너비 (narrow/default/wide/full)
- [ ] 🔴 설정: auto-save debounce (500/750/1500/3000ms) — 변경 후 다음 입력부터 새 간격 적용
- [ ] 🔴 설정: 사용자 CSS — textarea 입력 즉시 반영, 빈 값이면 `<style id="munix-user-css">` 제거
- [ ] 🔴 설정: 기본값 복원
- [ ] 🔴 설정: Rust `app_config_dir/settings.json`에 영속화 (localStorage는 fallback). 첫 실행은 localStorage→Rust 마이그레이션 1회. 두 번째 실행부터 Rust 값이 master.

## 10. 에디터 — 슬래시 메뉴 (`/`)

> 트리거 + idle 안정성은 검증 완료 (commit e764ab3 — DragHandle props 안정화).

- [ ] 🔴 키보드 ↑↓ Enter Tab Esc
- [ ] 🔴 한글 fuzzy 필터 (`/제목`, `/할일`, `/표`)
- [ ] 🔴 14개 항목: H1-3, bullet/numbered/task, code, quote, divider, table, callout 4종, toggle
- [ ] 🔴 그룹 헤더 표시: 제목 / 리스트 / 블록 / 콜아웃 (4개) — 검색 시에도 헤더 유지

## 11. 에디터 — 버블 메뉴 (선택 시)

- [ ] 🔴 텍스트 선택 → 상단 floating bar
- [ ] 🔴 B / I / S / Code / Highlight / Link 토글
- [ ] 🔴 Link 버튼 → URL 프롬프트
- [ ] 🔴 코드 블럭 안에서는 안 뜸

## 12. 에디터 — 표

- [ ] 🔴 셀 사이 Tab/Shift+Tab 이동
- [ ] 🔴 컬럼 리사이즈 핸들 (저장은 안 됨, GFM 한계)
- [ ] 🔴 표 안 커서 시 우상단 floating BubbleMenu 표시: 행 추가(위/아래)·삭제, 열 추가(왼/오)·삭제, 헤더 행 토글, 표 삭제
- [ ] 🔴 표 안에서 텍스트 선택 시 일반 BubbleMenu (B/I/S/Code/Highlight/Link)로 전환되는지

## 13. 에디터 — Callout / Toggle

- [ ] 🔴 슬래시 `/콜아웃` 또는 `/info` 등으로 4종 콜아웃 삽입
- [ ] 🔴 9가지 KIND 자동 인식: note/info/tip/warning/danger/success/quote/todo + alias
- [ ] 🔴 토글: `[!NOTE]+/-` 마커 → 헤더 클릭으로 fold/unfold
- [ ] 🔴 fold 상태 ephemeral (마크다운 미저장)
- [ ] 🔴 round-trip: 마커가 디스크에 저장되어 Obsidian 호환

## 14. 에디터 — Highlight `==text==`

- [ ] 🔴 텍스트 선택 후 버블 메뉴 highlight 버튼
- [ ] 🔴 `==text==` 입력 → InputRule로 자동 변환
- [ ] 🔴 외부 .md의 `==text==` 로딩 시 노란 배경 표시
- [ ] 🔴 저장 시 `==text==` 형식 보존 (Obsidian 호환)

## 15. 에디터 — Wikilink `[[...]]`

> 트리거 + idle 안정성은 검증 완료 (commit e764ab3 — DragHandle props 안정화).

- [ ] 🔴 ↑↓ Enter Tab Esc 네비
- [ ] 🔴 선택 시 `[[Title]]` 인라인 노드 삽입
- [ ] 🔴 클릭 시 해당 파일 새 탭으로 열림
- [ ] 🔴 alias `[[Title|별명]]` 표시
- [ ] 🔴 round-trip: `.md` 저장 시 `[[Title]]` 형식 보존

## 16. 에디터 — 이미지

> **참고:** Tauri `dragDropEnabled: false`로 OS 파일 드롭이 webview에서 차단됨.
> 외부 파일 드롭이 필요하면 webview 내부 `ondrop` 핸들러에서 `e.dataTransfer.files`로 직접 처리해야 함.
>
> **썸네일 캐시 백엔드:** `ipc.getThumbnail(relPath)` IPC 추가 (Rust). 5MB 이상 이미지는 256x256 fit + JPEG q80으로 `.munix/cache/thumbs/{sha1}.jpg`에 캐싱 후 절대 path 반환. 작은 이미지는 원본 path 그대로. NodeView에서 사용처 통합은 추후 PR.

- [ ] 🔴 클립보드 이미지 붙여넣기 → `assets/{YYYYMMDD}-{uuid}.{ext}` 저장
- [ ] 🔴 파일 드롭 → 동일 처리 (HTML5 ondrop 직접 구현 필요)
- [ ] 🔴 에디터에 이미지 표시 (asset:// URL 변환)
- [ ] 🔴 저장 시 `![alt](assets/...)` 마크다운 (Obsidian 호환)
- [ ] 🔴 .md 파일 reload 시 이미지 정상 표시
- [ ] 🔴 다른 탭의 같은 이미지도 표시
- [ ] 🔴 이미지 노드 선택 시 alt 텍스트 편집 입력 표시 (NodeView, blur 시 저장)
- [ ] 🔴 이미지 selected 시 우측 하단 보라색 resize 핸들. 드래그 시 픽셀 width 표시 + 실시간 크기 변경 (64–2000px). 더블클릭 시 원래 크기로
- [ ] 🔴 이미지에 width 있을 때 저장: 표준 markdown 대신 inline `<img src=... alt=... width=N>` HTML로 직렬화 (Obsidian/GFM 호환)
- [ ] 🔴 width 없는 이미지: 표준 `![alt](src)` 마크다운 유지
- [ ] 🔴 reload 시 HTML img의 width 속성 보존되어 같은 크기로 표시

> 자동화 완료: Rust `save_asset` 이미지 확장자 whitelist 허용/차단.

## 17. 에디터 — Code block

- [ ] 🔴 `/코드` 또는 ` ``` ` → 코드 블럭
- [ ] 🔴 우상단 언어 드롭다운 — 변경 시 highlight 갱신
- [ ] 🔴 호버 시 "복사" 버튼 등장 → 클릭 시 클립보드 복사 + "복사됨" 표시
- [ ] 🔴 lowlight syntax highlight 적용
- [ ] 🔴 Tab 키로 2 공백 들여쓰기 (코드 블록 안에서만)
- [ ] 🔴 Shift+Tab으로 현재 줄 시작 2 공백 제거 (1 공백만 있으면 1만)

## 18. 에디터 — 블록 액션 (Notion-style)

- [ ] 🔴 호버 시 좌측 ⋮⋮ 그립 등장
- [ ] 🔴 그립 드래그 → 블록 재배치
- [ ] 🔴 그립 클릭 → BlockMenu (위/아래/복제/삭제 + 9 변환)
- [ ] 🔴 단축키: `Mod+Shift+↑/↓` 이동, `Mod+D` 복제, `Mod+Shift+Delete` 삭제, `Mod+Shift+A` NodeSelection

## 19. 에디터 — Heading 접기

- [ ] 🔴 헤딩 좌측 hover 시 ▾ 등장
- [ ] 🔴 클릭 → 다음 동등/상위 레벨 헤딩까지 fold
- [ ] 🔴 ▸ 다시 클릭 → 펼침
- [ ] 🔴 fold 상태 ephemeral (마크다운 미저장)

## 20. 에디터 — Frontmatter

- [ ] 🔴 에디터 상단 "Frontmatter" 접이식 헤더
- [ ] 🔴 key/value 테이블 표시
- [ ] 🔴 값 편집 (Enter/blur) → 자동 저장 트리거
- [ ] 🔴 `+ 필드 추가`
- [ ] 🔴 × 버튼으로 필드 삭제
- [ ] 🔴 `updated` 필드 있을 때 저장 시 자동으로 오늘 날짜(YYYY-MM-DD)로 갱신 (없으면 추가하지 않음)
- [ ] 🔴 타입별 입력 UI: boolean → 토글 스위치, number → 숫자 입력, date → 날짜 picker, 그 외 텍스트

> 자동화 완료: frontmatter 값 표시, `tags`/`aliases`/`keywords` 쉼표 배열 변환, boolean/number scalar 변환, date/number/boolean/text field kind 판별.

## 20.5 에디터 — Properties (Obsidian 호환) 🆕

> 참조: [specs/frontmatter-properties-spec.md](./specs/frontmatter-properties-spec.md) §13, ADR-028 / ADR-029
> 자동화 완료: `.obsidian/types.json` 이 없을 때 `resolve(field, value)` 휴리스틱 타입 추정(text/multitext/number/checkbox/date/datetime/tags/aliases).

- [ ] 🔴 Property 행 우클릭 → 컨텍스트 메뉴 (타입 변경 / 필드 삭제) 표시. 더블클릭은 inline edit (컨텍스트 메뉴 안 열림)
- [ ] 🔴 우클릭으로 타입 변경 → `.obsidian/types.json` 생성/갱신 + Obsidian에서 동일 타입 표시
- [ ] 🔴 외부에서 `.obsidian/types.json` 수정 → watcher가 핫 리로드, UI에 즉시 반영
- [ ] 🔴 multitext chip 입력: `,` / Enter / Tab 분리, Backspace 마지막 chip 삭제, IME 조합 중에는 분리되지 않음
- [ ] 🔴 자동완성: 첫 글자 입력 → 드롭다운 → ↑↓ 선택 → Enter 삽입
- [ ] 🔴 타입별 위젯: text / number / checkbox 토글 / date picker / datetime picker
- [ ] 🔴 회귀: 기존 frontmatter 편집 (text/number/checkbox) 정상 동작, 자동저장 + 인덱스 즉시 갱신, 충돌 다이얼로그 정상
- [ ] 🔴 PropertiesPanel: frontmatter 없는 일반 노트에서는 패널 자체가 hide (헤더 + "속성 추가" 버튼 미노출)

### 20.5.1 `---` 트리거 (ADR-029) 🆕

- [ ] 🔴 빈 문서 첫 라인에서 `---` 입력 → 즉시 frontmatter 블록 + AddProperty 자동 포커스 + 본문에 dash 안 남음 (Enter 불필요)
- [ ] 🔴 빈 문서 중간 (헤딩/단락 뒤)에서 `---` 입력 + Enter → HR (수평선) 삽입 (frontmatter X)
- [ ] 🔴 frontmatter 이미 있는 문서에서 `---` 입력 + Enter → HR 삽입 (frontmatter 중복 X)
- [ ] 🔴 NotFoundError (DOMException) / hooks 경고 / render-time setState 경고 콘솔 미발생

### 20.5.2 제목 = 파일명 (ADR-029) 🆕

- [ ] 🔴 EditorTitleInput에 제목 입력 후 blur → 파일 트리에서 파일명 즉시 변경
- [ ] 🔴 Enter 키 → 입력 확정 + rename + blur
- [ ] 🔴 빈 제목 → 직전 값으로 revert (rename 호출 안 함)
- [ ] 🔴 금지 문자 (`/ \ : * ? " < > |`) 입력 → revert
- [ ] 🔴 같은 디렉터리에 동일 파일명 존재 → revert
- [ ] 🔴 외부 rename (Finder 등) → watcher가 EditorTitleInput에 즉시 반영
- [ ] 🔴 디바운스 미적용 확인: 타이핑 도중 파일 트리는 그대로, blur 시점에만 변경 (Obsidian 동작)

## 21. 사이드바 — 4 탭

- [ ] 🔴 파일 / 검색 / 목차 / 태그 탭 전환
- [ ] 🔴 Outline: 현재 파일 헤딩 목록, 클릭 → 스크롤
- [ ] 🔴 Outline: 현재 스크롤 위치의 헤딩이 보라색으로 강조 (IntersectionObserver)
- [ ] 🔴 Outline: Tab으로 패널 포커스 → ↑↓ 이동, Enter로 스크롤, Home/End 처음/끝, Esc 포커스 해제
- [ ] 🔴 Outline 하단 "백링크" 섹션: `[[현재파일]]` 참조 파일 + 스니펫
- [ ] 🔴 태그 탭: 전체 태그 + 카운트, 태그 클릭 → 파일 드릴다운
- [ ] 🔴 태그 패널: inline `#tag` + frontmatter `tags` 통합

## 22. 사이드바 — 최근 파일

- [ ] 🔴 파일 탭 상단 "최근" 섹션 (최대 5개)
- [ ] 🔴 LRU 갱신 (열 때마다 맨 위로)
- [ ] 🔴 vault 전환 시 분리된 히스토리

## 23. 사이드바 — 너비 리사이즈

- [ ] 🔴 사이드바와 에디터 사이 1px 핸들 드래그 → 너비 조정 (180-560)
- [ ] 🔴 hover 시 보라색 강조
- [ ] 🔴 localStorage persist

## 24. 테마

- [ ] 🔴 헤더 우측 테마 토글 버튼 — system → light → dark 순환
- [ ] 🔴 시스템 다크모드 따라가기 (system 모드)
- [ ] 🔴 새로고침 시 plash 없이 적용

## 25. 시스템 — 알림 / 에러

- [ ] 🔴 삭제 실패 alert (예: 권한 부족)
- [ ] 🔴 rename 실패 alert
- [ ] 🔴 충돌 다이얼로그 동작 (위 6번 항목)

## 25.4 에디터 — 각주 `[^id]`

- [ ] 🔴 본문 `[^1]` 입력 → 위첨자 `[1]` 인라인 노드로 표시
- [ ] 🔴 정의 `[^1]: 설명` (줄 시작) → 하단 정의 블록으로 표시 (좌측 accent bar)
- [ ] 🔴 참조 클릭 → 해당 정의로 부드럽게 스크롤
- [ ] 🔴 미정의 참조: 점선 테두리 (`munix-fn-ref-undefined`)
- [ ] 🔴 정의는 있지만 참조 없음: 흐리게 (`munix-fn-def-unused` opacity 0.55)
- [ ] 🔴 round-trip: 저장 시 `[^id]` / `[^id]: text` 형식 유지
- [ ] 🔴 코드 펜스 안 `[^1]`은 변환 X

## 25.5 에디터 — KaTeX 수식

- [ ] 🔴 인라인 수식 `$x^2 + y^2$` 입력 → KaTeX 렌더 (atom 노드)
- [ ] 🔴 인라인 수식 노드 선택 → input으로 raw `$...$` 편집 가능
- [ ] 🔴 블록 수식 (`$$\n\\int...\n$$`) 로딩 시 KaTeX 렌더
- [ ] 🔴 블록 수식 클릭 → textarea 편집, Cmd/Ctrl+Enter 또는 Esc로 종료
- [ ] 🔴 round-trip 보존: 저장 시 `$...$` / `$$...$$` 형식 유지
- [ ] 🔴 코드 펜스 / inline code 안의 `$...$`는 변환되지 않음 (보호됨)
- [ ] 🔴 Obsidian 호환: 같은 vault를 Obsidian으로 열어 수식이 동일하게 렌더되는지

## 26. Obsidian 호환성 (라운드트립)

- [ ] 🔴 같은 vault를 Obsidian으로 열어서 손실 없는지 확인
  - 헤딩, 단락, 목록, 표
  - frontmatter
  - `==text==` highlight
  - `[[wikilink]]`
  - `> [!NOTE]` callout (foldable 마커 포함)
  - 코드 블럭 (언어 포함)
  - 이미지 `![alt](assets/...)`

---

## 알려진 제약 (테스트 필요 X)

- 표 컬럼 너비 — GFM 한계로 저장 안 됨 (Obsidian과 동일)
- 남은 미체크 항목 — 자동화 전환 전까지의 테스트 부채로 취급
- macOS 휴지통 "되돌리기" 메뉴 — NSFileManager 방식의 일부 케이스 제한 (Phase 6 서명 빌드 시 Finder 방식 재검토)

## 발견 시 보고 양식

```markdown
### YYYY-MM-DD — [기능명] 요약

**카테고리:** [섹션 번호]
**증상:**
**재현:** 1. ... 2. ... 3. ...
**기대:**
**실제:**
**콘솔/로그:**
```

→ [issues-log.md](./issues-log.md)에 추가.

---

**문서 버전:** v1.3
**작성일:** 2026-04-25
**최근 업데이트:** 2026-05-02 — 백엔드/프론트 분리 전환 시작. 검색 인덱스, frontmatter 값 변환, Rust vault path/asset safety 자동화 추가.
