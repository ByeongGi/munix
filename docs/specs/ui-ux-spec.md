# UI/UX 경험 상세 설계 — Munix

> Munix 전체 제품 경험의 기준선. 체감 성능, 피드백, 정보 구조, 접근성, 밀도, 상태 표현을 기능별 스펙 위에 걸치는 횡단 원칙으로 정의한다.

---

## 1. 목적

Munix는 로컬 Markdown 파일을 다루는 생산성 앱이다. 사용자는 클라우드 서비스보다 더 빠르고 예측 가능한 반응, Obsidian과 비슷한 파일 신뢰성, Notion에 가까운 블록 편집 편의성을 기대한다.

이 문서의 목적은 다음을 명확히 하는 것이다.

- 사용자의 체감상 "빠르다", "멈췄다", "불안하다"를 가르는 시간 기준
- 파일 열기, 탭 전환, 검색, 저장, 장기 작업의 로딩/피드백 정책
- 데스크톱 노트앱에 맞는 화면 밀도, 정보 구조, 상태 표현 원칙
- 접근성, 키보드 조작, 모션, 오류/충돌 상태의 공통 UX 기준
- 구현 후 성능과 UX 품질을 검증할 수 있는 측정 항목

---

## 2. 조사 요약

### 2.1 반응 시간 기준

| 근거                        | Munix에 적용할 해석                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| NN/g의 0.1s / 1s / 10s 기준 | 100ms 이내는 직접 조작처럼 느껴진다. 1s를 넘으면 작업 흐름이 끊기기 시작한다. 10s를 넘는 작업은 진행률, 취소, 백그라운드 처리가 필요하다.         |
| web.dev RAIL                | 입력은 100ms 안에 시각 피드백을 주고, 이벤트 처리는 50ms 이하로 쪼갠다. 애니메이션/스크롤/드래그는 프레임당 10ms 목표, 16ms 한계를 기준으로 본다. |
| Core Web Vitals INP         | 사용자 조작에서 다음 paint까지 200ms 이하는 좋은 반응성의 상한으로 본다. Munix는 로컬 앱이므로 주요 조작은 이보다 더 엄격하게 100ms 목표를 둔다.  |
| Fluent Wait UX              | 1s 미만 대기는 인디케이터를 보이지 않는 편이 낫다. 1-3s는 spinner, 3s 초과는 progress bar 또는 명확한 진행 문구가 필요하다.                       |

### 2.2 접근성 기준

Munix UI는 웹뷰 기반 데스크톱 앱이므로 WCAG 2.2 AA를 기본 기준으로 삼는다.

- 일반 텍스트 대비: 최소 4.5:1
- 큰 텍스트 대비: 최소 3:1
- UI 컴포넌트/아이콘/상태 표시 대비: 최소 3:1
- 포인터 타깃: 최소 24 x 24 CSS px, 주요 도구 버튼은 32 x 32 px 이상 권장
- 포커스 표시: 최소 2 CSS px 외곽선 상당의 면적, focused/unfocused 상태 간 3:1 변화 권장
- 상태 메시지: 화면만 바꾸지 말고 보조기술이 감지 가능한 status/live region 제공
- 상호작용으로 발생한 모션은 `prefers-reduced-motion`에서 비활성화 또는 축소

---

## 3. UX 원칙

### 3.1 Local-first feels instant

로컬 파일 앱의 기본 기대치는 "내 컴퓨터 안의 파일을 조작한다"는 감각이다. 네트워크 제품처럼 긴 skeleton 화면을 기본값으로 쓰지 않는다.

- 입력, 선택, 탭 클릭, 사이드바 토글은 즉시 반응해야 한다.
- 실제 작업이 오래 걸리면 화면을 막지 말고 가장 가까운 위치에 상태를 표시한다.
- 오래 걸리는 검색, 인덱싱, 이미지 처리, export는 백그라운드화 가능한지 먼저 검토한다.

