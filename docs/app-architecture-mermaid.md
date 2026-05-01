# Munix 앱 동작 구조

> Mermaid 다이어그램으로 정리한 현재 Munix의 런타임 구조 문서.
> 구현 기준은 `munix/src`와 `munix/src-tauri/src`의 현재 구조다.
> 최신 플랫폼별 runtime 경계는 [app-runtime-architecture.md](./app-runtime-architecture.md)를 기준으로 한다.

## 1. 전체 계층

```mermaid
flowchart TB
  User["사용자 입력"]
  ReactApp["React App<br/>munix/src/app.tsx"]
  Shell["App Shell<br/>TitleBar / Sidebar / Workspace"]
  WorkspaceStore["Vault별 Workspace Store<br/>Zustand registry"]
  EditorStore["Editor / Tab / Search / Tags / Recent slices"]
  IPC["IPC facade<br/>src/lib/ipc.ts"]
  Tauri["Tauri command layer<br/>src-tauri/src/commands"]
  VaultManager["VaultManager<br/>multi vault routing"]
  VaultFS["Vault FS layer<br/>path validation / atomic write / backup"]
  Disk["로컬 파일 시스템<br/>.md / assets / .munix"]

  User --> ReactApp
  ReactApp --> Shell
  Shell --> WorkspaceStore
  WorkspaceStore --> EditorStore
  EditorStore --> IPC
  Shell --> IPC
  IPC --> Tauri
  Tauri --> VaultManager
  VaultManager --> VaultFS
  VaultFS --> Disk
```

핵심은 프론트가 파일 시스템에 직접 접근하지 않는다는 점이다. 모든 vault 파일 작업은 `ipc.ts`를 거쳐 Rust command와 `Vault` 모듈에서 검증된다.

## 2. 앱 부팅과 Vault 선택

```mermaid
sequenceDiagram
  participant Main as main.tsx
  participant Registry as vault-registry
  participant Dock as useVaultDockStore
  participant App as App
  participant Picker as VaultPicker
  participant IPC as ipc.openVault
  participant Rust as Rust VaultManager
  participant WS as WorkspaceRegistry

  Main->>Registry: bootstrapVaultRegistry()
  Registry->>Dock: 열린 vault 목록 복원
  Dock->>IPC: listOpenVaults / setActiveVault
  IPC->>Rust: command invoke
  Rust-->>Dock: VaultInfo[]
  Dock->>App: activeVaultId / info 갱신

  alt 열린 vault 없음
    App->>Picker: VaultPicker 렌더
    Picker->>IPC: openVault(path)
    IPC->>Rust: open_vault(path, setActive=true)
    Rust-->>Dock: VaultInfo
  end

  Dock->>WS: getWorkspaceStore(vaultId)
  WS->>IPC: workspaceLoad(vaultId)
  IPC-->>WS: .munix/workspace.json
  WS->>WS: hydrateWorkspaceStore()
  WS->>App: active workspace 제공
```

`useVaultStore`는 단일 vault 시절 API 호환용 wrapper 역할을 하고, 실제 멀티 vault 상태의 중심은 `useVaultDockStore`와 `WorkspaceRegistry`다.

## 3. Workspace / Pane / Tab 렌더링

```mermaid
flowchart TB
  AppWorkspace["AppWorkspaceView"]
  Sidebar["AppSidebar<br/>Files / Search / Outline / Tags"]
  Header["WorkspaceHeader"]
  Root["WorkspaceRoot"]
  Single["SinglePaneDropTarget"]
  Split["SplitNode 재귀 렌더"]
  Pane["Pane"]
  ActivePane["Active Pane<br/>TabBar + active content"]
  InactivePane["Inactive Pane<br/>Mini tab strip + read/edit surface"]
  TabBar["TabBar"]
  Body{"Active tab kind / path"}
  Terminal["TerminalView"]
  Image["ImageViewer"]
  Editor["EditorView"]
  Empty["EmptyPanePlaceholder"]
  Status["StatusBar"]

  AppWorkspace --> Sidebar
  AppWorkspace --> Header
  AppWorkspace --> Root
  AppWorkspace --> Status

  Root -->|workspaceTree == null| Single
  Root -->|workspaceTree exists| Split
  Split --> Pane
  Pane -->|isActive| ActivePane
  Pane -->|inactive| InactivePane

  ActivePane --> TabBar
  ActivePane --> Body
  Body -->|terminal tab| Terminal
  Body -->|image path| Image
  Body -->|markdown/text path| Editor
  Body -->|no path| Empty
```

터미널은 독립 패널이 아니라 `Tab.kind = "terminal"`인 탭이다. 그래서 일반 문서 탭과 동일하게 split, close, tab strip 흐름을 공유한다.

## 4. 파일 열기와 에디터 로딩

