# Workspace Split 상세 설계 — Munix

> Obsidian-style multi-pane workspace. 탭을 여러 패널(pane)에 배치하고, 드래그 앤 드롭으로 좌/우/상/하 분할을 생성하는 에디터 레이아웃.

> **2026-04-26 갱신:** [ADR-031](../decisions.md#adr-031-멀티-vault-워크스페이스-cmux-스타일-좌측-세로-탭) (멀티 vault 워크스페이스) 채택에 따라 split 트리는 **vault 1개의 워크스페이스 안에서만** 유효. vault 경계를 넘는 split·DnD는 금지된다. 결합 정의는 [multi-vault-spec.md §6.6](./multi-vault-spec.md). DnD payload(§6.1)는 `vaultId` 필드 추가 필요.

> **2026-04-26 방향 확정:** [multi-vault-spec.md §17.1](./multi-vault-spec.md#171-phase-d--탭--새-창-승격-멀티-윈도우) 의 Phase D (OS 멀티 윈도우) 가 **앱 컨셉 불일치로 폐기**되면서, 멀티 문서 비교/참조 욕구는 본 spec 으로 일원화. 채택 (proposed → accepted, 다음 큰 작업).

---

## 1. 목적

현재 Munix는 전역 단일 탭 바와 단일 에디터 영역을 사용한다. 문서 비교, 참조 문서 고정, 작성/검색 병행 작업에는 한계가 있다.

Workspace Split은 다음을 목표로 한다.

- 여러 문서를 동시에 열어 비교/참조 가능
- 각 패널이 독립적인 탭 목록과 active tab을 가짐
- 탭을 드래그해 다른 패널로 이동하거나 새 분할 생성
- Obsidian과 유사한 작업 공간 경험 제공

---

## 2. 요구사항

| ID     | 요구사항                                                        | 우선순위 |
| ------ | --------------------------------------------------------------- | -------- |
| WSP-01 | 패널별 독립 탭 목록                                             | P0       |
| WSP-02 | 좌/우 분할 생성                                                 | P0       |
| WSP-03 | 상/하 분할 생성                                                 | P1       |
| WSP-04 | 패널 사이 divider 드래그 리사이즈                               | P1       |
| WSP-05 | 같은 패널 내 탭 재정렬                                          | P0       |
| WSP-06 | 다른 패널로 탭 이동                                             | P0       |
| WSP-07 | 탭을 패널 edge에 드롭해 새 분할 생성                            | P1       |
| WSP-08 | 빈 패널 자동 제거 또는 placeholder 표시                         | P1       |
| WSP-09 | workspace layout 저장/복원                                      | P1       |
| WSP-10 | 명령 팔레트에서 "오른쪽으로 분할", "아래로 분할" 실행           | P1       |
| WSP-11 | 열린 파일이 없는 pane은 기본 "새 탭"과 empty action page를 표시 | P0       |

---

## 3. 비범위

초기 구현에서는 다음을 제외한다.

- 같은 파일을 여러 패널에서 동시에 편집할 때 selection/scroll 동기화
- 패널별 독립 undo history 보장
- 패널별 독립 편집 표면
- floating window 또는 별도 OS 창
- 모바일 레이아웃

---

## 4. 데이터 모델

단순 배열보다 split tree를 사용한다. 2x2 이상 중첩 분할과 리사이즈 비율 저장에 유리하다.

```ts
type SplitDirection = "row" | "column";

interface WorkspaceState {
  root: WorkspaceNode;
  activePaneId: string;
  version: 1;
}

type WorkspaceNode = SplitNode | PaneNode;

interface SplitNode {
  type: "split";
  id: string;
  direction: SplitDirection;
  ratio: number; // first child 비율, 0.2~0.8 clamp
  first: WorkspaceNode;
  second: WorkspaceNode;
}

interface PaneNode {
  type: "pane";
  id: string;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
}

interface WorkspaceTab {
  id: string;
  path: string;
  title: string;
  dirty: boolean;
  pinned?: boolean;
}
```

### 기존 store 마이그레이션

현재 `tab-store.ts`는 전역 `tabs` + `activeId` 구조다. Workspace 도입 시 `workspace-store.ts`를 새로 만들고, 기존 API는 점진적으로 compatibility wrapper로 유지한다.

```ts
openTab(path, targetPaneId = activePaneId)
closeTab(tabId, paneId = activePaneId)
moveTab(source, target)
splitPane(paneId, direction, placement, initialTab?)
```

---

## 5. UI 구조

```
┌──────────────────────────────────────────────┐
│ Header                                       │
├──────────────┬───────────────────────────────┤
│ Sidebar      │ WorkspaceRoot                 │
│              │ ┌─────────────┬─────────────┐ │
│              │ │ Pane A      │ Pane B      │ │
│              │ │ TabBar      │ TabBar      │ │
│              │ │ EditorView  │ EditorView  │ │
│              │ └─────────────┴─────────────┘ │
└──────────────┴───────────────────────────────┘
```

각 `Pane`는 다음을 가진다.

- 상단 tab bar
- close / split / more 메뉴
- active editor
- 빈 상태 placeholder
- drop overlay

### 5.1 기본 새 탭 / Empty Pane

Vault가 열렸더라도 첫 번째 파일을 자동으로 강제 오픈하지 않는다. 열린 파일이 없는 pane은 Obsidian의 "새 탭"처럼 기본 탭 UI와 중앙 action page를 표시한다.

새 파일 생성 시 파일명은 `Untitled.md`, `Untitled 2.md`처럼 유지하되, 본문에는 자동 제목을 넣지 않고 빈 Markdown 파일로 생성한다.

기본 표시 조건:

- vault는 열려 있음
- pane의 `tabs.length === 0`
- 또는 pane의 `activeTabId === null`

UI:

```text
┌ 새 탭  ×  + ───────────────────────┐
│                                      │
│        새 파일 생성하기 (Mod+T)       │
│        파일로 이동하기 (Mod+P)        │
│        닫기                          │
│                                      │
└──────────────────────────────────────┘
```

동작:

- `새 파일 생성하기`: 현재 vault root 또는 현재 pane context에 새 파일 생성 후 active tab으로 열기
- `파일로 이동하기`: Quick Open 열기
- `닫기`: 현재 empty tab/pane 닫기. 단일 pane만 남은 경우에는 no-op 또는 앱 기본 empty 상태 유지
- `+`: 새 파일 생성 액션

정책:

- 앱 시작 시 마지막 vault가 복원되어도 첫 파일을 자동으로 열지 않는다.
- 최근 파일 자동 오픈은 사용자 설정이 생기기 전까지 도입하지 않는다.
- Split workspace 도입 후 모든 pane은 같은 empty pane 정책을 공유한다.

**구현 (Split-0 결정, 2026-04-26):**

- 컴포넌트: `<EmptyPanePlaceholder>` (신규). 기존 `<VaultPicker>` 와는 별개 — vault picker 는 vault 자체가 없을 때, empty pane 은 vault 는 있고 pane 만 비었을 때
- i18n namespace: `app` (`app:emptyPane.newFile`, `app:emptyPane.quickOpen`, `app:emptyPane.close`). 초기 문서의 `palette` 재사용 결정은 폐기.
- "닫기" 동작: 단일 pane 마지막 1개일 때는 클릭해도 store/editor 상태를 빈 상태로 유지한다. UI 버튼을 disabled 로 만들지는 않는다. vault-picker 화면으로 fallback 안 됨

---

## 6. 드래그 앤 드롭

### 6.1 탭 드래그 payload

```ts
interface DragTabPayload {
  type: "munix/tab";
  vaultId: VaultId; // ADR-031: vault 경계 검증용
  tabId: string;
  fromPaneId: string;
  path: string;
}
```

**구현 방식 (Split-0 결정, 2026-04-26):** HTML5 native DnD (`dataTransfer`, `setData`, `effectAllowed`). 기존 [file-tree-inner.tsx](../../munix/src/components/file-tree/file-tree-inner.tsx) 와 일관. MIME 은 분리:

- file-tree DnD: `application/munix-path` (기존 `DND_MIME`)
- 탭 DnD: `application/munix-tab` (신규)

**Vault 경계 검증 (ADR-031):** drop 핸들러는 payload의 `vaultId`가 target pane이 속한 active vault와 일치하는지 검증. 다르면 drop 거부. ~~탭→창 승격~~ 은 폐기되었으므로 (multi-vault-spec §17.1), 다른 vault 파일은 vault 탭 전환으로만 접근.

### 6.2 Drop zone

패널 영역을 5개 zone으로 나눈다.

| Zone   | 동작                            |
| ------ | ------------------------------- |
| center | 해당 pane의 탭 목록 끝으로 이동 |
| left   | 대상 pane 왼쪽에 새 pane 생성   |
| right  | 대상 pane 오른쪽에 새 pane 생성 |
| top    | 대상 pane 위쪽에 새 pane 생성   |
| bottom | 대상 pane 아래쪽에 새 pane 생성 |

기본 임계값:

- edge zone: pane 너비/높이의 25%
- center zone: 나머지 중앙 영역
- 최소 pane 크기: 260px x 180px

### 6.3 Drop overlay

드래그 중 대상 pane 위에 반투명 overlay를 표시한다.

- center: 전체 pane highlight
- left/right/top/bottom: 해당 edge 영역 highlight
- drop 불가 상태: overlay 표시 안 함

---

## 7. 분할 생성 규칙

`splitPane(targetPaneId, zone, tab)`은 기존 tree를 재작성한다.

| Zone   | Split direction | New pane placement |
| ------ | --------------- | ------------------ |
| left   | row             | first              |
| right  | row             | second             |
| top    | column          | first              |
| bottom | column          | second             |

기존 target pane은 반대쪽 child가 된다. 새 split ratio 기본값은 `0.5`.

이미 같은 방향 split의 child인 경우에는 tree depth를 불필요하게 늘리지 않도록 부모 split에 sibling 삽입하는 최적화를 검토한다. 초기 구현은 단순 nested split으로 충분하다.

---

## 8. 리사이즈

SplitNode 사이에 divider를 렌더링한다.

- row: 세로 divider, horizontal drag
- column: 가로 divider, vertical drag
- ratio는 `0.2~0.8`로 clamp
- pane 최소 크기를 침범하면 drag 제한
- drag 중 텍스트 selection 비활성화

---

## 9. 탭 동작

### 9.1 같은 pane 안

- 탭 드래그로 순서 변경
- active tab 유지
- 닫기/다른 탭 닫기/오른쪽 탭 닫기/모두 닫기 컨텍스트 메뉴 유지

### 9.2 다른 pane으로 이동

- source pane에서 탭 제거
- target pane에 탭 삽입
- target pane의 active tab으로 설정
- source pane이 비면 placeholder 표시

### 9.3 빈 pane

초기 정책:

- 단일 root pane이 비면 기본 "새 탭" empty page를 유지
- 여러 pane 중 사용자가 pane 닫기를 실행한 경우: 해당 pane 제거
- 탭 이동으로 비워진 경우: placeholder 유지
- 앱 재시작 저장 시 빈 pane은 저장하지 않음. 단, 모든 pane이 비어 있으면 단일 empty pane으로 복원

---

## 10. 명령 팔레트

추가 명령 (Split-0 결정, 2026-04-26 — [keymap-registry.ts](../../munix/src/lib/keymap-registry.ts) 와 충돌 없음 확인):

| Command ID                | 설명                           | 기본 단축키          | scope  | editable |
| ------------------------- | ------------------------------ | -------------------- | ------ | -------- |
| `workspace.splitRight`    | 현재 탭을 오른쪽으로 분할      | `mod+\`              | global | true     |
| `workspace.splitDown`     | 현재 탭을 아래로 분할          | `mod+shift+\`        | global | true     |
| `workspace.moveTabRight`  | 현재 탭을 오른쪽 pane으로 이동 | `mod+alt+arrowright` | global | true     |
| `workspace.moveTabLeft`   | 현재 탭을 왼쪽 pane으로 이동   | `mod+alt+arrowleft`  | global | true     |
| `workspace.closePane`     | 현재 pane 닫기                 | `mod+alt+shift+w`    | global | true     |
| `workspace.focusNextPane` | 다음 pane 으로 포커스 이동     | 미정 (P1)            | global | true     |

group: `workspace` 신규. i18n: `settings:shortcuts.groups.workspace` + `settings:shortcuts.commands.workspace.<id>.description`.

~~`Mod+\` 사이드바 토글 충돌~~ — 검사 결과 `mod+\` 는 현재 어디에도 등록되지 않음. 사이드바 토글 단축키 자체가 없음 (vault dock 토글은 `mod+alt+b`). 안전.

---

## 11. 저장/복원

저장 위치 (2026-04-26 갱신, ADR-031 정합):

- `<vault>/.munix/workspace.json` — vault 별 영구화. [workspace-registry.ts](../../munix/src/store/workspace-registry.ts) 의 기존 인프라 재사용 (debounce 500ms, attach/detach persist)
- 앱 전역 `app_config_dir()/workspace.json` 은 미사용

저장 대상:

- split tree (workspaceTree)
- pane tabs path 목록
- active pane (activePaneId)
- active tab (각 PaneNode 의 activeTabId)
- split ratio

### 11.1 v1 → v2 마이그레이션 (Split-0 결정, 2026-04-26)

기존 [workspace-registry.ts:127](../../munix/src/store/workspace-registry.ts:127) `SerializedWorkspace` v1:

```ts
interface SerializedWorkspaceV1 {
  version: 1;
  tabs: Tab[];
  activeId: string | null;
  fileTreeExpanded: string[];
}
```

v2 스키마 (workspace split 도입 후):

```ts
interface SerializedWorkspaceV2 {
  version: 2;
  workspaceTree: WorkspaceNode | null; // null = 단일 pane (legacy 호환)
  activePaneId: string | null;
  tabs: Tab[]; // 단일 pane 일 때의 root tabs (호환)
  activeId: string | null; // root pane active tab (호환)
  fileTreeExpanded: string[];
}
```

마이그레이션 정책:

- `version === 1` 읽으면 `workspaceTree = null`, `activePaneId = null` 로 hydrate (= 단일 pane). UI 가 단일 pane 으로 렌더링되어 기존과 동일 동작
- 다음 저장부터 자동으로 v2 형식
- v2 에서 `workspaceTree === null` 이면 여전히 단일 pane mode — split 명령이 처음 실행될 때 비로소 SplitNode 가 생성되며 tree 가 채워짐
- subscribe 조건에 `workspaceTree`, `activePaneId` 추가

저장하지 않는 것:

- selection
- undo stack
- transient search highlight
- scroll position (P2에서 검토)

---

## 12. 에디터 인스턴스 정책

초기 구현은 pane마다 active tab 하나의 `EditorView`만 렌더링한다.

- 비활성 tab은 에디터 인스턴스를 유지하지 않음
- pane별 active tab 전환 시 현재 단일 에디터 로딩/저장 흐름 재사용
- 같은 파일이 여러 pane에 열리는 것은 허용하되, 동시 편집 충돌은 기존 mtime 충돌 감지에 의존

장기적으로는 pane별 editor store slice가 필요하다.

```ts
interface PaneEditorState {
  paneId: string;
  currentPath: string | null;
  pendingSearchQuery: string | null;
  scrollTop?: number;
}
```

---

## 13. 단계별 구현 계획

### Phase A — 수동 분할 ✅ 완료 (2026-04-26)

신규 store 파일 별도 생성하지 않고 **기존 `workspace-registry.ts` 의 store 에 슬라이스 추가**. 기존 TabSlice 와 호환 유지 (`tabs/activeId` 는 단일 pane 일 때 root pane 의 mirror).

- [x] A.1: `workspace-types.ts` 에 `WorkspaceNode/SplitNode/PaneNode` 타입 + `workspaceTree`, `activePaneId` 필드 + tree 헬퍼 (`collectPanes`, `findPane`, `patchPaneInTree`)
- [x] A.2: `slices/workspace-tree-slice.ts` 신규 — `splitPane(targetPaneId, zone, initialTab?)`, `closePane(paneId)`, derived `getActivePane()`, `setActivePane(id)`
- [x] A.3: `workspace-registry.ts` v1→v2 마이그레이션 (§11.1) + persist subscribe 에 `workspaceTree`, `activePaneId` 추가
- [x] A.4: `<WorkspaceRoot>`, `<Pane>`, `<SplitDivider>`, `<EmptyPanePlaceholder>` 컴포넌트 (`src/components/workspace/`)
- [x] A.5: 기존 `<TabBar>` + 에디터 영역을 `<Pane>` 안으로 이동. `workspaceTree === null` 이면 children 그대로 패스-스루 (단일 pane 회귀 없음)
- [x] A.6: keymap-registry 에 `workspace.splitRight/splitDown/closePane/moveTabRight/moveTabLeft` 추가 + 명령 팔레트 항목 + i18n 키 (`workspace` group, ko/en `palette` + `settings`)
- [x] A.7: 검증 — `pnpm tsc --noEmit` pass, `cargo check` pass, vitest 67/67 pass, dev 단일 pane 회귀 없음 확인 + split → unsplit 동작

DnD 는 Phase B/C 로 미룸. Phase A 는 명령 팔레트 + 단축키 트리거만으로 split.

커밋: `e239815` (A.1+A.2) / `11a7d0c` (A.3) / `178f3e5` (A.4+A.5) / `3a8fbb4` (A.6+A.7).

### Phase B — 탭 이동 ✅ 완료 (2026-04-26)

Phase A 의 단순화 결정 (active pane = children 슬롯 1개) 위에 mirror 정책 + cross-pane DnD 구현.

- [x] B.1: **Active pane mirror 정책** — tree 모드에서 글로벌 `tabs/activeId` 가 항상 active pane 의 PaneNode 와 동기. swap 시 (1) 글로벌 → 현재 active pane capture, (2) 새 active pane → 글로벌, (3) editor.openFile/closeFile. `applyActivePaneSwap` / `captureGlobalIntoActivePane` 헬퍼. splitPane / closePane / setActivePane 모두 적용. `movePaneTab` / `reorderPaneTab` 신규 액션.
- [x] B.2: **비활성 pane mini TabBar** — Pane 컴포넌트가 비활성 모드에서 paneNode.tabs 를 가로 나열, active tab 강조, X 버튼. `activatePaneTab(paneId, tabId)` / `closePaneTab(paneId, tabId)` 액션 (mirror 정책 포함). i18n `app:pane.activatePrompt / pane.empty`.
- [x] B.3: **Cross-pane center drop** — `src/lib/dnd-mime.ts` 에 spec MIME `application/munix-tab` + `DragTabPayload` (vaultId/tabId/fromPaneId/path). TabBar dragstart 가 spec MIME 풀 payload 를 setData. Pane outer div 가 drop target — `fromPaneId !== this.id` 면 `movePaneTab` 으로 끝에 추가, vault 경계 검증, hover 시 accent outline. 같은 pane 안 reorder 는 기존 인덱스 DnD 가 처리.
- [x] B.4: 검증 — tsc 0 errors, vitest 67/67, eslint 신규 파일 0 issue.

커밋: `1f274d4` (B.1) / `41b0b28` (B.2) / `8f863ba` (B.3+B.4).

**Phase B 진행 결과 알게 된 정책**:

- 같은 pane 안 탭 재정렬 (인덱스 reorder, hover indicator) 는 active pane 만 — 비활성 pane 의 mini TabBar 안 reorder 는 Phase C/D polish 로 미룸
- Pane outer drop 시 center 영역 (탭 목록 끝 추가) 만 처리 — edge drop 으로 split 생성은 Phase C
- `movePaneTab` 은 dest 으로 active 옮기는 Obsidian UX 채택 (사용자가 끌어 놓은 곳에 즉시 시선 이동)

### Phase C — Edge Drop Split ✅ 완료 (2026-04-26)

- [x] C.1: `classifyZone(rect, x, y)` — pane outer DOMRect 기준 mouse 위치를 center / left / right / top / bottom 5 zone 으로 분류. 임계값 25% edge / 50%+ center (§6.2)
- [x] C.2: `data-no-edge-drop` sentinel — TabBar (`tab-bar.tsx` 글로벌, `pane.tsx` mini) 위에서는 항상 center 강제. TabBar 자체 reorder 와 충돌 방지
- [x] C.3: `splitPaneMove(sourcePaneId, tabId, targetPaneId, zone)` 슬라이스 액션 — capture 글로벌→active pane → source 에서 tab 제거 → fresh pane 생성 → target 자리에 SplitNode 삽입 → fresh pane 으로 active swap
- [x] C.4: Drop overlay — zone 별 시각화. center=full inset, edge=50% half overlay (반투명 accent + 2px border). overlay 는 absolute 자식, pointer-events-none. dragleave 시 relatedTarget 이 outer 안이면 무시 (자식 이동 false-positive 방지)
- [x] C.5: 비활성 pane mini TabBar reorder DnD polish (B.2 deferred) — hover index/side, 좌우 indicator, `reorderPaneTab` 디스패치. 같은 mini TabBar 안 reorder 만 처리 (다른 pane 페이로드는 outer drop 에 위임)
- [x] C.6: 검증 — `pnpm tsc --noEmit` pass, vitest 67/67 pass, eslint 0 issue

**Phase C 결정 사항**:

- splitPane vs splitPaneMove 분리 — 단축키(`mod+\`)는 활성 탭 _복제_ (id 재발급, 기존 splitPane), edge drop 은 _이동_ (tab 객체 그대로 transfer, splitPaneMove 신규)
- source pane 이 edge drop 후 비더라도 자동 closePane 하지 않음 — 사용자가 명시적으로 닫도록 (movePaneTab 과 일관)
- source === target edge drop 도 허용 — 현재 pane 을 split 하고 fresh pane 으로 탭 이동 (Obsidian 과 동일 UX)
- 같은 pane 안 mini TabBar reorder 는 mini-tab onDrop 이 처리 → outer drop 에 propagation 하지 않음 (`stopPropagation`)

### Phase D — 저장/복원 polish ✅ 완료 (2026-04-26)

§11.1 의 v2 스키마 적용은 Phase A.3 에서 끝남. Phase D 는 polish + tree-aware cleanup:

- [x] D.1: `setSplitRatio(splitId, ratio)` 슬라이스 액션 + `patchSplitRatio` 헬퍼 — clamp [0.2, 0.8]. persist subscribe (workspaceTree 변경) 가 자동 debounce 500ms 저장
- [x] D.2: SplitDivider drag 리사이즈 — onMouseDown 에서 부모 flex 컨테이너 rect 캡처 → mousemove 마다 비율 계산 → setSplitRatio 디스패치. 9px hit area + body cursor/userSelect 잠금
- [x] D.3: `removeFromAllPanes(path)` 슬라이스 액션 — 모든 pane walk + 자기/하위 경로 제거 + active pane mirror 갱신 + 모든 pane 빈 상태 시 tree collapse → 단일 empty 모드 (closeFile 호출)
- [x] D.4: `updatePathInAllPanes(oldPath, newPath)` 슬라이스 액션 — 모든 pane 의 자기/하위 경로 path/title rename + active pane mirror 갱신 (editor 재오픈 안 함)
- [x] D.5: `tab-slice.removeByPath` / `updatePath` 가 tree 모드일 때 자동으로 D.3/D.4 호출 — 호출 측 (use-vault-watcher, app.tsx rename) 변경 없이 동작
- [x] D.6: `workspace-tree-slice.test.ts` 11 케이스 — splitPane, splitPaneMove, setSplitRatio, removeFromAllPanes (자기/하위/all-empty collapse), updatePathInAllPanes (자기/하위), closePane collapse
- [x] D.7: 검증 — tsc 0 errors, vitest 78/78 (기존 67 + 신규 11), eslint 0 issue (변경 파일 한정)

**Phase D 결정 사항**:

- `applyActivePaneSwap` 대신 직접 `set({...})` — removeFromAllPanes / updatePathInAllPanes 는 editor 재오픈 (`openFile`) 없이 mirror 만 갱신해야 함. 외부 watcher 가 이미 editor reload 를 별도 처리
- collapse 정책: 모든 pane 의 tabs 가 비면 tree=null + tabs=[] + activeId=null + closeFile. 일부 pane 만 비면 그대로 유지 (사용자가 명시적으로 closePane 호출하도록)
- ratio clamp 는 액션 내부 — divider 컴포넌트는 raw 값 그대로 보냄

---

## 14. 테스트 케이스

- 단일 pane에서 기존 탭 열기/닫기/전환이 동일하게 동작
- 현재 탭을 오른쪽으로 분할하면 좌우 pane이 생기고 같은 파일이 우측 active tab으로 열림
- 아래로 분할하면 상하 pane이 생김
- divider drag 후 ratio가 저장되고 reload 후 복원
- 탭을 다른 pane center에 drop하면 이동만 되고 새 split은 생기지 않음
- 탭을 right edge에 drop하면 새 우측 pane 생성
- 마지막 탭 닫기 후 placeholder 표시
- 외부 파일 삭제 watcher가 모든 pane의 해당 tab을 제거
- rename 시 모든 pane의 tab path가 갱신

---

## 15. 오픈 이슈

해결된 것 (Split-0, 2026-04-26):

- ~~3. `Mod+\` 단축키 충돌~~ → 검사 결과 미사용 슬롯, splitRight 으로 사용 (§10)
- ~~4. workspace 저장 위치~~ → vault별 `.munix/workspace.json` 채택 (§11)
- ~~5. 탭 DnD 방식~~ → HTML5 native DnD + MIME 분리 (§6.1)

여전히 오픈 (Phase B+ 진입 시 결정):

1. 같은 파일을 두 pane에서 동시에 편집할 때 한쪽 저장 후 다른 쪽 dirty 상태 처리.
2. pane별 editor-store 분리 시 auto-save debounce와 conflict dialog ownership.

---

## 16. 상태

- 상태: **accepted + Phase A~D 완료, Phase E (UX/UI) 진행** (2026-04-26)
- 작성일: 2026-04-26
- accepted 일: 2026-04-26
- 구현 목표: v1.1
- 채택 사유: ADR-031 Phase D (OS 멀티 윈도우) 폐기 — Munix 의 단일 창 컨셉에 맞춰 멀티 문서 비교/참조 욕구를 한 창 안 split 으로 일원화. Vault Dock (멀티 vault) + Workspace Split (멀티 문서) 조합으로 Obsidian 패턴 정합
- 진행 현황 (2026-04-26):
  - ✅ Phase A — 수동 분할 (4 commits, e239815 ~ 3a8fbb4)
  - ✅ Phase B — 탭 이동 (3 commits, 1f274d4 ~ 8f863ba)
  - ✅ Phase C — Edge Drop Split (1 commit, `d4b8bc4`)
  - ✅ Phase D — Persist polish + tree-aware cleanup (1 commit, `a8a588d`)
  - ✅ Phase E — Pane equality + Obsidian UX (§17 정책 일괄 채택, 2026-04-26 작업분)

---

## 17. UX 정책 — Obsidian 패턴 채택 표 (Phase E)

> 사용자 검토 후 코드 진행. 각 정책은 Obsidian 1.x 의 동작을 기준으로 비교하고 Munix 채택 여부 + 결정 사유를 명시한다.

### 17.0 Obsidian 1.x 기준 용어/근거

Obsidian 공식 문서의 사용자-facing 용어는 `pane` 보다 `tab group` 에 가깝다. Munix 내부 타입명은 `PaneNode`/`pane` 으로 유지하되, UX 설명에서는 필요할 때 `pane(tab group)` 병기를 허용한다.

근거:

- [Obsidian Help: Workspace](https://obsidian.md/help/workspace): 중앙 main area 의 tab group 은 좌우/상하 split 가능
- [Obsidian Help: Tabs](https://obsidian.md/help/tabs): 모든 tab 은 tab group 에 속하며, 같은 group 안 재정렬 / 다른 group 이동 / 새 group 생성 가능
- [Obsidian Help: Drag and drop](https://obsidian.md/help/drag-and-drop): tab drag 로 main area 및 sidebar tab group 정렬과 split 가능
- [Obsidian Help: Pop-out windows](https://help.obsidian.md/pop-out-windows): 새 window/pop-out 은 같은 vault window 에 종속. Munix 는 OS window 분리를 non-goal 로 유지

2차 조사 메모:

- Obsidian 은 `tab group` 을 사용자 모델로 삼는다. Munix 구현명은 `PaneNode` 이지만 UX 문서와 테스트 시나리오에서는 `pane(tab group)` 으로 해석한다.
- Obsidian parity 의 핵심은 “모든 tab group 의 TabBar 조작 동등성”이다. Munix v1.1 은 모든 pane 에 파일명 입력, 속성 입력폼, 편집 가능한 본문 표면을 제공하되, pane별 독립 undo/search ownership 은 v1.2+ polish 로 둔다.
- Obsidian 의 active pane 표시가 약하다는 사용자 피드백이 있으므로, Munix 는 active pane indication 을 의도적으로 조금 더 명확히 한다.

### 17.1 Pane 동등성 (Pane Equality)

| 항목               | Obsidian 동작                                      | Munix 현재                               | Munix 결정                                                                                                                                            |
| ------------------ | -------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| TabBar             | 모든 tab group 자체 풀 TabBar (탭 + `+` + 메뉴)    | active=풀 / inactive=mini (탭만 가로)    | **채택**: 모든 pane 풀 TabBar                                                                                                                         |
| `+` (새 탭) 버튼   | 모든 pane 우측 끝에 항상 노출                      | active 만 (TabBar 컴포넌트)              | **채택**: 모든 pane 노출                                                                                                                              |
| 빈 액션 페이지     | 모든 빈 pane 가운데 ("새 파일 / 파일 이동 / 닫기") | active 만 (`EmptyEditorPane` in app.tsx) | **채택**: `EmptyPanePlaceholder` 모든 pane 에 노출                                                                                                    |
| 에디터 콘텐츠 영역 | 모든 tab group 은 독립 콘텐츠 영역처럼 동작        | active 만 (단일 EditorView)              | **채택**: 활성 pane = 풀 에디터, 비활성 pane = title/properties/editable body surface. 비활성 pane 도 미리보기가 아니라 수정 모드 상태로 유지 |

**Rationale**: 옵시디언 호환 UX + 발견성. 사용자가 pane 이 비활성이라는 이유만으로 열린 탭의 파일명/속성/본문이 preview 로 바뀌면 편집 연속성이 깨진다. 따라서 Phase E 는 "pane 조작 동등성"과 "비활성 pane editable surface" 를 채택한다. 단 같은 파일 두 pane 동시 편집은 `expectedModified` 충돌 감지로 보호하고, pane별 독립 undo/search ownership 은 v1.2+ 에서 정교화한다.

### 17.2 새 탭 (Placeholder Tab) UX

| 항목                | Obsidian                                                   | Munix                                                                           |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `+` 버튼 클릭       | 그 pane 에 path 없는 placeholder 탭 추가 + activate        | **채택**: `createPaneTab(paneId, "")` 액션, path=""                             |
| placeholder 탭 라벨 | "새 탭" / "New tab"                                        | **채택**: `tabs:emptyTab.title` 재사용 ("새 탭" / "New tab")                    |
| placeholder 탭 본문 | 빈 액션 페이지 (`EmptyPanePlaceholder`)                    | **채택**                                                                        |
| 사용자 액션 후      | "새 파일" 누르면 placeholder 탭이 그 파일로 변환 (id 유지) | **채택**: createPaneTab 으로 만든 tab 이 새 파일로 promote (id 유지, path 갱신) |
| `⌘N` (Munix Mod+T)  | 활성 pane 에 placeholder 탭 추가                           | **채택**: 기존 `tabs:tooltip.newTab` 단축키 동작에 통합                         |

Obsidian modifier 참고:

- `Cmd/Ctrl+T`: active tab group 에 새 tab
- `Cmd/Ctrl+Click`: 링크를 새 tab 으로 열기
- `Cmd/Ctrl+Alt+Click`: 링크를 새 tab group 으로 열기
- `Cmd/Ctrl+Alt+Shift+Click`: 링크를 새 window 로 열기

Munix v1.1 적용:

- `Mod+T`: active pane 에 placeholder tab 생성
- `Mod+Click` 링크 열기: P1 — active pane 에 새 tab 생성
- `Mod+Alt+Click` 링크 열기: P2 — 현재 pane 우측에 새 pane 생성 후 열기
- `Mod+Alt+Shift+Click`: OS window non-goal 이므로 미지원

### 17.3 마지막 탭 / Pane 자동 정리

| 시나리오                             | Obsidian                                     | Munix                                                           |
| ------------------------------------ | -------------------------------------------- | --------------------------------------------------------------- |
| pane 의 마지막 탭 X 클릭             | tree 에 다른 pane 있으면 → pane 자동 close   | **채택**                                                        |
| 다중 pane 에서 특정 pane 의 모든 탭 닫기 | 해당 tab group close                         | **채택**: `closeAllPaneTabs` / active `closeAll` 은 해당 pane 을 prune |
| 마지막 1개 pane 의 마지막 탭 X       | pane 유지, 빈 액션 페이지 노출               | **채택** (`pruneEmptyPanes` 가 마지막 pane 보존)                |
| 마지막 1개 pane 에서 모든 탭 닫기    | pane 유지, 기본 새 탭 화면 노출              | **채택**: store tabs 는 비우고 TabBar 가 기본 "새 탭" 슬롯을 렌더 |
| 탭 cross-pane 이동 후 source 빈 pane | source pane 자동 close                       | **채택**: `movePaneTab` / `splitPaneMove` 에 prune              |
| 외부 파일 삭제로 pane 빈 상태        | source pane 자동 close (마지막 pane 만 보존) | **채택**: `removeFromAllPanes` 에 prune                         |
| 모든 pane 빈 상태                    | tree=null 단일 모드로 collapse               | **이미 채택** (Phase D, `removeFromAllPanes` 의 all-empty 분기) |

**구현**: `pruneEmptyPanes(tree): WorkspaceNode | null` 헬퍼 — 빈 pane 을 제거하되 마지막 1개 pane 은 보존. `closePaneTab`, `closeAllPaneTabs`, active pane 의 `closeAll`, `movePaneTab`, `splitPaneMove`, `removeFromAllPanes` 모두 mutation 후 호출.

Obsidian 참고:

- split view 를 닫는 기본 사용법은 해당 split 의 tab/note 를 닫는 방식에 가깝다.
- `Ctrl/Cmd+W` 는 close current tab UX 로 통용된다.
- Munix 는 앱 빈 상태와 vault picker 가 분리되어 있으므로, 마지막 단일 pane 은 닫지 않고 empty tab/action page 를 유지한다.

### 17.4 Active Pane 시각 강조

| 항목               | Obsidian                       | Munix                                                                                                                |
| ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 강조 방식          | 매우 미묘 (커뮤니티 약점 평가) | **개선 채택**: active pane 의 active tab 하단에 2px accent border. 비활성 pane 은 opacity 0.92 로 과하게 낮추지 않음 |
| 비활성 pane TabBar | 동일 풀 (강조 없음)            | **채택**: TabBar 자체는 동등, active tab indicator 만 차이                                                           |

주의: Obsidian 의 active pane 표시가 약하다는 사용자 피드백이 있으므로, Munix 는 Obsidian 보다 명확한 active pane indication 을 의도적으로 채택한다.

### 17.4.1 TabBar 시인성 / 탭 크기

Obsidian/Chrome 처럼 탭은 최소 폭을 가진 고정 슬롯처럼 보이되, 탭 수가 늘어나면 같은 비율로 줄어드는 형태를 채택한다.

정책:

- active pane 과 inactive pane 모두 같은 탭 슬롯 규칙을 사용한다.
- 탭은 상단에 붙은 rounded-top 형태다. active tab 은 배경과 하단 indicator 로 구분하고, inactive tab 은 같은 높이를 유지하되 배경 대비를 낮춘다.
- 탭 title 은 한 줄 ellipsis 로 처리한다. close 버튼은 항상 shrink 되지 않는다.
- `+` 버튼과 pane menu 버튼은 탭 목록 오른쪽에 고정된 control group 으로 둔다. 탭이 많아져도 controls 는 밀려 사라지지 않는다.
- 탭이 너무 많아져 최소 폭 이하로 줄 수 없으면 horizontal overflow 를 허용한다.
- empty/placeholder tab 도 같은 슬롯 규칙을 쓴다. placeholder 라벨은 `tabs:emptyTab.title` 이다.

### 17.5 탭 우클릭 컨텍스트 메뉴

| 항목                                                      | Obsidian             | Munix                                                                     |
| --------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| Split right                                               | 있음                 | **채택**: `tabs:contextMenu.splitRight` (단축키 `Mod+\`)                  |
| Split down                                                | 있음                 | **채택**: `tabs:contextMenu.splitDown` (`Mod+Shift+\`)                    |
| Close / Close others / Close all to the right / Close all | 있음                 | **채택**: 탭 컨텍스트 메뉴 1차 그룹                                       |
| Pin tab                                                   | 있음                 | **채택**: `Tab.pinned` 저장 + 메뉴 pin/unpin + bulk close 보존             |
| Copy link to tab                                          | 있음                 | **채택**: vault 상대 path 기반 wikilink `[[path/to/file]]` 복사            |
| Move to new window                                        | 있음                 | **표시만 채택**: Munix 는 OS window non-goal 이므로 disabled               |

라벨 형식: Obsidian 한국어 UI에 맞춰 `닫기`, `다른 탭들 닫기`, `뒤 탭들 닫기`, `모두 닫기`, `고정`/`고정 해제`, `탭으로 링크...`, `새 창으로 이동`을 사용한다. `새 창으로 이동`은 Phase E 기준 disabled 로 표시한다.

Phase E 메뉴 순서:

- `닫기`
- `다른 탭들 닫기`
- `뒤 탭들 닫기`
- `모두 닫기`
- separator
- `고정` / `고정 해제`
- `탭으로 링크...`
- separator
- `새 창으로 이동` (disabled)
- separator
- `경로 복사`, `상대 경로 복사`, `파일 트리에서 보기`, `Finder 에서 보기` (파일 path 가 있을 때만)
- `우측 분할`, `하단 분할` (Munix 보조 항목)

### 17.5.1 Pane `...` 클릭 메뉴

우클릭 메뉴와 단축키만으로는 split 기능의 발견성이 낮다. Obsidian 처럼 각 pane(tab group) 우상단에 항상 보이는 `...` 버튼을 두고, 최소 split 명령을 직접 노출한다.

1차 메뉴 항목:

- `우측 분할` / `Split right`
- `하단 분할` / `Split down`
- separator
- `패널 닫기` / `Close pane`

정책:

- active pane 과 inactive pane 모두 같은 위치와 같은 라벨의 `...` 메뉴를 가진다.
- `...` 메뉴 클릭은 pane 본문 활성화 클릭과 충돌하지 않는다.
- inactive pane 의 `...` 메뉴에서 split 을 실행하면 해당 inactive pane 을 기준으로 분할한다.
- split 대상 tab 은 해당 pane 의 active tab 이다. active tab 이 없으면 빈 pane 을 새로 만든다.
- 메뉴는 드래그 분할 UX를 대체하지 않는다. 사용자는 탭을 잡고 pane 좌/우/상/하 edge 로 드래그해서도 분할할 수 있어야 한다.

Phase E 메뉴 최소 세트:

- `Split right`
- `Split down`
- separator
- 기존 close 계열 유지: `Close tab`, `Close other tabs`, `Close tabs to the right`, `Close all tabs`

Phase E 이후 후보:

- `Reveal in file tree`
- `Copy path` / `Reveal in Finder`
- `Copy relative path`
- `Pin/Unpin`

2차 개선 결정:

- `Split right/down` 은 Phase E 필수. 탭을 분할할 때는 원본 탭을 닫지 않고 새 pane 에 동일 파일 탭을 복제한다.
- close 계열은 반드시 pane-local 로 동작한다. 비활성 pane 탭의 컨텍스트 메뉴에서 close 를 실행해도 현재 active pane 의 탭이 닫히면 안 된다.
- 탭 우클릭은 pane activation 보다 우선한다. 비활성 pane 탭에서 오른쪽 마우스 버튼을 누를 때는 pane 을 먼저 활성화하지 않고, 해당 탭 기준 context menu 를 바로 표시한다. 좌클릭만 `activatePaneTab` 을 실행한다.
- pinned tab 은 `close others`, `close tabs to the right`, `close all` 같은 bulk close 에서 보존한다. 사용자가 X 또는 `닫기`를 직접 실행한 경우에는 pinned tab 도 닫을 수 있다.
- `탭으로 링크...` 는 `.md` 확장자를 제거한 vault 상대 path 를 wikilink 로 복사한다. 예: `docs/a.md` → `[[docs/a]]`.
- `파일 트리에서 보기` 는 sidebar 를 files tab 으로 열고 parent folder 를 expand 한 뒤 해당 path 를 선택/스크롤한다.
- `Close tabs to the right` 는 UI 방향성 의존 용어이므로 내부 액션과 i18n key 는 의미명 `closeTabsAfter` 를 사용한다.

### 17.6 SplitDivider 시각

| 항목             | Obsidian                   | Munix                                           |
| ---------------- | -------------------------- | ----------------------------------------------- |
| 두께             | 1-2px 시각, 4-6px hit area | **채택**: 1px 시각, 9px hit area (Phase D 완료) |
| Hover 색         | accent                     | **이미 채택** (Phase D)                         |
| 드래그 중 cursor | col-resize / row-resize    | **이미 채택** (Phase D)                         |

### 17.7 Edge Drop Overlay

Obsidian 공식 문서는 tab drag 중 drop zone highlight 를 명시하지만, 4-edge 임계값까지는 공개 스펙으로 문서화하지 않는다. Munix 는 Obsidian-inspired 정책으로 5-zone overlay 를 명시한다.

| 항목             | Obsidian                         | Munix                                                                                  |
| ---------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| Edge zone 크기   | 25-30%                           | **이미 채택**: 25% (Phase C `classifyZone`)                                            |
| Center zone 처리 | 탭 이동 (끝에 추가)              | **이미 채택**: `movePaneTab`                                                           |
| Overlay 색       | rgba accent ~20% + dashed border | **개선 채택**: 단색 fill `rgba(--accent, 0.22)` + 1.5px solid border (현재 0.15 + 2px) |
| Drop label       | 없음/미약                        | **개선 채택**: drop 결과를 라벨로 표시 (`탭 이동`, `좌/우/상/하 분할`)                 |

Drop zones:

- `center`: 대상 pane 에 tab 이동 또는 끝에 삽입
- `left/right/top/bottom`: 대상 pane 의 해당 edge 방향에 새 pane 생성
- 단일 pane 모드(`workspaceTree === null`)에서도 editor/content 영역은 같은 edge drop target 이다. 탭을 edge 로 드롭하면 split tree 로 promotion 되고, dragged tab 은 새 pane 으로 이동한다.
- TabBar 위에서는 tab reorder/append 의도가 우선이므로 edge split 을 억제
- drop 불가(vaultId 불일치 등)는 overlay 를 표시하지 않음
- overlay 중앙에는 예상 결과 라벨을 표시한다. 사용자가 좌우/상하 분할을 즉시 구분할 수 있어야 한다.
- editor/content 영역 위의 tab drag 는 pane root 또는 single-pane drop target 의 capture 단계에서 먼저 가로챈다. center/edge 여부와 무관하게 Tiptap editor 의 hover, 이미지/파일 drop handler 가 탭 분할 drag 에 반응하면 안 된다.

2차 개선 결정:

- 공식 Obsidian 문서가 drop zone highlight 자체는 명시하지만 edge 임계값은 공개하지 않으므로, Munix 의 `25% edge / center` 정책은 Obsidian 복제가 아니라 Obsidian-inspired implementation detail 로 둔다.
- `center` drop 은 “대상 pane 끝에 추가 + 대상 pane 활성화”를 기본값으로 한다.
- `edge` drop 은 source tab 을 이동한다. split tree 안에서 source pane 이 비면 `pruneEmptyPanes` 로 정리한다.
- 단일 pane 의 마지막 tab 을 edge drop 으로 이동할 때는 source pane 을 빈 pane 으로 남겨 split 결과를 유지한다. 이후 사용자가 닫기 액션을 실행하면 일반 pane 정리 정책을 따른다.
- TabBar 위 drag 는 reorder/append 의도이므로 split overlay 를 띄우지 않는다.

### 17.8 단축키

| 명령            | Obsidian                                             | Munix 현재                                                                                                                              |
| --------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Split right     | `Ctrl+\`                                             | **이미 채택** `Mod+\`                                                                                                                   |
| Split down      | `Ctrl+Shift+\`                                       | **이미 채택** `Mod+Shift+\`                                                                                                             |
| Close pane      | `Ctrl+W` (탭 닫기와 같음 — 마지막 탭이면 pane close) | **변형 채택**: `Mod+Alt+Shift+W` (전용). `Mod+W` 는 활성 탭 닫기 그대로 — 17.3 정책에 의해 마지막 탭이면 pane 도 자동 close (동일 결과) |
| Focus next pane | `Ctrl+Tab` (Obsidian 은 별도)                        | **부분 채택**: 명령 팔레트 `workspace.focusNextPane` (단축키 P1 보류)                                                                   |

### 17.9 비활성 Pane 마우스 인터랙션

| 액션         | Obsidian                           | Munix                             |
| ------------ | ---------------------------------- | --------------------------------- |
| 빈 영역 클릭 | 그 pane 활성화                     | **이미 채택** (`onPaneMouseDown`) |
| 탭 클릭      | 그 pane 활성화 + 그 탭으로 active  | **이미 채택** (`activatePaneTab`) |
| `+` 클릭     | 그 pane 에 placeholder 탭 추가     | **신규 채택**: `createPaneTab`    |
| 탭 우클릭    | 컨텍스트 메뉴 (그 pane 의 탭 대상) | **신규 채택**: 17.5 메뉴          |

추가 정책:

- 비활성 pane 의 TabBar 조작은 active pane 과 동일하게 허용한다.
- active 여부와 무관하게 모든 pane 의 탭 목록은 항상 보여야 한다. active pane 만 TabBar 를 보여주고 inactive pane 은 감추는 UX는 금지한다.
- 비활성 pane 의 content 는 미리보기로 전환하지 않고 editable editor surface 로 유지한다.
- 비활성 pane 에 열린 파일이 있으면 파일명 입력, 속성 입력폼, 수정 가능한 본문 표면을 보여준다. 파일이 없거나 placeholder tab 이면 empty action page 를 보여준다.
- 비활성 pane editor 는 pane activation 과 무관하게 자체 로드/자동저장 루프를 갖는다. 파일명 변경은 저장 대기분을 flush 한 뒤 `rename_entry` 로 처리하고 모든 pane 의 tab path/title 을 갱신한다. 속성/본문 저장은 `write_file(expectedModified)` 로 충돌을 감지하고, 충돌 시 해당 pane 에 충돌 상태를 표시한다.
- 비활성 pane 의 tab close, tab reorder, context menu 는 pane activation 없이도 대상 pane 기준으로 실행 가능해야 한다. 탭 `mousedown`은 좌클릭만 pane activation 으로 처리하고, 우클릭은 context menu 가 열릴 때까지 DOM swap 이 일어나지 않아야 한다. 단, 실행 후 active pane 이 사라지면 `pruneEmptyPanes` 이후 가장 가까운 sibling pane 을 active 로 지정한다.

### 17.10 Non-goals (v1.1)

옵시디언에 있지만 v1.1 에 채택하지 않는 것 — v1.2+ 검토:

- 같은 파일 두 pane 동시 편집의 자동 병합 (§15-1, §15-2)
- pane별 독립 undo history
- pane별 독립 검색 highlight
- pane별 full editor chrome ownership (pane-local bubble/table/search menus)
- floating pane / OS 별도 창 (이미 폐기 — multi-vault-spec §17.1)
- 탭 그룹 색상 / pin 전용 영역 / pinned 탭 compact layout

### 17.11 2차 UX 개선 백로그

조사 결과를 바탕으로 Phase E 이후 별도 작업으로 분리할 항목이다. v1.1 에서 전부 구현하지 않는다.

| 항목                          | Obsidian 근거                  | Munix 결정                                                                                       | 우선순위 |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ | -------- |
| 링크 `Mod+Click` 새 탭 열기   | Tabs modifier 정책             | active pane 에 새 파일 탭 생성. placeholder promote 와 같은 open path 유틸 재사용                | P1       |
| 링크 `Mod+Alt+Click` 새 pane  | Tabs modifier 정책             | 현재 pane 오른쪽에 새 pane 생성 후 링크 대상 열기. OS window modifier 는 미지원                  | P1       |
| inactive pane context menu    | 모든 tab group 조작 동등성     | 비활성 pane 도 우클릭 메뉴 표시. close/split 모두 대상 pane 기준으로 실행                        | P1       |
| active pane focus indication  | 커뮤니티 active pane 약점 지적 | 2px active tab indicator 는 유지. 필요 시 pane root focus ring/token border 를 후속 검토         | P2       |
| reveal/copy path context menu | 실사용 탭 메뉴 패턴            | `Reveal in file tree`, `Copy path`, `Copy relative path` 구현 완료. `Reveal in Finder` 도 유지    | 완료     |
| pin tab polish                | Obsidian 탭 메뉴               | 기본 pin/unpin 은 구현. pinned 탭 축소 폭, reorder 제약, pin 전용 영역은 후속 polish                            | P3       |
| inactive pane editable editor | 독립 tab group 콘텐츠 영역     | 구현 완료. 비활성 pane 도 preview 가 아니라 파일명/속성/본문 editable surface 로 표시           | 완료     |
| pop-out window                | Pop-out windows 공식 문서      | Munix 단일 창 컨셉과 충돌. multi-vault-spec §17.1 결정대로 non-goal 유지                         | 제외     |

2차 수동 검증 시나리오:

- active pane 과 inactive pane 모두에서 `+` 가 해당 pane 에 placeholder tab 을 만든다.
- placeholder tab 에서 새 파일을 만들면 tab id 를 유지한 채 path/title 만 promote 된다.
- 비활성 pane 의 탭 클릭은 pane 활성화와 tab 활성화를 동시에 수행한다.
- 비활성 pane 의 빈 content 클릭은 pane 활성화만 수행한다.
- 비활성 pane 의 탭 close/reorder/context menu 는 현재 active pane 을 오염시키지 않는다.
- 마지막 탭 close 후 pane 이 하나만 남으면 split tree 는 단일 pane 모드로 collapse 된다.
- split tree 에서 source pane 을 비우는 center/edge drop 은 `pruneEmptyPanes` 이후 active pane 이 안정적으로 유지된다. 단일 pane 마지막 tab edge drop 은 split 결과 유지를 위해 source empty pane 을 남긴다.

---

## 18. Phase E — 구현 단계 (UX 정책 적용)

### Phase E.1 — Pane 컴포넌트 풀 TabBar 리팩터링

- [x] `createPaneTab(paneId, path?)` 슬라이스 액션 — placeholder 탭 추가 + activate. 활성 pane 이면 글로벌 mirror.
- [x] `pruneEmptyPanes(tree)` 헬퍼 + `closePaneTab` / `closeAllPaneTabs` / active pane `closeAll` / `movePaneTab` / `splitPaneMove` / `removeFromAllPanes` 모두 적용.
- [x] Pane 컴포넌트 inactive 분기 리팩터링:
  - 풀 TabBar 렌더링 (탭 + X + `+` 버튼). `+` → `createPaneTab(pane.id, "")`.
  - 본문: tabs.length === 0 또는 active tab path === "" → `<EmptyPanePlaceholder>`. 그 외 → editable editor surface.
  - 우클릭 컨텍스트 메뉴 (17.5).
- [x] pane root 에 capture phase drag handler 적용 — tab drag/drop 이 Tiptap editor 의 파일/image drop handler 로 전달되지 않도록 차단.

### Phase E.2 — 활성 pane TabBar 와의 동등화

- [x] `tab-bar.tsx` 의 우클릭 메뉴에 splitRight / splitDown 항목 추가 (17.5).
- [x] 탭 우클릭 메뉴를 Obsidian 순서로 정리: close 그룹, pin/unpin 그룹, disabled link/window 그룹, 파일 path 그룹, Munix split 보조 그룹.
- [x] 탭 우클릭 메뉴의 `고정` / `고정 해제` 구현. `Tab.pinned` 는 workspace persist 에 포함된다.
- [x] bulk close (`다른 탭들 닫기`, `뒤 탭들 닫기`, `모두 닫기`) 는 pinned tab 을 보존한다. 직접 `닫기`는 pinned tab 도 닫는다.
- [x] 활성 pane 의 빈 상태 (`EmptyEditorPane` in app.tsx) → `<EmptyPanePlaceholder>` 로 통일 (정의 중복 제거).
- [x] active pane 의 active tab 하단에 2px accent border (현재 있음, 비활성 pane 은 indicator 안 그리기).
- [x] active/inactive pane 모두 pane `...` 메뉴 제공 — `우측 분할`, `하단 분할`, `패널 닫기`.
- [x] TabBar 탭 슬롯을 Obsidian/Chrome 스타일로 조정 — 최소 폭, 균등 shrink, 우측 controls 고정.

### Phase E.3 — 빈 placeholder 탭 → 새 파일 promote

- [x] `EmptyPanePlaceholder.onNewFile` 핸들러: 현재 활성 pane 의 placeholder 탭 (path === "") 이 있으면 새 파일 생성 후 그 탭을 promote (id 유지, path/title 갱신). 없으면 `openTab` 으로 새 탭.
- [x] 동일 정책으로 `onQuickOpen` (Quick Open dialog 후 선택된 파일로 promote).
- [x] 새 파일 생성 본문 정책 변경 — `Untitled.md` 파일명은 유지하되 기본 본문은 빈 문자열로 생성한다. 자동 `# 새 문서` 제목을 삽입하지 않는다.
- [x] 마지막 단일 pane 에서 빈 탭까지 닫으려 하면 pane 은 유지하고 기본 "새 탭" 슬롯 + empty action page 를 계속 보여준다.

### Phase E.4 — i18n 키 추가

- [x] `tabs:contextMenu.splitRight` / `splitDown` (ko/en)
- [x] `tabs:paneMenu.*` / `tabs:dropZone.*` (ko/en)
- [x] `app:pane.loadingEditor` / `editorError` / `editorConflict` (비활성 pane editor 상태)
- [x] 기존 `app:pane.empty` 는 placeholder 탭 본문이 EmptyPanePlaceholder 로 대체되므로 deprecate

### Phase E.5 — Edge drop overlay 시각 개선 (17.7)

- [x] overlay opacity 0.15 → 0.22, border 2px → 1.5px solid
- [x] edge/center drop 결과 라벨 표시 — `탭 이동`, `좌측 분할`, `우측 분할`, `상단 분할`, `하단 분할`.
- [x] TabBar 내부 drag 는 reorder/append 로 우선 처리하고 edge split overlay 를 억제.
- [x] 단일 pane 모드에서도 tab drag edge drop 으로 split tree promotion 지원.

### Phase E.6 — 검증

- [x] 단위 테스트: createPaneTab / pruneEmptyPanes 분기 / placeholder promote
- [ ] 수동: 옵시디언 호환 시나리오 (스크린샷 케이스) — 사용자가 로컬에서 직접 확인
- [x] `pnpm exec tsc --noEmit`
- [x] `pnpm vitest run`
- [x] `pnpm exec eslint .` — 기존 Fast Refresh warning 만 잔존

### Phase E.7 — Obsidian parity 수동 검증

- [ ] 각 pane 의 `+` 버튼으로 해당 pane 에 empty tab 생성
- [ ] inactive pane tab click → pane 활성화 + tab 활성화
- [ ] inactive pane `+` click → 해당 pane 에 placeholder tab 생성
- [ ] tab right click → 대상 pane 기준 context menu 실행
- [ ] inactive pane tab right click → pane 선활성화 없이 context menu 표시
- [ ] tab context menu `고정` / `고정 해제` → active/inactive pane 모두 pinned 상태 토글
- [ ] tab context menu `탭으로 링크...`, `경로 복사`, `상대 경로 복사`, `파일 트리에서 보기`, `Finder 에서 보기` 동작
- [ ] 마지막 tab close: 다중 pane 이면 pane 제거, 단일 pane 이면 empty action page 유지
- [ ] 모든 tab close: 다중 pane 이면 해당 pane 제거, 단일 pane 이면 기본 "새 탭" 슬롯 유지
- [ ] bulk close 실행 시 pinned tab 은 보존되고 직접 close 시에는 pinned tab 도 닫힘
- [ ] tab drag center drop → 대상 pane 에 이동
- [ ] tab drag edge drop → 새 split 생성
- [ ] 단일 pane 상태에서 tab drag edge drop → overlay 표시 + split 생성
- [ ] split tree 에서 source pane 이 비면 prune 되고 active pane 이 안정적으로 재지정. 단일 pane 마지막 tab edge drop 은 source empty pane 유지
- [ ] drag 중 editor 본문 hover/drop 이 editor 자체 상태나 image/file drop 로직에 영향을 주지 않음
- [ ] 탭이 여러 개일 때 Obsidian/Chrome 처럼 일정 폭 슬롯으로 보이고, 탭 수 증가 시 균등하게 줄어듦

### Phase E.8 — 2차 UX 개선 작업 후보

- [x] inactive pane tab context menu 를 active TabBar 메뉴와 동등하게 구현
- [x] context menu close 계열을 pane-local 액션으로 분리 (`closePaneTab`, close others, close tabs after)
- [x] wikilink / markdown link `Mod+Click` → active pane 새 탭 열기
- [x] wikilink `Mod+Alt+Click` → 새 pane split 후 열기
- [x] markdown link `Mod+Click` / `Mod+Alt+Click` 정책 검토 및 구현. 외부 URL 은 기본 링크 처리에 맡기고 vault 상대 markdown path 만 처리
- [x] tab context menu 에 `Copy path`, `Reveal in Finder` 추가
- [x] tab context menu 에 `Reveal in file tree`, `Copy relative path` 추가
- [x] active pane root focus indication 실험: accent border 또는 subtle ring. 과하면 폐기
- [x] i18n 의미명 정리: `closeToRight` → `closeTabsAfter`
- [x] inactive pane title/properties editable surface 추가

### Phase E.9 — 2026-04-26 구현 반영 요약

이번 작업에서 반영된 코드 단위:

- `workspace-tree-slice.ts`
  - `createPaneTab(paneId, path?)`
  - `closeOtherPaneTabs(paneId, tabId)`
  - `closePaneTabsAfter(paneId, tabId)`
  - `closeAllPaneTabs(paneId)`
  - `togglePaneTabPinned(paneId, tabId)`
  - `pruneEmptyPanes` 기반 pane 자동 정리
  - pinned tab 은 bulk close 에서 보존
  - 다중 pane 의 all-tabs-close 는 해당 pane prune, 단일 pane 의 all-tabs-close 는 기본 empty tab UI 유지
  - placeholder tab (`path === ""`) 의 close/move/split 처리
- `tab-slice.ts`
  - `createEmptyTab()`
  - `promoteActiveEmptyTab(path)`
  - `openFileInEditor("")` 는 editor close 로 처리
  - split mode 에서 active pane mirror 동기화
  - active pane 의 close/close others/close right/close all 을 workspace pane-local 액션으로 위임
  - `togglePinned(id)` 추가. split mode 에서는 `togglePaneTabPinned` 으로 위임
- `app.tsx`
  - `EmptyPanePlaceholder` 재사용
  - 새 파일 생성 시 active placeholder tab 을 path/title 로 promote
  - 새 파일 기본 본문을 빈 문자열로 생성
- `workspace-root.tsx` / `pane.tsx`
  - 모든 pane 에 풀 TabBar 노출
  - inactive pane 에 editable editor surface 렌더
  - pane `...` 메뉴 추가
  - inactive pane tab context menu 추가
  - tab drag/drop capture 처리
  - drop zone label overlay 추가
  - pane boundary / active pane indication / TabBar 시인성 개선
- `tab-bar.tsx`
  - active pane TabBar 에 pane menu 추가
  - split right/down context menu 추가
  - `+` 버튼은 placeholder tab 생성
  - Obsidian/Chrome 스타일 탭 슬롯 적용
- `inactive-pane-editor.tsx`
  - 비활성 pane 용 파일명 입력 + properties panel + editable Tiptap surface
  - 파일명 변경 시 저장 flush 후 rename, 모든 pane tab path/title 갱신
  - properties 변경 시 frontmatter 로컬 상태 갱신 + 자체 auto-save
  - 파일 로딩/저장/충돌 상태 i18n 적용
  - 자체 auto-save debounce 와 `expectedModified` 충돌 감지
- `editor-preprocess.ts`
  - editor markdown preprocess helper 분리
- `workspace-commands.ts`
  - `openPathInSplit(path, zone)` 추가
- `wikilink-click.ts`
  - `Mod+Alt+Click` 으로 링크 대상 우측 split 열기
- `split-divider.tsx`
  - divider hit area 와 시각 구분 강화
- `public/locales/{ko,en}/tabs.json`, `app.json`
  - pane menu, drop zone, inactive editor, split labels 추가

남은 확인/후속:

- 사용자가 실제 Tauri/WebView 환경에서 Phase E.7 수동 검증을 진행한다.
- Quick Open 선택 결과는 active placeholder tab 이 있으면 promote 하고, 없으면 일반 `openTab` 한다.
- markdown link 의 `Mod+Click` / `Mod+Alt+Click` 은 wikilink 와 같은 정책을 적용한다. 외부 URL 은 처리하지 않는다.
- 같은 파일을 여러 pane 에서 동시에 편집할 때 자동 병합은 하지 않는다. 비활성 pane editor 는 `expectedModified` 충돌 감지 후 충돌 상태를 보여준다.

### Phase E.10 — 2026-04-26 후속 안정화 반영

#### 제목 rename 동기화

- `Tab.titleDraft?: string` 도입.
- 제목 입력 중에는 `titleDraft` 를 즉시 갱신하고, 제목 입력창 / active TabBar / inactive pane TabBar / 파일 트리 markdown 파일명은 `titleDraft ?? title` 을 표시한다.
- 실제 파일 rename 도 입력 중 즉시 실행한다. `rename_entry` 는 직렬 큐로 처리하고, rename 진행 중 추가 입력이 들어오면 최신 입력값만 pending 으로 보관한다.
- rename 성공 시 `currentPath`, active tabs, inactive pane tabs, search/tag/backlink path 를 새 path 로 갱신하고 `titleDraft` 를 제거한다.
- `EditorView` 와 `InactivePaneEditor` 의 Tiptap editor instance 는 `path/currentPath` 변경만으로 재생성하지 않는다. path 는 저장 대상 메타데이터로만 바뀌며 본문 editor 와 포커스는 유지한다.
- 관련 커밋: `e3dc1d7`.

#### Workspace startup restore

- `.munix/workspace.json` hydrate 직후 active tab 의 파일을 editor slice 에 다시 연다.
- 부팅 bootstrap 중 legacy `useVaultStore.info === null` 상태에서 `resetTabs()` 가 실행되어 hydrate 된 탭을 지우는 문제를 방지했다. active vault id 가 존재하면 초기 null 상태만으로 tabs 를 reset 하지 않는다.
- 관련 커밋: `67791ac`.

#### 다음 수동 확인

- 앱 종료 후 재실행 시 마지막 열린 vault, tabs, active tab, split tree, active file 본문이 복원되는지 확인한다.
- 제목 입력 중 제목 input / active tab / inactive tab / file tree label 이 같은 값으로 즉시 변하는지 확인한다.
- 제목 입력 중 실제 파일명이 즉시 바뀌면서도 커서가 본문으로 이동하지 않는지 확인한다.