### 3.2 Content safety is visible

노트앱에서 UX의 핵심은 장식보다 "내 글이 안전한가"다.

- 저장 상태는 작고 일관되게 노출한다.
- 충돌, 외부 변경, 삭제, rename 실패는 조용히 삼키지 않는다.
- destructive action은 되돌릴 수 있거나 명확히 확인한다.

### 3.3 Keyboard-first, pointer-friendly

Munix의 주요 사용자는 반복 작업을 많이 한다. 키보드 플로우는 1급 경로로 설계한다.

- 파일 열기, 명령 실행, 검색, 탭 전환, 사이드바 이동은 키보드로 완결 가능해야 한다.
- 포인터 타깃은 조밀하지만 실수 클릭을 유발하지 않는 크기와 간격을 유지한다.
- 드래그 기능에는 키보드 또는 메뉴 기반 대체 경로를 둔다.

### 3.4 Keep context stable

문서 앱에서 가장 나쁜 지연은 "어디에 있었는지 잃는" 지연이다.

- 탭 전환, split 전환, Mermaid/이미지 async render 후에도 scroll/selection을 최대한 유지한다.
- 로딩 중에도 앱 shell과 현재 위치 단서는 유지한다.
- 전역 spinner보다 영역별 skeleton, inline status, status bar를 우선한다.

### 3.5 Quiet, dense, readable

Munix는 생산성 도구다. 화면은 마케팅 페이지가 아니라 반복 사용에 맞춘 작업면이어야 한다.

- 과한 hero, 장식성 card, gradient/orb 배경을 쓰지 않는다.
- 사이드바와 팔레트는 스캔하기 쉬운 밀도를 유지한다.
- 에디터 본문은 장시간 읽기/쓰기 편한 폭, 행간, 대비를 우선한다.

---

## 4. 요구사항

### 4.1 기능 요구사항

| ID    | 요구사항                                                                            | 우선순위 |
| ----- | ----------------------------------------------------------------------------------- | -------- |
| UX-01 | 앱 전체 조작을 시간 예산 기준으로 분류하고, 각 분류에 맞는 피드백 패턴을 적용       | P0       |
| UX-02 | 파일 열기/탭 전환/검색/저장 상태에 대한 일관된 loading, busy, done, error 상태 제공 | P0       |
| UX-03 | 모든 주요 명령은 command palette 또는 keymap으로 접근 가능                          | P0       |
| UX-04 | 저장/충돌/외부 변경 상태는 status bar와 관련 UI에서 즉시 인지 가능                  | P0       |
| UX-05 | sidebar, file tree, tab, palette, modal의 focus order와 keyboard loop 정의          | P0       |
| UX-06 | WCAG 2.2 AA 기준의 대비, 타깃 크기, focus visible, status message 기준 준수         | P0       |
| UX-07 | `prefers-reduced-motion` 및 앱 설정의 motion reduction 반영                         | P1       |
| UX-08 | dev mode에서 핵심 UX timing mark를 수집하고 regression 확인 가능                    | P1       |
| UX-09 | 200개 초과 file tree, 대형 vault, 대형 문서에 대한 progressive rendering 정책 적용  | P1       |
| UX-10 | 한국어/영어 텍스트 길이 차이, 200% zoom, 최소 900px 폭에서 텍스트 겹침 방지         | P0       |

### 4.2 비기능 요구사항

성능 목표는 지원 환경의 기준 장비에서 P75를 기본 판정값으로 삼고, P95는 regression 감지용으로 함께 기록한다. 기준 장비는 오픈 이슈로 남긴다.