```mermaid
sequenceDiagram
  participant Tree as FileTree / QuickOpen
  participant Tabs as TabSlice
  participant EditorSlice as EditorSlice
  participant IPC as ipc.readFile
  participant Rust as read_file command
  participant Editor as EditorView / Tiptap
  participant Recent as RecentSlice

  Tree->>Tabs: openTab(path)
  Tabs->>Tabs: 기존 탭 검색

  alt 이미 열린 탭
    Tabs->>Tabs: activeId 변경
  else 새 탭
    Tabs->>Tabs: tabs append + activeId 설정
  end

  Tabs->>EditorSlice: flushSave()
  Tabs->>EditorSlice: openFile(path)
  EditorSlice->>IPC: readFile(path)
  IPC->>Rust: read_file(relPath, vaultId)
  Rust-->>IPC: FileContent
  IPC-->>EditorSlice: content + modified timestamp
  EditorSlice->>Editor: currentPath / content 갱신
  Editor->>Editor: createEditorExtensions()
  Editor->>Recent: push(path)
```

탭 전환은 먼저 현재 에디터의 pending save를 flush한 뒤 다음 파일을 연다. 터미널 탭으로 전환할 때는 `closeEditorFile()`로 에디터 상태를 비운다.

## 5. 자동 저장과 충돌 처리

```mermaid
sequenceDiagram
  participant User as 사용자
  participant Tiptap as EditorView / Tiptap
  participant AutoSave as useAutoSave
  participant EditorSlice as EditorSlice
  participant IPC as ipc.writeFile
  participant Rust as write_file command
  participant Disk as Vault file
  participant Conflict as ConflictDialog

  User->>Tiptap: 문서 편집
  Tiptap->>AutoSave: onUpdate
  AutoSave->>AutoSave: 750ms debounce
  AutoSave->>EditorSlice: save(content, expectedModified)
  EditorSlice->>IPC: writeFile(path, content, expectedModified)
  IPC->>Rust: write_file()
  Rust->>Disk: expected modified 검증

  alt 디스크가 그대로임
    Rust->>Disk: backup previous + atomic write
    Rust-->>EditorSlice: WriteResult(saved)
    EditorSlice->>Tiptap: saved 상태 반영
  else 외부 변경 감지
    Rust-->>EditorSlice: conflict
    EditorSlice->>Conflict: conflict state 설정
    Conflict-->>User: reload / overwrite 선택
  end
```

저장은 파일당 pending save를 제한하고, blur 시 즉시 flush한다. Rust 쪽은 쓰기 전 backup과 atomic write를 담당한다.

## 6. Markdown 에디터 확장 구조

```mermaid
flowchart LR
  EditorView["EditorView"]
  Extensions["createEditorExtensions()"]
  Starter["StarterKit<br/>codeBlock/hr disabled"]
  Blocks["Custom block nodes<br/>HR / CodeBlock / Image / Math / Footnote"]
  Marks["Marks<br/>Link / Underline / Highlight / Wikilink"]
  Menus["Menus<br/>Slash / Bubble / Table / Block"]
  Plugins["PM plugins<br/>SearchHighlight / SelectionVisibility / Shortcuts"]
  Markdown["tiptap-markdown<br/>GFM round-trip"]
  Mermaid["Mermaid preview<br/>language == mermaid"]

  EditorView --> Extensions
  Extensions --> Starter
  Extensions --> Blocks
  Extensions --> Marks
  Extensions --> Menus
  Extensions --> Plugins
  Extensions --> Markdown
  Blocks --> Mermaid
```

Mermaid는 별도 Markdown 문법이 아니라 기존 `codeBlock`의 `language`가 `mermaid`일 때 NodeView에서 preview를 붙이는 방식이다. 따라서 저장 포맷은 표준 fenced code block으로 유지된다.

## 7. Mermaid 블록 동작

```mermaid
stateDiagram-v2
  [*] --> CodeBlock
  CodeBlock --> MermaidBlock: language token == "mermaid"
  CodeBlock --> PlainCodeBlock: other language

  MermaidBlock --> EditMode: 삽입 직후 / 더블클릭 / 편집 버튼
  EditMode --> PreviewMode: blur 또는 커서가 블록 밖으로 이동
  PreviewMode --> EditMode: 더블클릭 또는 편집 버튼
  PreviewMode --> RenderError: Mermaid parse/render 실패
  RenderError --> EditMode: 편집 버튼
  EditMode --> PreviewMode: 수정 후 블록 밖 이동
```

Slash command의 Mermaid 항목은 `setCodeBlock({ language: "mermaid" })`로 시작하고, 기본 예제를 삽입한다.

## 8. 터미널 탭 동작

