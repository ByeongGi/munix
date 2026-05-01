# Munix 클라이언트 프론트 구조

> 구현 기준: `munix/src`
> 목적: React 클라이언트의 책임 경계, 디렉터리 구조, 상태 흐름, 주요 UI 조립 방식을 빠르게 파악하기 위한 문서.

## 1. 구조 요약

Munix 프론트는 `main.tsx -> Root -> App -> AppWorkspaceView` 순서로 부팅되고, 화면은 `app-shell`, 기능은 `components/*`, 상태는 `store/*`, 백엔드 통신은 `lib/ipc.ts`를 중심으로 나뉜다.

```mermaid
flowchart TB
  Main["main.tsx<br/>i18n / settings sync / vault bootstrap"]
  Root["root.tsx<br/>ErrorBoundary<br/>ActiveVaultProvider"]
  App["app.tsx<br/>전역 오케스트레이션"]
  Shell["components/app-shell<br/>TitleBar / Sidebar / Workspace"]
  FeatureComponents["components/*<br/>editor / file-tree / tab / palette / settings"]
  Hooks["hooks/app/*<br/>파일 액션 / 단축키 / sidebar 상태"]
  Stores["store/*<br/>Zustand stores + vault별 workspace registry"]
  Lib["lib/*<br/>ipc / markdown / index / i18n / utils"]
  Tauri["Tauri IPC commands<br/>Rust backend"]

  Main --> Root
  Root --> App
  App --> Shell
  App --> Hooks
  Shell --> FeatureComponents
  FeatureComponents --> Stores
  Hooks --> Stores
  Hooks --> Lib
  Stores --> Lib
  Lib --> Tauri
```

핵심 원칙은 다음과 같다.

- `App`은 전역 상태와 액션을 연결하는 조립 계층이다.
- 화면 골격은 `components/app-shell`이 담당한다.
- 에디터, 파일 트리, 탭, 팔레트, 설정은 독립 기능 폴더로 분리한다.
- vault 파일 I/O는 프론트에서 직접 하지 않고 항상 `lib/ipc.ts`를 거친다.
- 문서/검색/탭/최근 목록 같은 작업 상태는 active vault 기준 workspace store에 둔다.

## 2. 디렉터리 맵

```mermaid
flowchart LR
  Src["munix/src"]

  Src --> Entry["entry<br/>main.tsx<br/>root.tsx<br/>app.tsx"]
  Src --> Components["components"]
  Src --> Store["store"]
  Src --> Hooks["hooks"]
  Src --> Lib["lib"]
  Src --> Types["types"]
  Src --> Styles["index.css"]

  Components --> AppShell["app-shell<br/>앱 레이아웃"]
  Components --> Editor["editor<br/>Tiptap editor + 확장"]
  Components --> FileTree["file-tree<br/>vault 파일 목록"]
  Components --> Workspace["workspace<br/>split pane"]
  Components --> Tab["tab<br/>tab bar / drag / context menu"]
  Components --> Palette["palette<br/>quick open / command palette"]
  Components --> Settings["settings<br/>settings dialog"]
  Components --> Viewers["image-viewer / terminal<br/>탭 body 뷰어"]
  Components --> Ui["ui<br/>공통 UI primitive"]

  Store --> Registry["workspace-registry.ts<br/>vaultId -> workspace store"]
  Store --> VaultDock["vault-dock-store.ts<br/>열린 vault / active vault"]
  Store --> VaultCompat["vault-store.ts<br/>단일 vault 호환 wrapper"]
  Store --> SettingsStore["settings-store.ts<br/>전역 설정"]
  Store --> Slices["slices/*<br/>editor / tab / search / tags / recent"]

  Hooks --> AppHooks["app/*<br/>전역 액션 hook"]
  Hooks --> RuntimeHooks["use-auto-save.ts<br/>use-vault-watcher.ts<br/>use-keymap.ts"]

  Lib --> Ipc["ipc.ts"]
  Lib --> Markdown["markdown.ts<br/>editor-preprocess.ts"]
  Lib --> Indexes["search-index.ts<br/>tag-index.ts<br/>backlink-index.ts"]
  Lib --> Utilities["cn.ts<br/>i18n.ts<br/>path utils"]
```

## 3. 부팅 흐름

`main.tsx`는 렌더 전에 앱 수준 초기화를 끝낸다. 특히 `bootstrapVaultRegistry()`를 먼저 실행해 `munix.json`의 열린 vault 상태를 복원한 뒤 React를 렌더한다.

```mermaid
sequenceDiagram
  participant Main as main.tsx
  participant I18n as i18n
  participant Settings as useSettingsStore
  participant Registry as bootstrapVaultRegistry
  participant React as ReactDOM
  participant Root as Root
  participant App as App

  Main->>I18n: setupI18n()
  Main->>Settings: language 구독
  Main->>Registry: await bootstrapVaultRegistry()
  Registry-->>Main: 열린 vault 복원 완료
  Main->>React: createRoot(...).render()
  React->>Root: ErrorBoundary + ActiveVaultProvider
  Root->>App: active vault context 제공
```