| 작업                               |         이상적 목표 |              허용 상한 | 피드백 정책                                    |
| ---------------------------------- | ------------------: | ---------------------: | ---------------------------------------------- |
| 키 입력 echo, 커서 이동, selection |          16ms/frame |               50ms p95 | 별도 indicator 없음                            |
| 버튼 hover/active/focus 반영       |          16ms/frame |               50ms p95 | 즉시 visual state                              |
| 간단 명령 실행                     |               100ms |                  200ms | 버튼 active/pressed 상태만                     |
| 탭 전환 cache hit                  |               100ms |                  250ms | 이전 context 유지, spinner 금지                |
| 일반 파일 열기 `<100KB`            |               250ms |                  500ms | 300ms 초과 예상 시 editor skeleton             |
| 중형 파일 열기 `100KB-1MB`         |               500ms |                 1000ms | editor skeleton + status text                  |
| 대형 파일 열기 `1-10MB`            |              1000ms |                 3000ms | progressive render, read-only fallback 검토    |
| Quick Open 입력 후 결과 갱신       |               100ms |                  150ms | 결과 list 즉시 갱신                            |
| Full-text search 첫 결과           |               300ms |                 1000ms | streaming results, count는 지연 허용           |
| 저장 상태 dirty 표시               |               100ms |                  200ms | status bar에 즉시 표시                         |
| 자동 저장 완료                     | 750ms debounce + IO |                 3000ms | 1s 초과 시 saving 표시, 3s 초과 시 원인/재시도 |
| 장기 작업                          |         3000ms 초과 | 10000ms 초과 전 진행률 | progress/toast, 취소/백그라운드                |

---

## 5. 시간 예산과 피드백 정책

### 5.1 시간 구간

| 구간       | 사용자 체감                     | Munix 정책                                                    |
| ---------- | ------------------------------- | ------------------------------------------------------------- |
| 0-16ms     | 움직임이 부드럽다               | typing, cursor, drag, scroll은 이 구간을 목표로 한다.         |
| 16-100ms   | 즉시 반응으로 느낀다            | 대부분의 직접 조작은 이 안에 첫 visual feedback을 준다.       |
| 100-200ms  | 약간 느껴지지만 흐름은 유지된다 | 핵심 조작의 허용 상한. INP-like 지표의 good threshold로 본다. |
| 200-1000ms | 시스템이 일한다고 느낀다        | context를 유지하고 미세한 busy 상태를 제공할 수 있다.         |
| 1-3s       | 기다림이 명확해진다             | spinner 또는 skeleton을 보여준다. 같은 위치에 묶는다.         |
| 3-10s      | 작업 흐름이 끊긴다              | progress bar, 단계 문구, background option을 제공한다.        |
| 10s+       | 사용자가 다른 일로 전환한다     | 취소, 예상 시간, 완료 후 알림, 재개 가능성이 필요하다.        |

### 5.2 Loading indicator 선택

| 예상 시간 | 패턴                                       | 사용처                                        |
| --------- | ------------------------------------------ | --------------------------------------------- |
| `<1s`     | indicator 없음, 즉시 상태 변경             | 탭 전환 cache hit, sidebar toggle, formatting |
| `1-3s`    | inline spinner 또는 skeleton               | 중형 파일 open, search indexing 일부          |
| `>3s`     | progress bar 또는 staged status            | vault indexing, export, 대량 rename           |
| `>10s`    | cancellable progress toast/background task | 전체 vault rebuild, 큰 이미지 batch 처리      |

규칙:

- global blocking overlay는 destructive confirmation, modal workflow, 앱이 실제로 입력을 받을 수 없는 경우에만 사용한다.
- spinner는 같은 화면에 여러 개 띄우지 않는다. 가장 관련 있는 영역 하나에 묶는다.
- skeleton은 최종 레이아웃과 같은 크기를 예약해야 하며 content shift를 만들면 안 된다.
- 불확실한 작업은 "로딩 중"보다 구체적인 작업명(`검색 인덱스 갱신 중`, `이미지 썸네일 생성 중`)을 사용한다.
- UI 텍스트는 `t()`로 추출하고 namespace는 기능 영역을 따른다.

---

## 6. 화면 구조

### 6.1 App shell