```mermaid
sequenceDiagram
  participant Header as WorkspaceHeader
  participant Tabs as TabSlice
  participant Terminal as TerminalView
  participant Xterm as xterm.js
  participant WebIPC as terminal_* IPC
  participant PTY as portable-pty

  Header->>Tabs: openTerminalTab()
  Tabs->>Tabs: kind="terminal" 탭 생성
  Tabs->>Terminal: active tab body로 렌더

  Terminal->>Xterm: mount renderer
  Terminal->>Xterm: fit cols/rows
  Terminal->>WebIPC: terminalSpawn(cols, rows, vaultId)
  WebIPC->>PTY: cwd = active vault root로 shell spawn
  PTY-->>Terminal: terminal:data event
  Terminal->>Xterm: write output
  Xterm-->>Terminal: input / resize
  Terminal->>WebIPC: terminalWrite(input)
  Terminal->>WebIPC: terminalResize(cols, rows)
  WebIPC->>PTY: stdin write / resize
  PTY-->>Terminal: terminal:exit event

  Terminal->>Tabs: onExited() -> closeTab()
  Tabs->>WebIPC: terminalKill
```

터미널은 Web UI 내부의 `@xterm/xterm` renderer와 Rust `portable-pty` session을 사용한다. 터미널 session은 workspace persistence에 저장하지 않는다.

## 9. 이미지 파일 열기

```mermaid
flowchart TB
  Open["openTab(path)"]
  Active["active tab path"]
  Kind{"isImagePath(path)?"}
  ImageViewer["ImageViewer"]
  EditorView["EditorView"]
  IPC["ipc.absPath / getThumbnail"]
  Tauri["Tauri asset URL<br/>convertFileSrc"]
  UI["zoom / fit / actual size"]

  Open --> Active
  Active --> Kind
  Kind -->|yes| ImageViewer
  Kind -->|no| EditorView
  ImageViewer --> IPC
  IPC --> Tauri
  ImageViewer --> UI
```

이미지 뷰어도 별도 앱 모드가 아니라 문서 탭의 body 분기다. 같은 탭/분할 레이아웃 정책을 그대로 사용한다.

## 10. 상태와 저장 위치

```mermaid
flowchart TB
  subgraph Frontend["Frontend state"]
    VaultDock["useVaultDockStore<br/>열린 vault / active vault"]
    WorkspaceRegistry["WorkspaceRegistry<br/>vaultId -> store"]
    WorkspaceStore["WorkspaceStore<br/>tabs / editor / search / tags / backlinks / recent / properties / split tree"]
    SettingsStore["useSettingsStore<br/>global + vault override"]
  end

  subgraph Backend["Backend persistence"]
    GlobalRegistry["app config / munix.json<br/>vault registry"]
    WorkspaceJson["vault/.munix/workspace.json<br/>tabs + split + file tree expanded"]
    VaultSettings["vault/.munix/settings.json<br/>vault override"]
    ObsidianTypes["vault/.obsidian/types.json<br/>property types"]
    MarkdownFiles["vault/**/*.md<br/>사용자 문서"]
    Assets["vault/assets/*<br/>붙여넣은 이미지"]
  end

  VaultDock --> GlobalRegistry
  WorkspaceRegistry --> WorkspaceStore
  WorkspaceStore --> WorkspaceJson
  SettingsStore --> VaultSettings
  WorkspaceStore --> ObsidianTypes
  WorkspaceStore --> MarkdownFiles
  WorkspaceStore --> Assets
```

앱 전용 데이터는 `.munix/`와 일부 Obsidian 호환 파일에만 저장한다. 사용자 Markdown 원문은 표준 GFM을 유지한다.

## 11. 주요 사용자 액션별 라우팅

```mermaid
flowchart LR
  FileCreate["새 파일"]
  FileRename["이름 변경"]
  FileDelete["삭제"]
  Search["검색 선택"]
  Command["Command Palette"]
  Sidebar["Sidebar"]
  Hooks["app hooks<br/>useFile*Actions / useGlobalShortcuts"]
  Store["WorkspaceStore slices"]
  IPC["ipc.ts"]
  Rust["Tauri commands"]

  FileCreate --> Hooks
  FileRename --> Hooks
  FileDelete --> Hooks
  Search --> Sidebar
  Command --> Hooks
  Sidebar --> Hooks
  Hooks --> Store
  Hooks --> IPC
  Store --> IPC
  IPC --> Rust
```

`App`은 화면과 전역 액션을 조립하는 orchestration layer다. 실제 파일 생성/삭제/이동/이름 변경은 `hooks/app/*`에 분리되어 있고, 최종 파일 작업은 IPC로 내려간다.

## 12. 한 줄 요약

```mermaid
flowchart LR
  A["Vault 선택"] --> B["vault별 workspace store 생성/복원"]
  B --> C["Sidebar / Workspace / Tabs 렌더"]
  C --> D{"Tab body"}
  D --> E["Markdown Editor"]
  D --> F["Image Viewer"]
  D --> G["Terminal"]
  E --> H["Auto-save via Rust Vault FS"]
  F --> I["Tauri asset URL"]
  G --> J["PTY session"]
  H --> K["Local-first .md vault"]
  I --> K
  J --> K
```

Munix는 “vault 단위 workspace 상태 + 표준 Markdown 파일 + Tauri IPC로 보호된 로컬 FS” 구조로 동작한다.