## 4. 화면 조립 구조

`App`은 vault가 없으면 `VaultPicker`만 보여주고, active vault가 있으면 `AppWorkspaceView`를 렌더한다. 실제 작업 화면은 `AppWorkspaceView`에서 `AppTitleBar`, `AppSidebar`, `WorkspaceHeader`, `WorkspaceRoot`, `TabBar`, 탭 body, `StatusBar`로 조립된다.

```mermaid
flowchart TB
  App["App"]
  HasVault{"active vault info?"}
  Picker["VaultPicker"]
  WorkspaceView["AppWorkspaceView"]

  TitleBar["AppTitleBar"]
  Sidebar["AppSidebar"]
  Header["WorkspaceHeader"]
  Root["WorkspaceRoot"]
  TabBar["TabBar"]
  Body{"active tab body"}
  Status["StatusBar"]
  Overlays["Overlays<br/>QuickOpen / VaultSwitcher / CommandPalette<br/>Settings / Shortcuts / ConflictDialog"]

  App --> HasVault
  HasVault -->|no| Picker
  HasVault -->|yes| WorkspaceView
  App --> Overlays

  WorkspaceView --> TitleBar
  WorkspaceView --> Sidebar
  WorkspaceView --> Header
  WorkspaceView --> Root
  WorkspaceView --> Status
  Root --> TabBar
  Root --> Body
  Body -->|terminal tab| Terminal["TerminalView"]
  Body -->|image path| Image["ImageViewer"]
  Body -->|markdown/text path| Editor["EditorView"]
  Body -->|empty| Empty["EmptyPanePlaceholder"]
```

## 5. Sidebar 구조

Sidebar는 vault dock과 네 개의 탭으로 구성된다. 파일 관련 액션은 sidebar 내부에서 직접 IPC를 호출하지 않고, `App`에서 주입한 handler를 호출한다.

```mermaid
flowchart TB
  Sidebar["AppSidebar"]
  Dock["VaultDock"]
  Tabs["Sidebar tab buttons"]
  Panel{"sidebarTab"}
  Footer["Settings button"]
  Resize["SidebarResizer"]

  Sidebar --> Dock
  Sidebar --> Tabs
  Sidebar --> Panel
  Sidebar --> Footer
  Sidebar --> Resize

  Panel -->|files| FileList["FileList"]
  Panel -->|search| SearchPanel["SearchPanel"]
  Panel -->|outline| OutlinePanel["OutlinePanel"]
  Panel -->|tags| TagPanel["TagPanel"]

  FileList --> FileHandlers["App 주입 handler<br/>create / rename / delete / move / reveal"]
  SearchPanel --> SearchSelect["onSearchSelect<br/>openTab + pending search jump"]
```

## 6. 상태 구조

전역 vault 목록은 `useVaultDockStore`가 관리하고, active vault의 작업 상태는 `WorkspaceRegistry`가 `vaultId`별 Zustand store로 관리한다. `useVaultStore`는 단일 vault 시절 API 호환을 위한 캐시 wrapper다.

```mermaid
flowchart TB
  subgraph Global["전역 상태"]
    Dock["useVaultDockStore<br/>vaults / activeVaultId / dock visible"]
    Settings["useSettingsStore<br/>global settings"]
    Theme["useThemeStore"]
  end

  subgraph PerVault["vault별 workspace 상태"]
    Registry["WorkspaceRegistry<br/>Map<vaultId, WorkspaceStore>"]
    WorkspaceStore["WorkspaceStore"]
    EditorSlice["editor-slice<br/>currentPath / content / save state"]
    TabSlice["tab-slice<br/>tabs / activeId / terminal tabs"]
    TreeSlice["workspace-tree-slice<br/>split panes"]
    SearchSlice["search-slice"]
    TagSlice["tags-slice"]
    BacklinkSlice["backlinks-slice"]
    RecentSlice["recent-slice"]
    PropertySlice["property-types-slice"]
  end

  Compat["useVaultStore<br/>active vault info/files cache"]

  Dock --> Registry
  Dock --> Compat
  Registry --> WorkspaceStore
  WorkspaceStore --> EditorSlice
  WorkspaceStore --> TabSlice
  WorkspaceStore --> TreeSlice
  WorkspaceStore --> SearchSlice
  WorkspaceStore --> TagSlice
  WorkspaceStore --> BacklinkSlice
  WorkspaceStore --> RecentSlice
  WorkspaceStore --> PropertySlice
```

영구화 위치는 다음처럼 나뉜다.

- `munix.json`: 글로벌 vault registry
- `vault/.munix/workspace.json`: 탭, active tab, split tree, 파일 트리 펼침 상태
- `vault/.munix/settings.json`: vault별 설정 override
- `vault/.obsidian/types.json`: Obsidian 호환 property type
- `vault/**/*.md`: 사용자 Markdown 문서

## 7. 주요 액션 흐름