```
┌──────────────────────────────────────────────────────────────┐
│ Title / Traffic controls / Optional command entry             │
├──────┬──────────────────────┬────────────────────────────────┤
│Vault │ Sidebar              │ Tab bar / Pane controls         │
│Dock  │ File tree/Search     ├────────────────────────────────┤
│      │                      │ Editor surface                  │
│      │                      │                                │
├──────┴──────────────────────┴────────────────────────────────┤
│ Status bar: vault, save, cursor, word count, background tasks  │
└──────────────────────────────────────────────────────────────┘
```

기본 치수:

| 영역                 |    기본값 | 제약                                  |
| -------------------- | --------: | ------------------------------------- |
| Vault Dock           |      48px | 40-56px                               |
| Sidebar              |     240px | 180-400px, settings와 연동            |
| Tab bar              |      36px | 최소 32px hit area                    |
| Status bar           |      24px | 텍스트 겹침 시 우선순위 기반 collapse |
| Editor content width | 720-860px | code/table/mermaid는 overflow 허용    |

### 6.2 정보 밀도

- Sidebar row: 28-32px. 아이콘 버튼 hit target은 최소 24px, 권장 28-32px.
- Palette row: 44-52px. 제목, 경로, shortcut을 한 행에서 스캔 가능하게 한다.
- Settings row: label + control + optional description. nested card 안에 card를 넣지 않는다.
- Modal: 작업 하나에 집중하며, destructive action은 우측 하단 또는 명확한 danger affordance를 사용한다.

### 6.3 Editor surface

- 기본 본문 폭은 긴 읽기에 맞춰 제한한다.
- code block, table, Mermaid, image는 본문 폭 밖으로 horizontal overflow 가능하다.
- selection, cursor, active block affordance는 theme token 기반으로 표시한다.
- Mermaid, image, embed처럼 async height가 있는 블록은 fallback reservation을 둔다.
- 빈 문서는 placeholder만 제공하고, 설명성 onboarding panel을 에디터 안에 넣지 않는다.

---

## 7. 핵심 UX 플로우

### 7.1 첫 실행

1. App shell을 먼저 표시한다.
2. 최근 vault가 없으면 vault 선택 empty state를 보여준다.
3. empty state는 간결한 제목, vault 열기 버튼, 최근 vault 목록만 포함한다.
4. 파일 시스템 권한, trust prompt, vault open 실패는 같은 흐름 안에서 해결 가능해야 한다.

성능 목표:

- window visible: 1s 이내
- vault selection UI interactive: 1.5s 이내
- 최근 vault 자동 복원 후 마지막 문서 표시: 2s 이내

### 7.2 Vault 열기

1. 사용자가 vault를 선택한다.
2. shell은 유지하고 sidebar 영역에 tree skeleton 또는 indexing 상태를 표시한다.
3. file tree는 top-level부터 점진적으로 표시한다.
4. indexing은 background task로 돌고, Quick Open은 가능한 범위부터 사용 가능하게 한다.

피드백:

- 1s 미만이면 indicator 없이 tree가 나타난다.
- 1s 이상이면 sidebar에 skeleton.
- 3s 이상이면 status bar에 `vault.indexing` task 표시.

### 7.3 파일 열기

1. 파일 row 또는 Quick Open에서 선택한다.
2. tab을 즉시 만들거나 active 상태로 표시한다.
3. cache hit이면 content를 즉시 복원한다.
4. cache miss이면 editor skeleton을 표시하고 read/parse 완료 후 교체한다.
5. 실패 시 tab은 error state로 남기고 retry, reveal, close action을 제공한다.

금지:

- 파일 read가 끝날 때까지 tab active 표시를 지연하지 않는다.
- 전체 앱을 loading overlay로 덮지 않는다.
- 큰 파일에서 main thread를 장시간 점유하지 않는다.

### 7.4 탭 전환

