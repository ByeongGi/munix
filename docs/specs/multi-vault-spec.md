# Multi-Vault 워크스페이스 상세 설계 — Munix

> 좌측 세로 vault 탭(=Vault Dock) + 탭별 워크스페이스 격리 + 탭 → 새 창 승격.
> ADR-031의 구현 사전 문서.

**상태:** ✅ Accepted (구현 완료 2026-04-26). Phase A~C + F 끝. ~~Phase D (멀티 윈도우)~~ 폐기 (앱 컨셉 불일치, 2026-04-26 — [workspace-split-spec.md](./workspace-split-spec.md) 로 대체). Phase E (다른 spec 갱신) 후속.
**관련 ADR:** [ADR-031](../decisions.md#adr-031-멀티-vault-워크스페이스-cmux-스타일-좌측-세로-탭) (supersedes [ADR-004](../decisions.md#adr-004-단일-vault-방식)), [ADR-032](../decisions.md#adr-032-글로벌-vault-레지스트리--munixjson-백엔드-파일) (글로벌 레지스트리)

---

## 1. 목적

- **vault 전환 비용 최소화** — cmux의 탭 스위칭 경험을 노트앱에 이식
- **vault 간 격리 유지** — 검색·자동완성·태그·백링크는 vault scope, 의도된 프라이버시
- **동시 작업 지원** — 한 창 안에서 빠른 전환 + 필요 시 탭 → 새 창 승격
- **단일 프로세스 효율** — Obsidian 멀티 인스턴스 대비 메모리 절감

---

## 2. 용어

| 용어 | 정의 |
|------|------|
| **Vault** | 사용자가 선택한 루트 디렉토리. ([vault-spec](./vault-spec.md) 참조) |
| **VaultId** | vault 인스턴스의 고유 ID (UUID v7). 같은 경로라도 같은 세션 내에선 동일 |
| **VaultTab** | Vault Dock 좌측의 세로 탭 1개. 1 vault에 1대1 |
| **Workspace** | 한 vault 탭의 작업 상태 묶음 (열린 파일 탭, 사이드바 트리 펼침/접힘, 검색 상태, undo 스택, 스크롤 위치 등) |
| **Vault Dock** | 좌측 세로 탭 영역. 모든 열린 vault 표시 + 핀 / 알림 / 새 vault 액션 |
| **Active Vault** | 현재 창에서 메인 영역에 표시되는 vault. 창마다 1개 |
| **Pinned Vault** | 즐겨찾기로 고정된 vault. 닫혀도 Dock에 남음 |
| **Vault State** | Backend에 저장되는 vault 인스턴스 상태 (root, watcher, 인덱스, save queue 등) |

---

## 3. 요구사항

### 3.1 기능 요구 (P0)

- [ ] 좌측 Vault Dock에 열린 vault 세로 리스트 표시
- [ ] vault 탭 클릭 시 메인 영역(사이드바 트리 + 파일 탭 + 에디터) 통째 swap
- [ ] vault 워크스페이스 상태(파일 탭, undo, 스크롤 등) 탭 전환 시 보존
- [ ] `Cmd+1`, `Cmd+2`, ..., `Cmd+9` 단축키로 vault 점프
- [ ] `Cmd+T` 새 vault 탭 (폴더 선택 다이얼로그 또는 최근 vault 메뉴)
- [ ] `Cmd+W` 현재 vault 탭 닫기 (unsaved 있으면 confirm)
- [ ] vault 탭 우클릭 → 컨텍스트 메뉴 (닫기 / 새 창으로 / 핀 / 경로 복사 / Finder)
- [ ] vault 탭 드래그로 순서 변경
- [ ] vault 탭 드래그 아웃 → 새 창으로 분리 (Chrome 패턴)
- [ ] 검색·자동완성·태그·백링크는 항상 active vault scope만

### 3.2 기능 요구 (P1)

- [ ] Vault Dock 핀(★) 기능 — 자주 쓰는 vault 상단 고정
- [ ] vault 탭 알림 ring — 외부 변경(watcher) 감지 시 점/링 표시
- [ ] vault 탭 메타 표시 — 미저장 수, 인덱싱 중 상태 등
- [ ] Vault Dock 접기/펼치기 토글 (`Cmd+B`와 별개의 단축키)
- [ ] 글로벌 settings vs vault override (`.munix/settings.json`)
- [ ] vault별 액센트 컬러 옵션 (멀티 모니터 분리 시 식별)

### 3.3 기능 요구 (P2)

- [ ] vault Dock 검색 박스 (vault 많을 때 빠른 필터)
- [ ] idle vault 인덱스 자동 unload (메모리 회수, 5분 미사용 등)
- [ ] vault 잠금 옵션 — 일정 시간 후 비밀번호로 잠금 (회사 vault 보안 시나리오)

### 3.4 비기능 요구

- [ ] vault 탭 전환 시간 < 50ms (워크스페이스 swap 포함)
- [ ] 새 vault 첫 오픈 (cold) 시간 ≤ 단일 vault 오픈 시간
- [ ] vault 10개 동시 운영 시 메모리 증가는 인덱스 크기 합 + 50MB 이내
- [ ] 모든 vault 관련 IPC는 active vault 검증 (잘못된 `vault_id` 거부)

---

## 4. 모델 변경

### 4.1 Backend: VaultManager

```rust
// src-tauri/src/vault_manager.rs (신규)

use std::collections::HashMap;
use std::sync::RwLock;
use uuid::Uuid;

pub type VaultId = String; // UUID v7 (정렬 가능, 시간순)

pub struct VaultManager {
    vaults: RwLock<HashMap<VaultId, VaultEntry>>,
    /// vault_id 별 구독 중인 윈도우 ID 목록 — 이벤트 라우팅용
    subscribers: RwLock<HashMap<VaultId, Vec<tauri::WindowLabel>>>,
}

pub struct VaultEntry {
    pub id: VaultId,
    pub vault: Vault,                    // 기존 Vault 구조체 ([vault-spec.md](./vault-spec.md))
    pub watcher: Option<FileWatcher>,
    pub index: Option<SearchIndex>,
    pub save_queue: SaveQueue,
    pub last_active_at: SystemTime,
    pub pinned: bool,
}

impl VaultManager {
    pub fn open(&self, path: PathBuf) -> Result<VaultId, VaultError>;
    pub fn close(&self, id: &VaultId) -> Result<(), VaultError>;
    pub fn get(&self, id: &VaultId) -> Result<VaultEntry, VaultError>;
    pub fn list(&self) -> Vec<VaultInfo>;
    pub fn pin(&self, id: &VaultId, pinned: bool) -> Result<(), VaultError>;

    /// 윈도우 닫힘 → 구독 해제. 마지막 구독자 사라지면 인덱스 unload 검토
    pub fn detach_window(&self, window: &tauri::WindowLabel);
}
```

기존 `AppState`는 다음과 같이 변경:

```rust
// src-tauri/src/state.rs

pub struct AppState {
    // BEFORE:
    // pub vault: Mutex<Option<Vault>>,
    // pub watcher: Mutex<Option<FileWatcher>>,

    // AFTER:
    pub vault_manager: VaultManager,
    pub global_settings: RwLock<GlobalSettings>,
}
```

> `Vault` 구조체 자체와 경로 안전성·원자적 쓰기·이름 검증 로직은 [vault-spec.md](./vault-spec.md) 그대로 유지. 변경은 "여러 개의 Vault를 동시에 운영하는 레이어"에 한정.

### 4.2 Frontend: 워크스페이스 store

**현재 단일 글로벌 store 가정 → vault 탭별 인스턴스 + 글로벌 메타로 분리.**

```typescript
// src/stores/vault-dock-store.ts (신규)

interface VaultDockStore {
  vaults: VaultTabMeta[];          // Dock 표시용 메타 (id, name, root, pinned, status)
  activeVaultId: VaultId | null;   // 현재 창의 active vault
  setActive(id: VaultId): void;
  open(path: string): Promise<VaultId>;
  close(id: VaultId): Promise<void>;
  pin(id: VaultId, pinned: boolean): void;
  reorder(ids: VaultId[]): void;
  promoteToWindow(id: VaultId): Promise<void>;  // 탭 → 새 창
}

// src/stores/workspace-store.ts (신규)
// vault 탭별 인스턴스. activeVaultId로 lookup.

interface WorkspaceState {
  vaultId: VaultId;
  openTabs: TabState[];            // 파일 탭들 (기존 tab-store 분리)
  activeTabId: string | null;
  fileTreeExpanded: Set<string>;
  searchState: SearchState;
  // ... 기존 글로벌 store가 vault scope에 속한 모든 상태
}

const workspaceRegistry = new Map<VaultId, StoreApi<WorkspaceState>>();

function getWorkspaceStore(vaultId: VaultId): StoreApi<WorkspaceState> {
  if (!workspaceRegistry.has(vaultId)) {
    workspaceRegistry.set(vaultId, createWorkspaceStore(vaultId));
  }
  return workspaceRegistry.get(vaultId)!;
}
```

탭 전환 시 동작:
1. 현재 active vault의 워크스페이스 상태를 메모리에 보존 (store는 그대로 둠)
2. 새 active vault의 store lookup → 메인 영역 컴포넌트가 그 store를 구독하도록 swap
3. UI는 React Context로 `activeVaultId` 주입, 자식 컴포넌트는 그에 맞는 store 사용

### 4.3 워크스페이스 영구화

탭 전환 시 메모리 보존만으론 부족 (앱 재시작·창 닫힘 시 유실). 다음을 IndexedDB 또는 vault `.munix/workspace.json`에 저장:

- 마지막 활성 파일 탭 + 열린 탭 목록
- 사이드바 트리 펼침 상태
- 스크롤 위치 (파일별)
- 마지막 검색어 (선택)

undo 스택은 메모리 한정 (재시작 시 초기화) — 영구화는 비용 대비 가치 낮음.

---

## 5. IPC 변경

### 5.1 시그니처 변경 원칙

**모든 vault-bound 커맨드에 `vault_id: VaultId` 필수 인자 추가.** 단일 vault 시점의 호출(현재 코드)은 한 번에 일괄 마이그레이션 (호환 레이어 두지 않음 — ADR-031 결과 항목).

```rust
// BEFORE
async fn list_files(state: State<AppState>) -> Result<Vec<FileNode>, VaultError>;
async fn read_file(rel_path: String, state: State<AppState>) -> Result<FileContent, VaultError>;
async fn write_file(rel_path: String, content: String, ...) -> Result<WriteResult, VaultError>;

// AFTER
async fn list_files(vault_id: VaultId, state: State<AppState>) -> Result<Vec<FileNode>, VaultError>;
async fn read_file(vault_id: VaultId, rel_path: String, state: State<AppState>) -> Result<FileContent, VaultError>;
async fn write_file(vault_id: VaultId, rel_path: String, content: String, ...) -> Result<WriteResult, VaultError>;
```

영향 받는 커맨드 (vault-spec §6 기준):
- §6.1: `open_vault`, `close_vault`, `get_vault_info` → 시그니처 갱신 (id 반환/입력)
- §6.2: `list_files`, `read_file`, `write_file`, `create_file`, `rename_file`, `delete_file`, `create_directory` → 모두 `vault_id` 추가
- §6.3: `save_asset` 등 asset 커맨드도 동일

### 5.2 신규 커맨드

```rust
/// 멀티 vault 운영용 신규 커맨드
async fn list_open_vaults(state: State<AppState>) -> Result<Vec<VaultInfo>, VaultError>;
async fn pin_vault(vault_id: VaultId, pinned: bool, state: State<AppState>) -> Result<(), VaultError>;
async fn reorder_vaults(ids: Vec<VaultId>, state: State<AppState>) -> Result<(), VaultError>;
// promote_vault_to_window — 폐기 (2026-04-26, §17.1 참조)

#[derive(Serialize)]
struct VaultInfo {
    id: VaultId,
    name: String,
    root: String,
    file_count: usize,
    pinned: bool,
    has_unsaved: bool,
    indexing: bool,
}
```

### 5.3 이벤트 라우팅

기존 단일 watcher → vault별 watcher. 각 watcher는 `vault_id`를 payload에 포함하고, **그 vault를 active로 둔 윈도우들에만** 이벤트 송신.

```rust
// 이벤트 페이로드
#[derive(Serialize, Clone)]
struct VaultFileEvent {
    vault_id: VaultId,
    path: String,                   // rel_path
    kind: FileEventKind,            // Created | Modified | Deleted | Renamed
}

// VaultManager가 라우팅
fn emit_vault_event(&self, event: VaultFileEvent, app: &AppHandle) {
    let subs = self.subscribers.read().unwrap();
    if let Some(windows) = subs.get(&event.vault_id) {
        for win_label in windows {
            if let Some(window) = app.get_window(win_label) {
                let _ = window.emit("vault:file_event", &event);
            }
        }
    }
}
```

### 5.4 충돌 감지 (`expected_modified`)

기존 mtime 기반 충돌 감지([vault-spec §6.2](./vault-spec.md))는 그대로. 다만 같은 vault를 두 윈도우(또는 탭→승격 창)에서 동시 편집 시 충돌 가능성이 늘어남 → 마이그레이션 검증 시 회귀 테스트 필수.

---

## 6. UX 플로우

### 6.1 메인 화면 — Vault Dock

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●   ⊞  🔔  ＋             [회사노트]  meeting.md                  ─ □ ✕  │
├─────────────────────┬────────────────────────────────────────────────────────┤
│ ★ 회사노트           │ ┌──┐                                                  │
│   ● meeting.md 편집중│ │📝│ ▼ 회사노트   meeting.md   ⋮                       │
│   ~/notes-work      │ │🔍│  ─────────                                       │
├─────────────────────┤ │  │ ▾ meetings                                       │
│ ★ 개인일기           │ │  │  ● 04-26      # 2026-04-26 회의록                 │
│   2개 미저장 ⚠       │ │  │  • 04-19      참석자: ...                         │
│   ~/notes-personal  │ │  │ ▸ daily        ## 안건                            │
├─────────────────────┤ │  │ ▸ projects                                       │
│   학습메모           │ │  │                                                  │
│   rust-async.md     │ │  │                                                  │
│   ~/notes-study     │ │  │                                                  │
├─────────────────────┤ │  │                                                  │
│   archive-2025      │ │  │                                                  │
│   읽기 전용          │ │  │                                                  │
├─────────────────────┤ │  │                                                  │
│ ＋ 새 vault 열기      │ └──┘                                                   │
└─────────────────────┴────────────────────────────────────────────────────────┘
```

**Vault Dock 디테일:**
- 너비 200~240px 기본, 사용자 조절 가능
- 각 탭 2줄 메타: 1줄차 vault 이름, 2줄차 경로 또는 상태(`● 편집 중`, `⚠ 2개 미저장`, `⏳ 인덱싱`)
- 핀 그룹(★) → 일반 그룹 순으로 정렬, 각 그룹 내 사용자 정렬
- active vault는 오닉스 틸 액센트 + 좌측 세로 막대 표시
- 우클릭 컨텍스트 메뉴: 닫기 / 새 창으로 분리 / 핀 토글 / 경로 복사 / Finder에서 보기 / 이름 변경 (vault 표시명만, 폴더명은 변경 안 함)

### 6.2 새 vault 열기 플로우

```
사용자 액션          UI                              Backend
─────────────────────────────────────────────────────────────────────
⌘ T 또는 ＋ 클릭     [폴더 선택 다이얼로그]            ─
폴더 선택            "신뢰 prompt" 표시                vault-trust 검증
신뢰 클릭            로딩 인디케이터 (Dock 새 탭)       VaultManager.open()
                                                     → vault_id 생성
                                                     → watcher 시작
                                                     → 인덱스 빌드 (백그라운드)
                                                     → workspace.json 로드
                    Vault Dock에 새 탭 추가            ─
                    그 탭으로 active swap              ─
                    (이전 vault state는 메모리 보존)    ─
```

### 6.3 vault 전환

```
사용자: vault 탭 클릭 또는 ⌘ 1/2/3
  ├─ 현재 workspace state → 메모리 보존 (store 인스턴스 유지)
  ├─ activeVaultId 변경 → React Context 갱신
  ├─ 메인 영역 컴포넌트가 새 vault의 workspace store 구독
  ├─ Vault Dock active 표시 갱신
  └─ 타이틀바 [vault명] 갱신
```

성능 목표: < 50ms. store 인스턴스가 메모리에 있으므로 데이터 fetch 없이 UI swap만.

### 6.4 ~~vault 탭 → 새 창 승격~~ 폐기 (2026-04-26)

> 이 시나리오는 §17.1 와 함께 폐기. 멀티 문서 비교는 [workspace-split-spec.md](./workspace-split-spec.md) 의 한 창 안 split tree 로 해결.

### 6.5 vault 탭 닫기

```
사용자: ⌘ W 또는 우클릭 → 닫기
  ├─ 현재 vault에 unsaved 있는지 검사
  │   └─ 있으면 confirm 다이얼로그
  │       [취소] [저장 안 함] [모두 저장 후 닫기]
  ├─ 닫기 진행:
  │   ├─ workspace state → IndexedDB 영구화
  │   ├─ store 인스턴스 dispose
  │   ├─ Backend: VaultManager.detach_window()
  │   │   └─ 마지막 구독자 사라지면 인덱스/watcher 정리
  │   └─ Vault Dock에서 탭 제거 (단, 핀 vault는 남기고 회색 처리)
  └─ active vault였으면 인접 탭으로 swap (없으면 Welcome 화면)
```

### 6.6 Split pane과의 결합

> 본 절은 [workspace-split-spec.md](./workspace-split-spec.md)와의 결합을 정의. split 자체의 데이터 모델·DnD·리사이즈는 그쪽이 SoT.

**원칙:** 한 vault 탭의 워크스페이스는 자기만의 split 트리를 소유. vault 전환 시 split 트리 통째로 보존·복원. **vault 경계를 넘는 split은 금지** (격리 가치).

#### 6.6.1 영역 위계 (4 레이어)

```
L0: Vault Dock        ← 어느 vault인지 선택
L1: File Tree (옵션)   ← 그 vault의 트리 (Mod+B 토글)
L2: WorkspaceRoot     ← 그 vault의 split 트리 (재귀)
L3: Pane              ← 탭 묶음 + 에디터
```

#### 6.6.2 결합 와이어 (1+2 split, 사용자 시나리오)

```
┌──────┬───────┬──────────────┬──────────────────────────┐
│Vault │ File  │ Pane A       │ Pane B-top               │
│Dock  │ Tree  │ [main.md]    │ [snippet.md]             │
│      │       │              ├──────────────────────────┤
│ ★회 ●│       │              │ Pane B-bottom            │
│  개  │       │              │ [todo.md]                │
│  학  │       │              │                          │
└──────┴───────┴──────────────┴──────────────────────────┘
   L0     L1         L3              L2 (column split)
                                       └─ L3 / L3
```

File Tree 접힘(스크린샷 패턴):

```
┌──────┬──────────────┬──────────────────────────────────┐
│Vault │ Pane A       │ Pane B (안에서 column split)        │
│Dock  │ [doc.md]     │ ┌─[snip]──┬─────┐                 │
│ ★회 ●│              │ ├─────────┼─────┤                 │
│      │              │ │ [todo]  │ ... │                 │
│      │              │ └─────────┴─────┘                 │
└──────┴──────────────┴──────────────────────────────────┘
```

#### 6.6.3 vault 전환 시 split 보존

```
회사 vault 활성             개인 vault 활성             회사로 돌아옴
┌────┬─────┬───┬───┐        ┌────┬─────┬─────────┐        ┌────┬─────┬───┬───┐
│Dock│Tree │ A │ B │   →   │Dock│Tree │ Single  │   →   │Dock│Tree │ A │ B │
│★회●│refs │ref│tdo│        │★회 │daily│  pane   │        │★회●│refs │ref│tdo│
│ 개 │     │   │   │        │ 개●│     │ today.md│        │ 개 │     │   │   │
└────┴─────┴───┴───┘        └────┴─────┴─────────┘        └────┴─────┴───┴───┘
   3-pane split              개인의 single pane            3-pane 그대로 복원
```

각 vault 탭이 **자기 split 트리 + 탭 묶음 + active tab + 스크롤 위치**를 통째로 기억 → 전환 시 메모리에서 swap (성능 목표 §3.4: <50ms).

#### 6.6.4 데이터 모델 결합

multi-vault `WorkspaceState`(§4.2)가 split 트리를 소유:

```typescript
interface WorkspaceState {
  vaultId: VaultId;
  tree: SplitNode | Pane;          // ← workspace-split-spec의 트리 그대로
  activePaneId: string | null;
  fileTreeExpanded: Set<string>;
  searchState: SearchState;
}

// SplitNode / Pane / TabState 정의는 workspace-split-spec §4 참조
```

PaneId·TabId는 한 vault 안에서만 unique. vault 경계를 넘는 참조는 발생 안 함.

#### 6.6.5 vault 경계 제약

```
❌ 다른 vault 파일을 같은 창의 split pane으로 드래그
   → DnD payload의 vault_id가 active vault와 다르면 drop 거부

✅ 같은 vault를 두 창에서 띄우고 각 창이 독립 split 보유
✅ 한 vault 안에서 N-pane split
✅ vault 전환 시 split 트리 보존
✅ 같은 파일을 같은 vault 안 두 pane에서 동시 편집 (mtime 충돌 감지)
```

DnD payload 검증:

```typescript
// workspace-split-spec §6.1 의 DragTabPayload 확장
interface DragTabPayload {
  type: "munix/tab";
  vaultId: VaultId;          // ← 추가: 출발 vault
  tabId: string;
  fromPaneId: string;
  path: string;
}

// drop 핸들러
function onDrop(target: Pane, payload: DragTabPayload) {
  if (payload.vaultId !== getActiveVaultId()) {
    return; // 다른 vault → 거부
  }
  // ... 기존 split 로직
}
```

#### 6.6.6 같은 vault, 두 창 — split 독립

```
Window A (회사 active)                  Window B (회사 active, 승격됨)
┌────┬─────┬───────┬───────┐            ┌────┬─────┬───────────────────┐
│Dock│Tree │ Pane  │ Pane  │            │Dock│Tree │   Single pane     │
│★회●│     │ ref   │ todo  │            │★회●│     │  archive/2025.md  │
│ 개 │     │       │       │            │ 개⧉│     │                   │
└────┴─────┴───────┴───────┘            └────┴─────┴───────────────────┘
   ↑ 자기만의 split 트리 보유                ↑ 자기만의 split 트리 보유
```

같은 vault라도 창마다 다른 split을 둠. backend의 `WorkspaceState`는 (`VaultId`, `WindowId`) 키로 분리되거나, 창별 frontend store 인스턴스가 자체 보존 — Phase B 구현 시 결정.

### 6.7 모든 vault 닫힘 → Welcome

```
┌──────────────────────────────────────────────────────────────────┐
│ ● ● ●                            Munix                    ─ □ ✕  │
├──────────────────────────────────────────────────────────────────┤
│                          ┌─────────┐                             │
│                          │    M    │                             │
│                          └─────────┘                             │
│                                                                  │
│   ┌──────────────────────┐    ┌──────────────────────┐           │
│   │   📂 Vault 열기       │    │   ✨ 새 Vault         │           │
│   │      ⌘ O             │    │      ⇧⌘ N            │           │
│   └──────────────────────┘    └──────────────────────┘           │
│                                                                  │
│  ─── 최근 ─────────────────────────────────────────────          │
│   📁 회사노트                                       방금          │
│   📁 개인일기                                       1시간 전      │
│   📁 학습메모                                       어제          │
│   📁 archive-2025                            ⚠ 이동됨            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. 단축키

> 상세는 [keymap-spec.md](./keymap-spec.md) 갱신 시 통합. 본 spec은 신규/변경 항목만.

| 단축키 | 동작 | 비고 |
|---|---|---|
| `⌘ T` | 새 vault 탭 열기 | 폴더 선택 다이얼로그 |
| `⌘ W` | 현재 vault 탭 닫기 | unsaved confirm |
| `⌘ 1`~`⌘ 9` | n번째 vault 탭으로 점프 | cmux 호환 |
| `⌘ ⇧ [` / `⌘ ⇧ ]` | 이전/다음 vault 탭 | brave/cmux 패턴 |
| `⌘ ⇧ T` | 최근 닫은 vault 다시 열기 | (P1) |
| `⌘ ⇧ O` | Vault Switcher 팔레트 | recent + 검색 |
| `⌘ ⇧ N` | 새 vault 만들기 | 빈 폴더 생성 + 오픈 |
| `⌘ ⌥ B` | Vault Dock 토글 | 사이드바와 별개 |

**충돌 점검 (기존 keymap-spec과):**
- `⌘ T`는 기존 "새 파일 탭"과 충돌 가능 → 새 파일은 `⌘ N` 유지, `⌘ T`는 vault 탭으로 재할당
- `⌘ W`도 동일 점검 필요 (현재는 파일 탭 닫기)
- 해결안: vault Dock 포커스 / 메인 영역 포커스에 따라 컨텍스트 분기 (또는 modifier 추가)

---

## 8. Settings: 글로벌 vs Vault Override

```
글로벌 (~/.config/munix/settings.json):
  - 테마, 액센트 컬러
  - 단축키
  - 언어 (i18n)
  - Vault Dock 너비, 표시 여부
  - recent_vaults[]
  - pinned_vaults[]

Vault override (.munix/settings.json):
  - 자동저장 debounce
  - 검색 인덱스 옵션
  - vault 표시 이름 (폴더명 override)
  - vault 액센트 컬러 (Dock 표시 시)
  - 자동완성 동작 (태그 prefix 등)
```

UI에선 **글로벌 / Vault별** 트리로 명확히 분리, vault 설정은 글로벌 기본값과 비교 표시 + 재설정 버튼.

상세 마이그레이션은 [settings-spec.md](./settings-spec.md) 갱신 필요 (별도 작업).

---

## 9. 검색·자동완성·태그·백링크 scope

**원칙: 모두 active vault scope만.** 크로스 vault 검색은 v2까지 의도적으로 안 함 (ADR-031 격리 가치).

| 기능 | scope | UI 표시 |
|---|---|---|
| Quick Open (`⌘ O`) | active vault | "검색 범위: {vault명}" 헤더 |
| 전문 검색 | active vault | 동일 |
| 자동완성 (`[[`, `#`) | active vault | — |
| 백링크 패널 | active vault | — |
| 태그 인덱스 | active vault | — |
| Command Palette | 글로벌 + vault commands 혼합 | vault 명령엔 vault 이름 prefix |

상세는 [search-spec.md](./search-spec.md) 갱신 시 통합.

---

## 10. CLI / URI scheme 영향

기존 [cli-spec.md](./cli-spec.md)의 `munix://open?path=...` 패턴은 vault 라우팅 모호 → 다음과 같이 갱신 필요:

```
BEFORE: munix://open?path=foo.md
AFTER:  munix://open?vault=/Users/example/notes-work&path=foo.md
        munix://open?vault_id=<UUID>&path=foo.md  (이미 열린 vault 지정)
```

라우팅 로직:
1. 이미 그 vault가 열려 있으면 → 해당 탭으로 active swap
2. 안 열려 있으면 → 새 vault 탭으로 오픈 후 파일 열기
3. `vault` 파라미터 없으면 → 가장 최근 active vault로 fallback (기존 single-instance 휴리스틱)

상세는 cli-spec.md 갱신 필요 (별도 작업).

---

## 11. 보안·권한

기존 vault-spec §9 보안 체크리스트는 그대로 유지하되 다음 추가:

- [ ] 모든 vault-bound IPC는 `vault_id`가 VaultManager에 등록된 active vault인지 검증
- [ ] vault A의 윈도우에서 vault B의 `vault_id`로 호출 시 거부 (cross-vault leak 방지)
- [ ] 새 vault 오픈 시 [vault-trust-spec.md](./vault-trust-spec.md)의 신뢰 prompt 통과 필수
- [ ] vault 닫힘 후 그 vault_id는 무효화 (재사용 금지, 새 UUID 발급)

---

## 12. 성능·메모리

### 12.1 인덱스 unload 정책 (P1)

vault 10개 동시 운영 시 메모리 압박 방지:

```rust
const IDLE_UNLOAD_THRESHOLD: Duration = Duration::from_secs(5 * 60);

// 주기적 작업 (1분마다)
fn maybe_unload_idle_indexes(&self) {
    let now = SystemTime::now();
    for entry in self.vaults.write().unwrap().values_mut() {
        if entry.id == self.active_id { continue; }  // active vault는 보호
        if now.duration_since(entry.last_active_at).unwrap_or_default() > IDLE_UNLOAD_THRESHOLD {
            if let Some(index) = &entry.index {
                index.flush_to_disk();
            }
            entry.index = None;  // 메모리 회수, 다음 검색 시 lazy 재로드
        }
    }
}
```

### 12.2 watcher 정책

- 모든 열린 vault에 watcher 유지 (외부 변경 알림은 핵심 가치)
- 단, 인덱스 unload된 vault는 watcher 이벤트를 큐에만 쌓고 처리 지연
- vault 닫힘 시 watcher 즉시 정리

---

## 13. 마이그레이션 체크리스트

구현 시 단계별 적용:

### Phase A: Backend 토대 (선행)
- [ ] `VaultManager` 구조체 + `VaultId` 타입 도입
- [ ] `AppState`에서 `Mutex<Option<Vault>>` 제거 → `VaultManager` 사용
- [ ] 모든 vault 커맨드 시그니처에 `vault_id` 추가
- [ ] watcher / 인덱스 / save queue를 vault별로 분리
- [ ] vault 격리 회귀 테스트 (cross-vault id 거부 등)

### Phase B: Frontend store 분리
- [ ] `vault-dock-store` 신규
- [ ] `workspace-store`를 vault별 인스턴스로 분리 (registry)
- [ ] 기존 글로벌 stores를 workspace scope로 이동
- [ ] 탭 전환 swap 로직 + IndexedDB 영구화

### Phase C: UI 도입
- [ ] Vault Dock 컴포넌트 (좌측 세로 탭)
- [ ] Welcome 화면 (모든 vault 닫힘 시)
- [ ] Settings UI 글로벌/vault 분리
- [ ] 단축키 추가 (`⌘ 1~9`, `⌘ T`, `⌘ W` 등) + 충돌 점검

### ~~Phase D: 탭 → 창 승격~~ 폐기 (2026-04-26)

§17.1 / §6.4 와 함께 폐기. 본 spec 의 후속 작업은 §17.2 Phase E 만 남음.

### Phase E: 다른 spec 갱신
- [ ] [keymap-spec.md](./keymap-spec.md) 단축키 추가
- [ ] [settings-spec.md](./settings-spec.md) 글로벌/vault 분리
- [ ] [search-spec.md](./search-spec.md) scope 명시
- [ ] [cli-spec.md](./cli-spec.md) URI에 vault 파라미터
- [ ] [workspace-split-spec.md](./workspace-split-spec.md) split pane × vault 조합 정의

---

## 14. 테스트 케이스

### 14.1 격리

- [ ] vault A의 윈도우에서 vault B의 `vault_id`로 IPC 호출 → 거부
- [ ] vault A에서 검색 → vault B 파일 안 나옴
- [ ] vault A에서 자동완성 (`[[`, `#`) → vault B 항목 안 나옴
- [ ] vault A 백링크 패널 → vault B 결과 안 섞임

### 14.2 워크스페이스 보존

- [ ] vault A에서 파일 탭 3개 열고 vault B로 swap → 다시 A 클릭 시 탭 3개 그대로
- [ ] 사이드바 트리 펼침 상태 유지
- [ ] undo 스택 유지 (메모리)
- [ ] 앱 재시작 후 마지막 active vault + 그 워크스페이스 복원 (IndexedDB)

### 14.3 멀티 vault 동시 운영

- [ ] vault 10개 동시 오픈 → 각자 watcher 동작, 메모리 증가 확인
- [ ] idle 5분 → 인덱스 unload, 다음 검색 시 재로드
- [ ] vault 1개에서 외부 파일 변경 → 그 vault 구독 윈도우만 알림

### 14.4 탭 → 창 승격

- [ ] vault 탭 드래그 아웃 → 새 창에 그 vault 표시
- [ ] 두 창에서 같은 파일 동시 편집 → mtime 충돌 감지 동작
- [ ] 한쪽 창에서 파일 저장 → 다른 창에서 외부 변경 알림 + reload prompt

### 14.5 단축키·UX

- [ ] `⌘ 1~9` 점프 → 해당 탭 active swap
- [ ] `⌘ T` 새 vault 다이얼로그
- [ ] `⌘ W` unsaved confirm
- [ ] 탭 우클릭 컨텍스트 메뉴 모든 항목

---

## 15. 오픈 이슈

1. **단축키 충돌 (`⌘ T`, `⌘ W`)**: 기존 파일 탭 단축키와 vault 탭 단축키 분리 방법 — 컨텍스트(포커스) 분기 vs modifier 추가. UX 검증 필요
2. **같은 vault를 두 창에서**: 워크스페이스 store 동기화 방식 — broadcast vs leader-follower. 단순함 우선이면 broadcast
3. **워크스페이스 IndexedDB vs 파일**: vault별 `.munix/workspace.json` 으로 vault와 함께 이동/백업 가능 vs IndexedDB(웹뷰) 빠름. **`.munix/workspace.json` 권장** (Obsidian 호환성·휴대성)
4. **인덱스 unload 임계값**: 5분이 적절한지 검증 필요. 사용자 설정 노출 여부
5. **Welcome 화면의 multiple vault 자동 복원**: 마지막 세션의 모든 vault 자동 재오픈 vs 가장 최근 active만. settings 토글 권장
6. **vault 표시 이름 vs 폴더명**: vault override(.munix/settings.json)에 표시 이름 두면 폴더 이름 그대로 두고 Dock 표시만 바꿈. 충돌 시 우선순위
7. **vault 액센트 컬러**: 자동(해시 기반) vs 사용자 선택. 자동 + override가 적절
8. **모바일/태블릿 (장기)**: Vault Dock이 좁은 화면에 어떻게 적응하는지 — drawer 패턴? v2 고려

---

## 16. 관련 문서

- [ADR-031](../decisions.md#adr-031-멀티-vault-워크스페이스-cmux-스타일-좌측-세로-탭) — 본 spec의 결정 근거
- [ADR-004](../decisions.md#adr-004-단일-vault-방식) — superseded
- [vault-spec.md](./vault-spec.md) — 단일 vault 안의 보안·경로·IPC 본질
- [workspace-split-spec.md](./workspace-split-spec.md) — vault 안에서의 split (vault × split 조합)
- [keymap-spec.md](./keymap-spec.md) — 단축키 통합 (갱신 필요)
- [settings-spec.md](./settings-spec.md) — 글로벌 vs vault override (갱신 필요)
- [search-spec.md](./search-spec.md) — vault scope 검색 (갱신 필요)
- [cli-spec.md](./cli-spec.md) — URI scheme vault 라우팅 (갱신 필요)
- [vault-trust-spec.md](./vault-trust-spec.md) — 새 vault 신뢰 prompt

---

## 17. 후속 작업

> Phase A~C + F 는 완료 (2026-04-26). 남은 두 묶음은 별 사이클로.

### 17.1 ~~Phase D — 탭 → 새 창 승격 (멀티 윈도우)~~ 폐기 (2026-04-26)

> **결정:** OS 레벨 멀티 윈도우 (Tauri `WebviewWindow` 동적 생성, 같은 vault 두 OS 창 동시 운영) 는 Munix 의 앱 컨셉과 맞지 않아 채택하지 않는다.
>
> **대체:** 멀티 문서 비교/참조 욕구는 [workspace-split-spec.md](./workspace-split-spec.md) (한 창 안 split tree) 로 해결. 멀티 vault 동시 운영은 이미 좌측 Vault Dock (Phase A~C) 으로 충족.
>
> **사유:**
> - Munix 는 로컬 퍼스트 + 단순함 + Obsidian-style 단일 창 워크스페이스가 핵심
> - OS 창 분리는 사용자 멘탈 모델 분산 (어느 창에 무엇이 열려 있는지 추적 부담)
> - workspace split + Vault Dock 조합으로 80% 가치 확보 — 멀티 모니터 사용자만 진짜 혜택
> - backend 부담 큼: `VaultManager.subscribers` ref count, ActiveVault 창별 분기, capability scope 윈도우 라벨 패턴 — 가치 대비 복잡도 과함
>
> 향후 멀티 윈도우 제안이 다시 나오면 거부하고 이 섹션을 가리키면 된다.

### 17.2 Phase E — 다른 spec 갱신

영향 받는 다른 기능들 multi-vault 정합 갱신. 일부는 D 와 병행 가능 (search-spec, cli-spec).

- [ ] [keymap-spec.md](./keymap-spec.md) — vault-aware 명령 vs 글로벌 명령 분리, KEYMAP_REGISTRY 갱신
- [ ] [settings-spec.md](./settings-spec.md) — 글로벌 vs vault override 스키마 정식화 (`fontSize / editorWidth / autoSaveDebounceMs` 만 override 가능, 그 외 글로벌 only)
- [ ] [search-spec.md](./search-spec.md) — vault scope 명시, Quick Open scope 헤더
- [ ] [cli-spec.md](./cli-spec.md) — URI 에 `vault` 파라미터 (`munix://open?vault=...&path=...`)
- [x] [vault-trust-spec.md](./vault-trust-spec.md) — 멀티 vault 신뢰 prompt 통합 (`fc466b5`, partial accepted)

---

**문서 버전:** v0.4
**작성일:** 2026-04-26
**최근 업데이트:** 2026-04-26 — Phase D (멀티 윈도우) 폐기 (앱 컨셉 불일치, [workspace-split-spec.md](./workspace-split-spec.md) 로 대체). v0.3 → v0.4. Phase A~C + F 구현 완료 (Accepted). 남은 Phase E (다른 spec 갱신) 만 후속.
**작성자:** Munix contributors