파일 생성, 삭제, 이동, 이름 변경 같은 액션은 `App`에서 `hooks/app/*`로 분리되어 있다. UI 컴포넌트는 handler만 호출하고, hook이 store와 IPC를 조율한다.

```mermaid
flowchart LR
  UI["UI event<br/>FileList / Palette / Shortcut / Header"]
  App["App<br/>handler wiring"]
  Hooks["hooks/app/*"]
  Store["Workspace/Vault stores"]
  IPC["lib/ipc.ts"]
  Backend["Tauri command"]
  Refresh["refreshFiles / update tabs / reveal"]

  UI --> App
  App --> Hooks
  Hooks --> Store
  Hooks --> IPC
  IPC --> Backend
  Backend --> IPC
  IPC --> Hooks
  Hooks --> Refresh
  Refresh --> Store
```

## 8. 파일 열기 흐름

문서를 여는 진입점은 여러 개지만 결국 `openTab(path)`로 모인다. active tab이 바뀌면 editor slice가 파일을 읽고 `EditorView`가 Tiptap 인스턴스로 렌더한다.

```mermaid
sequenceDiagram
  participant User as 사용자
  participant Entry as FileTree / QuickOpen / SearchPanel
  participant Tab as tab-slice
  participant Editor as editor-slice
  participant IPC as ipc.readFile
  participant View as EditorView
  participant Recent as recent-slice

  User->>Entry: 파일 선택
  Entry->>Tab: openTab(path)
  Tab->>Tab: 기존 탭 재사용 또는 새 탭 생성
  Tab->>Editor: openFile(path)
  Editor->>IPC: readFile(path, vaultId?)
  IPC-->>Editor: content + modified
  Editor-->>View: currentPath/content/saveState 갱신
  View->>View: Tiptap extensions 구성
  Editor->>Recent: push(path)
```

## 9. Editor 하위 구조

`components/editor`는 Tiptap 기반 편집기와 Markdown 호환 확장을 모은다. `extensions.ts`가 확장 조립 지점이고, 저장은 `useAutoSave`와 editor slice를 통해 IPC로 내려간다.

```mermaid
flowchart TB
  EditorView["EditorView"]
  Extensions["extensions.ts<br/>createEditorExtensions"]
  NodeViews["NodeViews<br/>code block / image / math / footnote"]
  Menus["Menus<br/>slash / bubble / block / table"]
  Frontmatter["frontmatter/properties<br/>properties panel + widgets"]
  Plugins["ProseMirror plugins<br/>shortcuts / search highlight / selection"]
  Markdown["markdown round-trip<br/>@tiptap/markdown"]
  AutoSave["useAutoSave"]
  Store["editor-slice"]
  IPC["ipc.writeFile"]

  EditorView --> Extensions
  Extensions --> NodeViews
  Extensions --> Menus
  Extensions --> Frontmatter
  Extensions --> Plugins
  Extensions --> Markdown
  EditorView --> AutoSave
  AutoSave --> Store
  Store --> IPC
```

## 10. IPC 경계

프론트의 백엔드 호출은 `lib/ipc.ts`에 모아져 있다. 컴포넌트가 직접 `invoke()`를 흩뿌리지 않고, `ipc.*` 메서드 또는 그 위의 hook/store 액션을 사용한다.

```mermaid
flowchart TB
  Components["components"]
  AppHooks["hooks/app"]
  Stores["store slices"]
  IpcFacade["lib/ipc.ts<br/>typed invoke facade"]
  Tauri["Rust Tauri commands"]

  Components --> AppHooks
  Components --> Stores
  AppHooks --> IpcFacade
  Stores --> IpcFacade
  IpcFacade --> Tauri
```

대표 IPC 그룹은 다음과 같다.

- Vault: `openVault`, `closeVault`, `listOpenVaults`, `setActiveVault`
- File: `listFiles`, `readFile`, `writeFile`, `createFile`, `renameEntry`, `deleteEntry`
- Workspace: `workspaceLoad`, `workspaceSave`
- Settings: `loadSettings`, `saveSettings`, `vaultSettingsLoad`, `vaultSettingsSave`
- Asset/Image: `saveAsset`, `absPath`, `getThumbnail`
- Terminal: `terminalSpawn`, `terminalWrite`, `terminalResize`, `terminalKill`

## 11. 작업 시 기준

- 새 화면 골격은 `components/app-shell` 또는 `components/workspace`에 둔다.
- 특정 기능 UI는 `components/{feature}` 아래에 둔다.
- 파일 액션처럼 여러 UI에서 공유되는 앱 액션은 `hooks/app`에 둔다.
- vault별 작업 상태는 가능한 한 workspace slice로 넣는다.
- 전역 설정이나 앱 전체 상태만 독립 store로 둔다.
- Rust 호출이 필요하면 `lib/ipc.ts`에 typed facade를 먼저 추가한다.
- 신규 UI 텍스트는 하드코딩하지 않고 `t()`를 사용한다.