1. tab click/shortcut 즉시 active tab affordance를 변경한다.
2. runtime cache의 selection/scroll anchor를 복원한다.
3. Mermaid/image async reflow가 있으면 `ResizeObserver` 보정으로 scroll 위치를 재조정한다.
4. 복원 실패 시 문서 최상단이 아니라 가장 가까운 block anchor를 우선한다.

성능 목표:

- cache hit: 100ms 목표, 250ms 허용
- disk read fallback: 500ms 이내 일반 파일

### 7.5 편집과 저장

1. 입력은 editor local state에 먼저 반영한다.
2. dirty 상태는 100ms 이내 표시한다.
3. 자동 저장은 750ms debounce, blur 시 즉시 실행한다.
4. 저장 중에도 typing을 막지 않는다.
5. 저장 실패는 status bar + inline retry affordance로 표시한다.

상태:

| 상태     | 표시                                     |
| -------- | ---------------------------------------- |
| clean    | `saved` text/icon을 과하게 노출하지 않음 |
| dirty    | 작은 dot 또는 status text                |
| saving   | status bar에 짧은 progress text          |
| saved    | 1-2s 후 quiet 상태로 fade                |
| failed   | error color + retry                      |
| conflict | warning color + compare/overwrite 선택   |

### 7.6 Search / Command Palette

- `Mod+P`, `Mod+K`, `Mod+Shift+F`는 keyboard-first flow다.
- palette open은 100ms 이내 표시한다.
- 입력 후 결과 갱신은 150ms 이내가 목표다.
- full-text search는 첫 결과를 빨리 보여주고 count/facet은 나중에 보정한다.
- 검색 중에도 이전 결과를 지우지 않고 stale 표시 후 새 결과로 교체한다.

### 7.7 File tree

- expand/collapse는 100ms 이내 visual feedback.
- 200개 초과 visible node는 virtualization 적용.
- rename은 inline edit 우선. 실패하면 원래 이름으로 되돌리고 inline error를 표시한다.
- delete는 trash 사용이 기본이며, 영구 삭제는 명확한 confirmation 필요.

### 7.8 장기 작업

대상:

- vault 전체 indexing
- Tantivy index rebuild
- 대량 rename/delete
- 이미지 thumbnail batch 생성
- export/build/release 계열 작업

정책:

- 3s 초과 예상 시 progress task로 등록한다.
- 작업은 status bar와 toast 둘 중 하나에만 주 표시를 둔다.
- 가능하면 cancel/pause/retry를 제공한다.
- 완료 후 사용자가 하던 editor focus를 빼앗지 않는다.

---

## 8. 상태와 컴포넌트 패턴

### 8.1 공통 interactive state

모든 버튼, 메뉴 항목, tab, tree row, palette row는 다음 상태를 시각적으로 구분해야 한다.

```ts
type InteractiveState =
  | "default"
  | "hover"
  | "focus"
  | "active"
  | "selected"
  | "disabled"
  | "busy"
  | "danger";
```

상태 규칙:

- `hover`와 `selected`는 함께 표현 가능해야 한다.
- `focus`는 색상만으로 표현하지 않는다. outline 또는 offset ring을 사용한다.
- `disabled`는 대비를 낮추되, 설명이 필요한 경우 tooltip 또는 disabled reason을 제공한다.
- `busy`는 클릭 재진입을 막아야 하는 작업에만 사용한다.

### 8.2 Status message

```ts
interface UiStatusMessage {
  id: string;
  namespace: "common" | "vault" | "editor" | "search" | "settings" | "tabs";
  level: "info" | "success" | "warning" | "error";
  scope: "inline" | "status-bar" | "toast" | "modal";
  polite: boolean;
  messageKey: string;
  actionKey?: string;
  action?: () => void | Promise<void>;
  expiresAt?: number;
}
```

원칙:

