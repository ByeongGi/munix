# Munix 앱 런타임 구조

> 구현 기준: `munix/src`, `munix/src-tauri/src`
> 목적: Munix의 프론트, Rust 백엔드, 터미널 런타임 경계를 한 번에 파악하기 위한 문서.

## 1. 구조 요약

Munix는 Tauri 2 앱이다. UI와 workspace orchestration은 React가 맡고, 파일 시스템과 OS 자원 접근은 Rust command layer가 맡는다. 터미널은 Web UI 안의 xterm.js renderer와 Rust `portable-pty` backend로 통합한다.

```mermaid
flowchart TB
  User["User"]
  React["React UI<br/>munix/src"]
  Store["Zustand stores<br/>workspace / vault / settings"]
  Ipc["IPC facade<br/>src/lib/ipc.ts"]
  Rust["Tauri command layer<br/>src-tauri/src/commands"]
  VaultManager["VaultManager<br/>multi-vault routing"]
  VaultFs["Vault FS<br/>path validation / atomic write / backup"]
  Terminal["Terminal<br/>xterm.js + portable-pty"]
  Disk["Local filesystem<br/>.md / assets / .munix"]

  User --> React
  React --> Store
  Store --> Ipc
  React --> Ipc
  Ipc --> Rust
  Rust --> VaultManager
  VaultManager --> VaultFs
  VaultFs --> Disk
  React --> Terminal
  Rust --> Terminal
```

핵심 경계:

- React는 로컬 파일 시스템에 직접 접근하지 않는다.
- vault 파일 작업은 항상 `ipc.ts` -> Tauri command -> Rust vault layer를 지난다.
- workspace 상태는 vault별 Zustand store에 둔다.
- terminal tab은 문서 탭과 같은 workspace/pane 시스템을 공유한다.
- terminal renderer는 Web compositor 안에 있으므로 context menu, palette, modal, DevTools와 같은 overlay 계층과 CSS z-index를 공유한다.

## 2. 프론트 계층

```mermaid
flowchart TB
  Main["main.tsx<br/>i18n / settings / vault bootstrap"]
  Root["root.tsx<br/>ErrorBoundary / ActiveVaultProvider"]
  App["app.tsx<br/>global orchestration"]
  Shell["components/app-shell<br/>titlebar / sidebar / workspace"]
  Workspace["components/workspace<br/>pane / split / active body"]
  Feature["components/*<br/>editor / file-tree / palette / settings / terminal"]
  Store["store/*<br/>vault dock / workspace registry / slices"]
  Lib["lib/*<br/>ipc / markdown / indexes / i18n"]

  Main --> Root
  Root --> App
  App --> Shell
  Shell --> Workspace
  Workspace --> Feature
  Feature --> Store
  App --> Store
  Store --> Lib
  Feature --> Lib
```

프론트의 책임:

- 앱 부팅 전에 `bootstrapVaultRegistry()`로 글로벌 vault registry를 복원한다.
- active vault는 `ActiveVaultProvider`와 `useVaultDockStore`가 제공한다.
- 파일, 검색, 탭, 최근 목록, workspace split 상태는 vault별 workspace store에 둔다.
- `lib/ipc.ts`는 Tauri command 이름을 프론트 코드에서 직접 흩뿌리지 않기 위한 typed facade다.

## 3. Rust 백엔드 계층

```mermaid
flowchart TB
  Commands["commands/*"]
  AppState["AppState"]
  VaultManager["VaultManager<br/>VaultId -> VaultState"]
  Vault["Vault<br/>root / path safety / read-write"]
  Watcher["Watcher<br/>self-write suppression"]
  Settings["settings.rs / vault_registry.rs"]
  Terminal["terminal.rs<br/>portable-pty sessions"]
  Fs["Local filesystem"]

  Commands --> AppState
  AppState --> VaultManager
  VaultManager --> Vault
  Vault --> Fs
  VaultManager --> Watcher
  Settings --> Fs
  Commands --> Terminal
```

Rust의 책임:

