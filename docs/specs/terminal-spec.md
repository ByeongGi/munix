# Terminal 상세 설계 — Munix

> 상태: **ADR-034 적용 / xterm.js + portable-pty 채택**.
> `ghostty-web`과 native `libghostty` embed 경로는 제거했다.

---

## 1. 목적

- vault 안에서 git/build/grep/test 같은 셸 작업을 노트 작성 흐름과 같은 workspace에서 처리한다.
- 문서 탭, 이미지 탭과 같은 방식으로 터미널을 열고 닫고 이동하고 split 할 수 있게 한다.
- 컨텍스트 메뉴, command palette, modal, DevTools가 터미널 위에 정상적으로 올라오도록 Web compositor 안에서 렌더링한다.
- 플랫폼별 native view embed, Swift/AppKit bridge, Zig/Ghostty 빌드 파이프라인 없이 macOS/Windows/Linux에서 같은 구조로 동작한다.

## 2. 최종 구조

| 영역 | 선택 |
|---|---|
| Renderer | `@xterm/xterm` |
| Addons | `@xterm/addon-fit`, `@xterm/addon-web-links`, `@xterm/addon-serialize` |
| PTY backend | Rust `portable-pty` |
| IPC | Tauri command + event |
| Workspace 통합 | `Tab.kind = "terminal"` |
| 기본 cwd | active vault root |
| 세션 생명주기 | terminal tab id 기준 registry 관리 |
| Split 지원 | 기존 workspace split/pane 시스템 재사용 |

렌더러는 React DOM 내부에 mount한다. 터미널은 더 이상 native child view가 아니므로 CSS z-index, Radix overlay, context menu, command palette, DevTools 레이아웃과 같은 Web UI 계층에 자연스럽게 포함된다.

## 3. 요구사항

| ID | 요구사항 | 우선순위 | 상태 |
|---|---|---|---|
| TRM-01 | 터미널은 현재 active vault root를 cwd로 열려야 한다 | P0 | 구현 |
| TRM-02 | 터미널은 workspace tab의 한 종류여야 한다 | P0 | 구현 |
| TRM-03 | 여러 터미널 탭을 열 수 있어야 한다 | P0 | 구현 |
| TRM-04 | workspace split 기능으로 터미널 탭을 분할 배치할 수 있어야 한다 | P0 | 구현 |
| TRM-05 | 키 입력, 제어키, 조합키가 PTY로 전달되어 shell completion이 동작해야 한다 | P0 | 구현 |
| TRM-06 | terminal resize 시 xterm cols/rows와 PTY size가 동기화되어야 한다 | P0 | 구현 |
| TRM-07 | 터미널 탭을 닫으면 연결된 PTY session도 종료해야 한다 | P0 | 구현 |
| TRM-08 | 터미널 탭 전환 시 session이 즉시 죽지 않아야 한다 | P0 | 구현 |
| TRM-09 | shell exit 시 탭은 유지하고 종료 상태를 표시해야 한다 | P1 | 구현 |
| TRM-10 | `Ctrl/Cmd` + `+`, `-`, `0`으로 터미널 폰트 크기를 조절할 수 있어야 한다 | P1 | 구현 |
| TRM-11 | URL 클릭 액션을 지원해야 한다 | P2 | 구현 |
| TRM-12 | 셸 프로필(zsh/bash/fish/pwsh)을 선택할 수 있어야 한다 | P2 | 미구현 |
| TRM-13 | 터미널 scrollback 검색을 지원해야 한다 | P2 | 미구현 |

## 4. UX 정책

- 터미널은 `kind: "terminal"`인 workspace tab이다.
- 터미널 tab의 `path`는 빈 문자열이며 파일 rename/delete 동기화 대상에서 제외한다.
- 터미널 tab은 dirty 상태를 갖지 않는다.
- 터미널 tab은 기존 tab DnD, close, close others, close after, pin, split 동작을 재사용한다.
- terminal focus 중 문자 입력, `Tab`, `Ctrl+C`, `Ctrl+D`, 방향키, Home/End/PageUp/PageDown은 xterm.js가 처리하고 PTY로 전달한다.
- 앱 레벨 폰트 확대/축소와 충돌하지 않도록 terminal viewport capture 단계에서 `Ctrl/Cmd + +/-/0`을 terminal font size 조정으로 처리한다.

기본 font-family:

```css
"JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font",
"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace
```

## 5. 데이터 모델

```ts
type TabKind = "document" | "terminal";

interface Tab {
  id: string;
  kind?: TabKind;
  path: string;
  title: string;
  titleDraft?: string;
  pinned?: boolean;
}
```

터미널 session은 workspace persistence에 저장하지 않는다. 앱 재시작 시 stale shell/session을 복원하지 않는다.

```ts
const terminalSessionsByTabId = new Map<string, string>();

function getTerminalSessionId(tabId: string): string | null;
function setTerminalSessionId(tabId: string, sessionId: string): void;
function closeTerminalSessionForTab(tabId: string): void;
function closeTerminalSessionsForTabs(tabs: { id: string; kind?: string }[]): void;
```

## 6. IPC

프론트는 `src/lib/ipc.ts`의 typed facade만 사용한다.

```ts
terminalSpawn(cols: number, rows: number, vaultId?: string): Promise<{ id: string }>;
terminalWrite(id: string, data: string): Promise<void>;
terminalResize(id: string, cols: number, rows: number): Promise<void>;
terminalKill(id: string): Promise<void>;
```

Tauri event:

```ts
interface TerminalDataPayload {
  id: string;
  data: string;
}

interface TerminalExitPayload {
  id: string;
}
```

Rust backend:

```rust
struct TerminalSession {
  child: Box<dyn portable_pty::Child + Send>,
  writer: Box<dyn Write + Send>,
  pty: Box<dyn portable_pty::MasterPty + Send>,
}

struct TerminalManager {
  sessions: Mutex<HashMap<String, TerminalSession>>,
}
```

## 7. 구현 파일

- `munix/src/components/terminal/terminal-view.tsx`: xterm.js renderer, fit, web links, font zoom, PTY event binding.
- `munix/src/lib/terminal-session-registry.ts`: tab id와 PTY session id 매핑, screen state cache, close lifecycle.
- `munix/src-tauri/src/commands/terminal.rs`: `portable-pty` spawn/write/resize/kill 및 `terminal:data`, `terminal:exit` event emit.
- `munix/src/store/slices/tab-slice.ts`: active pane 기준 document/terminal tab open.

## 8. 제거된 경로

- `ghostty-web` renderer.
- macOS Swift/AppKit native terminal bridge.
- `native-libghostty` Cargo feature.
- `terminal_native_*` IPC.
- Ghostty source prepare/build wrapper scripts.

## 9. 검증 체크리스트

- terminal tab 열기 후 prompt가 active vault root에서 시작한다.
- `exit` 후 같은 tab/새 tab을 열어도 이전 출력이 잔상처럼 보이지 않는다.
- context menu, command palette, modal이 terminal 위에 정상 표시된다.
- DevTools open/close 후 terminal bounds가 Web layout과 같이 변한다.
- split pane에서 terminal/document tab open이 active pane 기준으로 동작한다.
- `Ctrl+C`, `Ctrl+D`, `Tab`, 방향키, IME 입력이 shell로 전달된다.
- `Ctrl/Cmd + +/-/0`이 terminal font size를 조정하고 PTY resize를 동기화한다.