- status message는 focus를 훔치지 않는다.
- 오류와 충돌처럼 사용자의 결정이 필요한 상태는 자동으로 사라지지 않는다.
- 저장 완료 같은 success는 짧게 표시 후 quiet 상태로 돌아간다.
- screen reader가 필요한 상태는 `role="status"` 또는 `aria-live="polite"`를 사용한다.

### 8.3 Empty state

empty state는 사용자가 다음 행동을 바로 할 수 있게 만드는 용도다.

- Vault 없음: vault open/create action.
- 검색 결과 없음: query 유지, scope/option 확인 action.
- 폴더 비어 있음: 새 노트/새 폴더 action.
- 에디터 파일 없음: 최근 파일 또는 Quick Open action.

금지:

- 장황한 제품 설명.
- 기능 소개 card 나열.
- 실제 작업으로 이어지지 않는 decorative illustration.

---

## 9. 접근성

### 9.1 Keyboard navigation

| 영역       | 키                                                                   |
| ---------- | -------------------------------------------------------------------- |
| Vault Dock | `Up/Down`, `Enter`, `Mod+1..9`                                       |
| File tree  | `Up/Down`, `Left/Right`, `Enter`, `F2`, `Delete`, typeahead          |
| Tab bar    | `Mod+Shift+[`, `Mod+Shift+]`, `Mod+W`, `Mod+Alt+Left/Right`          |
| Palette    | `Up/Down`, `Enter`, `Mod+Enter`, `Esc`                               |
| Dialog     | focus trap, `Esc`, primary action shortcut는 destructive action 제외 |
| Editor     | Tiptap keymap + app-level shortcut conflict 방지                     |

### 9.2 Focus

- focus ring은 theme token으로 구현한다.
- pointer click 후 focus 표시를 숨기는 경우에도 keyboard focus는 항상 보인다.
- modal open 시 첫 의미 있는 control 또는 heading으로 focus 이동.
- modal close 시 원래 trigger로 focus 복원.
- split pane과 inactive pane editor는 focus location이 명확해야 한다.

### 9.3 Contrast and target size

- 일반 텍스트는 4.5:1 이상.
- secondary text도 중요한 정보면 4.5:1 이상을 목표로 한다.
- placeholder, disabled text는 낮은 대비가 가능하지만 필수 정보로 쓰지 않는다.
- 아이콘 버튼은 visible icon 16-18px, hit area 28-32px 이상 권장.
- 메뉴 item과 tree row는 24px 미만으로 줄이지 않는다.

### 9.4 Motion

- 기본 motion duration은 120-180ms.
- editor typing, cursor, selection에는 decorative transition을 적용하지 않는다.
- `prefers-reduced-motion`이면 view transition, shimmer, non-essential transform animation을 제거한다.
- loading shimmer는 CPU 비용과 시각 피로를 고려해 긴 작업에서 무한 반복하지 않는다.

### 9.5 IME and language

- 한국어 IME composition 중에는 markdown shortcut, slash command, auto-pairing이 조합을 깨지 않아야 한다.
- 모든 신규 UI 텍스트는 `t()`를 사용한다.
- 영어/한국어 모두 버튼 내부 텍스트가 넘치지 않아야 한다.
- 날짜/시간/상대시간은 i18n locale과 system preference를 따른다.

---

## 10. Visual Design

### 10.1 Tone

Munix의 시각 톤은 "Onyx monochrome + restrained teal accent"다.

- 배경과 panel은 theme token을 사용한다.
- accent는 focus, selection, active, link, primary action에 제한적으로 쓴다.
- warning/error/success는 semantic token으로 분리한다.
- 색만으로 상태를 전달하지 않는다.

### 10.2 Typography

| 용도          | 기본                                     |
| ------------- | ---------------------------------------- |
| UI sans       | Pretendard/system sans                   |
| Code          | JetBrains Mono/system mono               |
| Editor body   | 16px, line-height 1.65-1.8               |
| Sidebar       | 13-14px, line-height fixed by row height |
| Palette title | 14px medium                              |
| Status bar    | 12px                                     |