- vault root 기준 상대 경로만 IPC로 받는다.
- path traversal과 vault 밖 접근을 차단한다.
- 저장은 원자적 쓰기와 백업 정책을 따른다.
- global registry는 OS별 `app_config_dir()` 아래 `munix.json`에 저장한다.
- workspace 상태는 vault별 `.munix/workspace.json`에 저장한다.
- terminal에서는 `portable-pty` session을 spawn/write/resize/kill 한다.

## 4. Vault와 Workspace

```mermaid
flowchart LR
  GlobalRegistry["Global registry<br/>app_config_dir/munix.json"]
  VaultDock["Vault Dock Store"]
  VaultManager["Rust VaultManager"]
  VaultA["Vault A<br/>root/.munix/workspace.json"]
  VaultB["Vault B<br/>root/.munix/workspace.json"]
  WorkspaceA["Workspace Store A"]
  WorkspaceB["Workspace Store B"]

  GlobalRegistry --> VaultDock
  VaultDock --> VaultManager
  VaultManager --> VaultA
  VaultManager --> VaultB
  VaultA --> WorkspaceA
  VaultB --> WorkspaceB
```

운영 원칙:

- 여러 vault를 동시에 열 수 있다.
- active vault 전환은 left vault dock에서 일어난다.
- 각 vault는 독립 workspace tree, tab, recent/search 상태를 가진다.
- terminal session은 workspace persistence에 저장하지 않는다. 앱 재시작 시 shell session을 복원하지 않는다.

## 5. Terminal Runtime

```mermaid
flowchart TB
  TerminalView["TerminalView<br/>@xterm/xterm"]
  Fit["FitAddon<br/>cols/rows"]
  Links["WebLinksAddon"]
  ScreenState["terminal-session-registry<br/>headless serialize cache"]
  IPC["terminal_* IPC"]
  Pty["portable-pty<br/>OS shell"]
  Events["terminal:data / terminal:exit"]

  TerminalView --> Fit
  TerminalView --> Links
  TerminalView --> ScreenState
  TerminalView --> IPC
  IPC --> Pty
  Pty --> Events
  Events --> TerminalView
```

현재 정책:

- macOS/Windows/Linux 모두 `@xterm/xterm + portable-pty`를 기본 제품 경로로 사용한다.
- `ghostty-web`, native `libghostty`, macOS child `NSView` embed는 제거했다.
- `terminal_spawn`, `terminal_write`, `terminal_resize`, `terminal_kill`만 terminal IPC로 유지한다.
- xterm.js renderer가 DOM 내부에 있으므로 overlay와 DevTools resize 문제를 native view 격리 없이 해결한다.

## 6. Platform Matrix

| Platform | Primary terminal runtime | Notes |
|---|---|---|
| macOS | `@xterm/xterm + portable-pty` | Web overlay와 같은 compositor 사용 |
| Windows | `@xterm/xterm + portable-pty` | 동일 구조 |
| Linux | `@xterm/xterm + portable-pty` | 동일 구조 |

## 7. Build Flow

```mermaid
flowchart TB
  Pnpm["pnpm tauri dev/build"]
  Tauri["Tauri CLI"]
  Frontend["Vite + React"]
  Rust["Cargo build"]

  Pnpm --> Tauri
  Tauri --> Frontend
  Tauri --> Rust
```

빌드 원칙:

- Ghostty source, Zig, Swift bridge, `native-libghostty` feature를 요구하지 않는다.
- `pnpm tauri dev`와 `pnpm tauri build`는 기본 Tauri CLI 경로를 사용한다.

## 8. 관련 문서

- [client-frontend-architecture.md](./client-frontend-architecture.md): React 클라이언트 구조
- [app-architecture-mermaid.md](./app-architecture-mermaid.md): 주요 사용자 흐름 다이어그램
- [specs/terminal-spec.md](./specs/terminal-spec.md): 터미널 상세 설계
- [specs/multi-vault-spec.md](./specs/multi-vault-spec.md): 멀티 vault workspace 설계
- [specs/vault-spec.md](./specs/vault-spec.md): vault FS와 IPC 보안 설계
- [decisions.md](./decisions.md): ADR 기록