규칙:

- viewport width에 따라 font-size를 직접 scale하지 않는다.
- letter spacing은 기본 0으로 둔다.
- editor heading은 문서 구조를 표현하고, panel/card 내부 heading은 과도하게 키우지 않는다.

### 10.3 Layout stability

- tab, toolbar, icon button, status bar item은 stable width/height를 둔다.
- save status text처럼 길이가 변하는 요소는 reserved width 또는 priority collapse를 사용한다.
- Mermaid/image async rendering은 layout jump를 최소화한다.
- sidebar resize 중 editor layout은 debounce 없이 따라오되 expensive recalculation은 idle/chunk 처리한다.

---

## 11. 데이터 모델 / 측정 API

### 11.1 Operation budget

```ts
type UxOperationKind =
  | "typing"
  | "selection"
  | "command"
  | "tab-switch"
  | "file-open"
  | "quick-open"
  | "full-text-search"
  | "save"
  | "vault-index"
  | "image-process";

interface UxTimingBudget {
  kind: UxOperationKind;
  idealMs: number;
  acceptableMs: number;
  feedbackAfterMs: number;
  progressAfterMs?: number;
  cancellableAfterMs?: number;
}
```

### 11.2 Performance event

```ts
interface UxPerformanceEvent {
  id: string;
  kind: UxOperationKind;
  startedAt: number;
  firstFeedbackAt?: number;
  interactiveAt?: number;
  completedAt?: number;
  success: boolean;
  fileSizeBytes?: number;
  vaultFileCount?: number;
  cacheHit?: boolean;
  devOnly: true;
}
```

정책:

- 기본 telemetry는 꺼져 있다.
- dev mode에서 `performance.mark` / `performance.measure`를 사용한다.
- 사용자의 파일 경로, 파일명, 문서 내용은 metric에 포함하지 않는다.
- regression threshold는 CI 또는 Playwright smoke에서 별도 fixture로 검증한다.

### 11.3 Feedback policy

```ts
interface FeedbackPolicy {
  noIndicatorBeforeMs: 1000;
  spinnerFromMs: 1000;
  progressFromMs: 3000;
  cancellableFromMs: 10000;
}
```

구현은 숫자를 흩뿌리지 말고 공통 상수로 관리한다.

---

## 12. 구현 가이드

### 12.1 Main thread

- 사용자 입력 event handler는 50ms 이하로 유지한다.
- 대량 parsing, indexing, search scoring은 chunking 또는 worker/Rust backend로 이동한다.
- React state 변경은 editor subtree remount를 유발하지 않게 좁힌다.
- derived state는 렌더 시 계산하고 불필요한 `useEffect` 동기화를 피한다.

### 12.2 Rendering

- animation은 `transform`, `opacity` 중심으로 제한한다.
- layout/paint 비용이 큰 width/height/top/left transition은 피한다.
- virtual list는 row height를 안정적으로 유지한다.
- palette/search result는 결과가 바뀌어도 input focus를 유지한다.

### 12.3 Error UX

- 사용자가 한 행동과 가장 가까운 위치에 error를 표시한다.
- recoverable error는 retry action을 포함한다.
- destructive failure는 실제 파일 상태를 확인할 수 있는 action을 제공한다.
- technical detail은 disclosure로 숨기고, 기본 문구는 사용자가 할 수 있는 행동 중심으로 작성한다.

---

## 13. 테스트 케이스

### 13.1 UX timing

| ID     | 시나리오                             | 기대                                                    |
| ------ | ------------------------------------ | ------------------------------------------------------- |
| UX-T01 | 10KB 문서에서 연속 타이핑            | dropped frame 없이 입력 echo 유지                       |
| UX-T02 | 100KB 문서 열기                      | 500ms 이내 content 표시 또는 skeleton 후 1s 이내 안정화 |
| UX-T03 | cache hit 탭 전환                    | 250ms 이내 content/selection/scroll 복원                |
| UX-T04 | Quick Open에서 3글자 입력            | 각 입력 후 150ms 이내 결과 갱신                         |
| UX-T05 | 10,000 파일 vault에서 file tree 표시 | shell block 없이 top-level부터 점진 렌더                |
| UX-T06 | 자동 저장 중 계속 입력               | typing block 없음, dirty/saving 상태 정확               |
| UX-T07 | full-text search index rebuild       | UI 사용 가능, status/progress 표시                      |

### 13.2 Accessibility

| ID     | 시나리오                                                | 기대                                   |
| ------ | ------------------------------------------------------- | -------------------------------------- |
| UX-A01 | keyboard only로 vault open -> file open -> edit -> save | 포인터 없이 완료                       |
| UX-A02 | 200% zoom                                               | 주요 텍스트와 버튼이 겹치지 않음       |
| UX-A03 | dark/light theme contrast audit                         | text 4.5:1, UI state 3:1 이상          |
| UX-A04 | reduced motion 활성화                                   | shimmer/view transition 제거 또는 축소 |
| UX-A05 | screen reader status 확인                               | 저장 실패/search 완료가 status로 전달  |
| UX-A06 | 한국어 IME 조합 중 slash/markdown shortcut              | 조합이 깨지지 않음                     |

### 13.3 Visual regression

- 최소 폭 900px.
- 1280 x 800 기본 데스크톱.
- 1440 x 900 split pane.
- 1920 x 1080 large workspace.
- light/dark/system theme.
- sidebar 180px, 240px, 400px.

---

## 14. 엣지 케이스

- 느린 HDD, 외장 드라이브, 네트워크 마운트 vault.
- 10MB에 가까운 Markdown 파일.
- Mermaid/image가 많은 문서에서 async layout shift.
- 같은 파일이 여러 탭/pane에 열린 상태의 dirty/conflict.
- 파일 rename/delete가 외부 앱에서 동시에 발생.
- indexing 중 앱 종료.
- disabled command가 왜 비활성인지 설명이 필요한 경우.
- command palette가 modal 위에서 열리는 중첩 focus 문제.
- 한글/영문 혼합 경로가 sidebar 폭을 넘는 경우.
- 긴 파일명/긴 vault 이름/status text가 status bar를 밀어내는 경우.

---

## 15. 오픈 이슈

1. 기준 장비와 fixture 정의: macOS Apple Silicon 기준인지, Windows/Linux 저사양 기준을 별도로 둘지 결정 필요.
2. dev-only UX metric dashboard 위치: DevTools console, hidden settings panel, 또는 자체 debug overlay 중 선택.
3. 대형 문서 UX: 1MB 초과 문서를 완전 편집 가능하게 둘지, read-only fallback/문서 분할 안내를 둘지 결정 필요.
4. `prefers-reduced-motion` 외에 앱 내부 motion setting을 노출할지 결정 필요.
5. status bar 정보 우선순위: vault, save, cursor, word count, indexing task가 동시에 있을 때 collapse 규칙 세부화 필요.

---

## 16. 참고 자료

- [NN/g — Response Times: The 3 Important Limits](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [NN/g — Website Response Times](https://www.nngroup.com/articles/website-response-times/)
- [web.dev — Measure performance with the RAIL model](https://web.dev/articles/rail)
- [web.dev — Interaction to Next Paint](https://web.dev/articles/inp)
- [Fluent 2 — Wait UX](https://fluent2.microsoft.design/wait-ux)
- [Apple Human Interface Guidelines — Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)
- [WCAG 2.2 — W3C Recommendation](https://www.w3.org/TR/WCAG22/)
- [WCAG 2.2 Understanding — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [WCAG 2.2 Understanding — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG 2.2 Understanding — Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)

---

## 17. 버전

- **문서 버전:** v0.1
- **작성일:** 2026-05-02
- **상태:** proposed
