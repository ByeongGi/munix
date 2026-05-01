# Terminal 상세 설계 — Munix

> 상태: **ADR-033 적용 / native terminal runtime 전환 예정**.
> 기존 `ghostty-web` + Rust `portable-pty` WebView 터미널은 deprecated fallback이다.
> 장기 구현은 `trolley` 스타일의 native `libghostty` surface를 따른다.

---

## 1. 목적

- vault 안에서 git/build/grep/test 같은 셸 작업을 노트 작성 흐름과 같은 workspace에서 처리한다.
- 문서 탭, 이미지 탭과 같은 방식으로 터미널을 열고 닫고 이동하고 split 할 수 있게 한다.
- Obsidian/VS Code/cmux에 가까운 “파일 작업 + 터미널” 멘탈 모델을 제공한다.
- WebView canvas/renderer lifecycle에 의존하지 않고 native terminal surface로 잔상/버퍼 재사용 문제를 제거한다.
- 추후 플러그인 시스템이 들어오더라도 native terminal capability를 host API로 노출할 수 있게 경계를 유지한다.

## 2. 전환 요약

ADR-033에 따라 Munix 터미널은 WebView 내부 renderer에서 native `libghostty` runtime으로 전환한다.

| 영역 | 기존 구현 | ADR-033 목표 |
|---|---|
| Renderer | `ghostty-web` WebView canvas | native `libghostty` Metal/OpenGL surface |
| PTY backend | Rust `portable-pty` | `libghostty` managed PTY |
| 상태 복원 | app-level buffer/screenState workaround | native surface lifecycle |
| IPC | Tauri command + event | Tauri command + native runtime bridge |
| Workspace 통합 | `Tab.kind = "terminal"` | 동일 |
| 기본 cwd | active vault root | 동일 |
| 세션 생명주기 | terminal tab id 기준 registry 관리 | native runtime instance id 기준 관리 |
| Split 지원 | 기존 workspace split/pane 시스템 재사용 | PoC 후 embed 가능성 결정 |

현재 코드는 플랫폼별 terminal runtime을 선택한다. macOS는 `native-libghostty` feature가 포함되고 native host view가 준비된 경우 `libghostty` embedded surface를 사용한다. Windows/Linux와 native unavailable 상태는 `ghostty-web` + Rust `portable-pty` fallback을 제품 경로로 사용한다.
프론트 기본 경로는 `terminal_native_is_available`을 먼저 호출한다. native가 가능하면 `terminal_native_open`으로 `NSView` surface를 붙이고, pane 위치/크기를 `terminal_native_set_bounds`로 동기화한다. native가 불가능하면 별도 설정 없이 WebView fallback을 연다. `localStorage["munix:terminalLegacyWebviewFallback"] = "true"`는 macOS에서도 WebView fallback을 강제하는 개발/진단 스위치로만 사용한다.
`libghostty` 연결은 `native-libghostty` Cargo feature 뒤에 둔다. 실제 구현은 Rust가 `libghostty` C API 전체를 직접 다루는 방식이 아니라, macOS Swift/AppKit bridge가 `NSView` subclass와 입력 이벤트를 담당하고 Rust/Tauri는 해당 bridge를 attach/focus/resize/close 하는 구조를 기본 경로로 둔다. feature가 없는 빌드는 native terminal을 available로 보고하지 않는다.

### 2.1 전환 원칙

1. WebView 내부 terminal renderer는 Windows/Linux fallback으로 유지한다.
2. `trolley`는 직접 의존성이 아니라 native `libghostty` runtime 참고 구현으로 사용한다.
3. macOS Tauri window 내부 native child view embed를 기본 PoC로 삼는다. placeholder `NSView` attach/remove/bounds sync는 검증 완료.
4. 실제 terminal surface는 Swift/AppKit bridge에서 구현한다. `NSTextInputClient`, key/mouse/scroll/focus/clipboard mapping은 Swift 쪽 책임이다.
5. React는 terminal tab/pane metadata, runtime selection, open/focus/close 명령, 상태 표시만 담당한다.
6. terminal session은 workspace persistence에 저장하지 않는다. 앱 재시작 시 stale shell/session을 복원하지 않는다.

## 3. 요구사항

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 상태 |
|---|---|---|---|
| TRM-01 | 터미널은 현재 active vault root를 cwd로 열려야 한다 | P0 | 구현 |
| TRM-02 | 터미널은 workspace tab의 한 종류여야 한다 | P0 | 구현 |
| TRM-03 | 여러 터미널 탭을 열 수 있어야 한다 | P0 | native runtime PoC 필요 |
| TRM-04 | workspace split 기능으로 터미널 탭을 분할 배치할 수 있어야 한다 | P0 | embed PoC 필요 |
| TRM-05 | 키 입력, 제어키, 조합키가 PTY로 전달되어 shell completion이 동작해야 한다 | P0 | 검증 필요 |
| TRM-06 | 터미널 폰트는 JetBrainsMono Nerd Font 계열을 우선 사용해 glyph가 깨지지 않아야 한다 | P0 | 필요 |
| TRM-07 | `Ctrl` + `+`, `Ctrl` + `-`로 터미널 폰트 크기를 조절할 수 있어야 한다 | P0 | 필요 |
| TRM-08 | container resize 시 terminal cols/rows와 PTY size가 동기화되어야 한다 | P0 | native runtime PoC 필요 |
| TRM-09 | 터미널 탭을 닫으면 연결된 PTY session도 종료해야 한다 | P0 | native runtime PoC 필요 |
| TRM-10 | 터미널 탭 전환 시 session이 즉시 죽지 않아야 한다 | P0 | native runtime PoC 필요 |
| TRM-11 | shell exit 시 탭은 유지하고 종료 상태를 표시해야 한다 | P1 | native runtime PoC 필요 |
| TRM-12 | 셸 프로필(zsh/bash/fish/pwsh)을 선택할 수 있어야 한다 | P1 | 미구현 |
| TRM-13 | 터미널 탭 이름을 변경할 수 있어야 한다 | P1 | 미구현 |
| TRM-14 | 터미널 scrollback 검색을 지원해야 한다 | P2 | 미구현 |
| TRM-15 | URL 또는 파일 경로 클릭 액션을 지원해야 한다 | P2 | 미구현 |
| TRM-16 | command finished / long running job 알림을 지원해야 한다 | P2 | 미구현 |

### 3.2 비기능 요구사항

- 입력 지연은 체감상 즉시여야 한다. 목표: keydown → PTY write < 16ms.
- 터미널 1개당 기본 scrollback은 10,000 lines 이상을 지원한다.
- 거대 출력 중에도 editor/workspace UI가 멈추지 않아야 한다.
- active vault 외부 경로를 cwd로 열 수 없어야 한다.
- 터미널 UI는 Munix dark token과 어긋나지 않아야 한다.

## 4. UX 정책

### 4.1 열기 위치

- 기본 터미널 cwd는 현재 active vault root다.
- 현재 열린 문서가 하위 폴더에 있어도 v1 기본값은 vault root다.
- 추후 P1 옵션으로 “현재 파일 폴더에서 열기”를 제공할 수 있다.
- vault가 없으면 터미널 열기 버튼은 no-op 또는 disabled 처리한다.

### 4.2 탭 동작

- 터미널은 빈 문서 탭이 아니라 `kind: "terminal"`인 별도 탭이다.
- 터미널 탭의 `path`는 빈 문자열이며 파일 rename/delete 동기화 대상에서 제외한다.
- 터미널 탭은 dirty 상태를 갖지 않는다.
- 터미널 탭은 기존 tab DnD, close, close others, close after, pin, split 동작을 재사용한다.
- 터미널 탭을 split하면 새 pane에서 별도 terminal tab session으로 열린다.

### 4.3 키 입력과 자동 완성

터미널 내부 focus 상태에서는 다음 입력이 앱 전역 단축키보다 우선한다.

| 입력 | 기대 동작 |
|---|---|
| 문자 입력 | PTY로 그대로 전달 |
| `Tab` | shell completion으로 전달 |
| `Ctrl` + 문자 | PTY 제어키로 전달 |
| `Option/Alt` 조합 | shell/meta key로 전달 |
| 방향키/Home/End/PageUp/PageDown | terminal escape sequence로 전달 |
| IME 입력 | 조합 완료 후 shell 입력으로 전달 |
| `Cmd` 조합 | macOS 앱 단축키와 충돌하는 항목만 앱에서 처리 |

주의할 점:

- `Tab`이 focus 이동으로 빠지면 자동 완성이 깨진다.
- `Ctrl+C`, `Ctrl+D`, `Ctrl+Z`, `Ctrl+R`, `Ctrl+L`, `Ctrl+A`, `Ctrl+E`는 반드시 shell로 전달되어야 한다.
- terminal focus 중에는 editor keymap, command palette keymap, workspace split keymap이 개입하지 않아야 한다.
- 단, 앱 레벨의 `Cmd+W`, `Cmd+T`, `Cmd+P` 같은 macOS 기본 조합은 유지할 수 있다.

### 4.4 폰트

기본 font-family 우선순위:

```css
"JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font",
"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace
```

요구사항:

- Nerd Font glyph가 필요한 prompt(starship, powerlevel10k 등)가 깨지지 않아야 한다.
- 번들 폰트가 있다면 CSS `@font-face`로 등록하고, terminal renderer 옵션에도 같은 family를 지정한다.
- 사용자가 시스템에 Nerd Font를 설치하지 않아도 기본 아이콘 glyph가 가능한 한 보장되어야 한다.
- fallback 때문에 셀 폭이 흔들리면 안 된다. terminal font는 mono 계열만 사용한다.

### 4.5 폰트 크기 조절

터미널 focus 상태에서:

| 단축키 | 동작 |
|---|---|
| `Ctrl` + `+` | terminal font size +1 |
| `Ctrl` + `=` | terminal font size +1 |
| `Ctrl` + `-` | terminal font size -1 |
| `Ctrl` + `0` | terminal font size reset |

정책:

- 기본 크기: 13px.
- 최소: 10px.
- 최대: 24px.
- 변경 후 즉시 fit/resize를 다시 수행하고 PTY `cols/rows`를 동기화한다.
- P1에서 사용자 설정으로 저장한다. v1에서는 session-local 또는 app-local 중 하나로 시작해도 된다.
- macOS에서도 사용자 요청 기준으로 `Ctrl` 조합을 우선 지원한다. `Cmd` 조합은 앱 확대/축소와 충돌 가능성이 있어 별도 결정 전까지 제외한다.

## 5. 데이터 모델

### 5.1 Tab

```ts
type TabKind = "document" | "terminal";

interface Tab {
  id: string;
  kind?: TabKind; // 기존 workspace 저장 데이터 호환을 위해 document는 optional
  path: string;
  title: string;
  titleDraft?: string;
  pinned?: boolean;
}
```

terminal tab:

```ts
const terminalTab: Tab = {
  id: "tab-...",
  kind: "terminal",
  path: "",
  title: "Terminal",
};
```

### 5.2 Native runtime registry

```ts
const terminalSessionsByTabId = new Map<string, string>();

function getTerminalSessionId(tabId: string): string | null;
function setTerminalSessionId(tabId: string, sessionId: string): void;
function closeTerminalSessionForTab(tabId: string): void;
function closeTerminalSessionsForTabs(tabs: { id: string; kind?: string }[]): void;
```

역할:

- React component mount/unmount와 native runtime instance 생명주기를 분리한다.
- terminal tab을 닫는 액션에서만 native terminal instance를 close한다.
- tab switch로 React view가 unmount되어도 native terminal instance id는 유지한다.
- WebView renderer buffer나 screenState를 workspace persistence에 저장하지 않는다.

### 5.3 Legacy Rust PTY session

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

이 모델은 기존 `portable-pty` fallback 경로에만 해당한다. ADR-033 목표 구현에서는 `libghostty`가 PTY와 terminal state를 직접 관리한다.

### 5.4 IPC payload

```ts
interface TerminalSpawnResult {
  id: string;
}

interface TerminalDataPayload {
  id: string;
  data: string;
}

interface TerminalExitPayload {
  id: string;
}
```

## 6. API/인터페이스

### 6.1 Native terminal commands

초기 PoC에서 필요한 최소 bridge. 현재 Rust command scaffold와 macOS placeholder `NSView` attach/remove 경로는 추가되어 있으며, 실제 `libghostty` surface 연결 전까지 placeholder surface로 native view lifecycle을 검증한다.

```rust
#[tauri::command]
async fn terminal_native_is_available() -> NativeTerminalAvailability;

#[tauri::command]
async fn terminal_native_open(vault_id: Option<String>) -> Result<TerminalSpawnResult, String>;

#[tauri::command]
async fn terminal_native_focus(id: String) -> Result<(), String>;

#[tauri::command]
async fn terminal_native_close(id: String) -> Result<(), String>;
```

```rust
#[tauri::command]
async fn terminal_native_set_bounds(id: String, x: f64, y: f64, width: f64, height: f64) -> Result<(), String>;
```

macOS native bridge 내부 책임:

```text
Rust/Tauri
- validate vault cwd
- get main window NSView
- create/focus/resize/close bridge instance
- keep terminal instance id stable across React mount/unmount

Swift/AppKit
- create TerminalSurfaceView: NSView, NSTextInputClient
- call ghostty_init, ghostty_config_*, ghostty_app_new, ghostty_surface_new
- translate keyDown/keyUp/flagsChanged/IME to ghostty_surface_key
- translate mouse/scroll/focus/scale/resize to ghostty_surface_* APIs
- handle clipboard and close-surface callbacks
- current implementation covers keyDown/keyUp/flagsChanged, AppKit text composition, marked text/preedit state, IME candidate window rect via `ghostty_surface_ime_point`, composing control-character suppression, terminal font zoom shortcuts through `ghostty_surface_binding_action`, mouse button/position/drag, scroll wheel, focus, resize, clipboard read/write, and close-surface callback
- native close/child-exit/command-finished notifications are forwarded through a Rust callback and emitted to the frontend as `terminal:native-event`

libghostty
- PTY lifecycle
- terminal state and scrollback
- Metal rendering
- font shaping and terminal input encoding
```

macOS build prerequisite:

- Zig 0.15.2 is required for current Ghostty/trolley build scripts.
- Xcode Metal Toolchain must be installed. `xcrun metal -v` and `xcrun -find metallib` must succeed before `libghostty` static build can complete.
- Swift bridge는 `GHOSTTY_INCLUDE_DIR=/path/to/ghostty/include`와 `GHOSTTY_LIB_DIR=/path/to/lib-dir`가 모두 있을 때 `CGhostty` 모듈을 켜고 실제 `ghostty_surface_new` 경로를 컴파일한다.
- `GHOSTTY_INCLUDE_DIR`만 있는 경우 Swift 타입체크는 가능하지만, 최종 앱 링크에는 `GHOSTTY_LIB_DIR/libghostty.a`가 필요하다.

현재 macOS 검증 명령:

```bash
cd /Users/byeonggi/SIDE_PROJECT/note-app/munix
pnpm tauri:native:prepare
pnpm tauri dev
pnpm tauri build
```

링크에는 Ghostty 내부 C++ shader/tooling 의존성 때문에 `libc++`가 필요하다. `build.rs`는 `native-libghostty` feature에서 `-lc++`를 추가한다.

`pnpm tauri:native:prepare`는 macOS에서 다음을 자동 수행한다.

- `munix/src-tauri/.native/ghostty`에 `ghostty-org/ghostty` 최신 `main` shallow clone 또는 fetch
- macOS static `libghostty.a` install을 위한 `build.zig` patch 적용
- Homebrew `zig@0.15`의 Zig 0.15.2로 `libghostty.a` 빌드
- `zig-out/include/ghostty.h`와 `zig-out/lib/libghostty.a` 검증

`pnpm tauri dev`와 `pnpm tauri build`는 wrapper를 통해 prepare를 먼저 실행한 뒤 `GHOSTTY_INCLUDE_DIR`, `GHOSTTY_LIB_DIR`, `--features native-libghostty`를 자동 주입한다. macOS가 아닌 플랫폼에서는 기존 Tauri CLI로 fallback한다. 명시적으로 native 경로만 실행하고 싶으면 `pnpm tauri:native:dev` 또는 `pnpm tauri:native:build`를 사용할 수 있다.

빌드 입력을 고정해야 할 때는 다음 환경 변수를 사용할 수 있다.

```bash
MUNIX_GHOSTTY_REF=<branch-or-tag-or-commit>
MUNIX_GHOSTTY_REPO=https://github.com/ghostty-org/ghostty.git
MUNIX_GHOSTTY_SOURCE_DIR=/absolute/path/to/ghostty
MUNIX_ZIG=/opt/homebrew/opt/zig@0.15/bin/zig
```

### 6.2 Legacy Tauri commands

```rust
#[tauri::command]
async fn terminal_spawn(cols: u16, rows: u16, vault_id: Option<String>) -> Result<TerminalSpawnResult, String>;

#[tauri::command]
async fn terminal_write(id: String, data: String) -> Result<(), String>;

#[tauri::command]
async fn terminal_resize(id: String, cols: u16, rows: u16) -> Result<(), String>;

#[tauri::command]
async fn terminal_kill(id: String) -> Result<(), String>;
```

위 commands는 `ghostty-web` + `portable-pty` fallback 경로다. Windows/Linux 기본 runtime이며, macOS에서도 native bridge가 unavailable이거나 `localStorage["munix:terminalLegacyWebviewFallback"] = "true"`일 때 사용한다.

### 6.3 Legacy Tauri events

| Event | Payload | 설명 |
|---|---|---|
| `terminal:data` | `{ id, data }` | PTY stdout/stderr stream |
| `terminal:exit` | `{ id }` | child process 종료 |

### 6.4 Store actions

```ts
interface TabSlice {
  openTerminalTab: () => void;
}
```

동작:

1. `makeTerminalTab()`으로 terminal tab 생성
2. active pane이 있으면 pane tabs에 반영
3. active tab을 terminal tab으로 변경
4. editor current file은 close 처리

## 7. UI 구성

### 7.1 Header action

- Workspace header에 terminal icon button을 둔다.
- 클릭하면 toggle이 아니라 새 terminal tab을 연다.
- active terminal tab 여부에 따라 버튼 active state를 표시하지 않는다. “새 terminal” 명령으로 해석한다.

### 7.2 TerminalView

필수 구성:

- 상단 toolbar: terminal icon + title
- terminal viewport: native terminal window/surface placeholder 또는 embed host
- error state: spawn/init 실패 표시
- exit state: session exit 메시지 출력

기존 WebView renderer 옵션은 fallback 전용이다.

```ts
new Terminal({
  cursorBlink: true,
  fontFamily: TERMINAL_FONT_FAMILY,
  fontSize: 13,
  scrollback: 10000,
  theme: terminalTheme,
});
```

### 7.3 Split pane

- active pane content는 `activeTab.kind` 기준으로 editor/image/terminal을 선택한다.
- inactive pane content도 같은 기준으로 terminal placeholder 또는 native embed surface를 표시할 수 있어야 한다.
- split tab clone 시 terminal tab은 새 id를 가져야 한다. 새 id는 새 native terminal instance로 이어진다.

## 8. 에러 처리

| 케이스 | 처리 |
|---|---|
| vault 없음 | 터미널 버튼 no-op 또는 disabled |
| native runtime 사용 불가 | fallback 안내 또는 terminal feature disabled |
| PTY/runtime spawn 실패 | terminal surface에 error state 표시 |
| shell 경로 없음 | OS 기본 shell fallback 후 실패 시 error |
| write 실패 | session 종료로 간주하고 exit 메시지 |
| resize 실패 | 무시 가능하나 dev mode에서 warn |
| terminal init 실패 | error state 표시, tab은 유지 |
| tab close 중 kill 실패 | dev mode warn, UI는 닫기 지속 |

## 9. 엣지 케이스

- GUI 앱으로 실행한 macOS Tauri는 `$PATH`가 interactive shell과 다를 수 있다.
- `Ctrl+S`는 shell flow control에 걸릴 수 있다. 기본적으로 shell에 전달하되 문서 저장 단축키와 충돌하지 않게 terminal focus를 우선한다.
- `Ctrl+Space`는 IME/OS 단축키와 충돌할 수 있다.
- terminal tab은 workspace persist에서 drop한다. 앱 재시작 시 shell을 자동 복원하지 않는다.
- native window PoC 단계에서는 workspace pane 안에 실제 embed가 되지 않는다. tab은 native window focus/open/close anchor 역할을 한다.
- native child view embed 단계에서는 Tauri/WebView와 native surface의 z-order, resize, focus, IME 전달을 별도 검증해야 한다.
- vim/less/htop 같은 alternate screen 앱은 resize와 key event 전달을 별도로 검증해야 한다.

## 10. 테스트 케이스

### 10.1 P0 수동 검증

- terminal button 클릭 → 새 terminal tab 생성
- `pwd` 실행 → 현재 vault root 출력
- `echo hello` → 출력 표시
- `Tab` completion → 파일/명령 자동완성 동작
- `Ctrl+C` → 실행 중 프로세스 interrupt
- `Ctrl+D` → shell exit
- `Ctrl+R` → shell history search
- `Ctrl+L` → clear screen
- `Ctrl++`, `Ctrl+-`, `Ctrl+0` → 폰트 크기 조절/초기화
- terminal tab split right/down → 새 terminal instance 또는 embed placeholder 표시
- terminal tab close → native runtime instance close

### 10.2 PTY/렌더링 검증

- `stty size`가 pane resize 후 rows/cols와 일치
- `vim` 실행 후 입력/ESC/저장/종료 정상
- `less` 또는 `man`에서 스크롤/검색 정상
- `htop`류 alternate screen 앱에서 화면 깨짐 없음
- starship 또는 powerlevel10k prompt glyph가 깨지지 않음
- 큰 출력(`yes | head -n 10000`)에서 UI가 멈추지 않음

### 10.3 회귀 검증

- terminal tab active 상태에서 파일 rename/delete watcher가 terminal tab을 건드리지 않음
- terminal tab은 dirty indicator가 표시되지 않음
- terminal tab을 닫은 뒤 같은 tab id session이 registry에 남지 않음
- shell `exit` 후 같은 terminal tab을 다시 열 때 이전 frame/output 잔상이 보이지 않음
- terminal tab close/reopen 후 WebView canvas stale frame이 재사용되지 않음
- vault 전환 시 active terminal tab이면 editor current file이 닫힌 상태로 유지

## 11. 향후 확장

### P1

- shell profile 설정(zsh/bash/fish/pwsh)
- terminal tab rename
- terminal font size 설정 저장
- “현재 파일 폴더에서 열기” 옵션
- terminal session restart button
- terminal copy/paste 메뉴

### P2

- scrollback 검색
- URL/file path link handling
- command status 알림
- shell integration(zsh/bash hook)
- terminal output capture to markdown
- workspace restore 시 terminal session 복원 정책

### 플러그인 전환 가능성

현재는 코어 native runtime으로 구현한다. 추후 plugin system 도입 시 다음 경계만 plugin host API로 노출할 수 있다.

- native terminal open/focus/close → plugin host function
- terminal tab contribution → plugin panel/tab contribution
- session capability → `terminal`, `pty`, `fs:vault`
- keyboard/focus policy는 core workspace가 계속 관리

## 12. 의존 관계

- [workspace-split-spec.md](./workspace-split-spec.md): pane/tab/split 구조
- [keymap-spec.md](./keymap-spec.md): terminal focus 중 keymap 우선순위
- [theme-spec.md](./theme-spec.md): terminal theme/font token
- [vault-spec.md](./vault-spec.md): active vault root와 path validation
- [vault-trust-spec.md](./vault-trust-spec.md): shell/PTY 권한 모델

## 13. 참고 구현

- trolley: native `libghostty` runtime, macOS AppKit/Metal surface, Linux GLFW/OpenGL runtime 참고
- cmux: terminal tab/split UX, Ghostty 계열 렌더링 참고
- VS Code integrated terminal: key event/focus 정책, terminal profiles, shell integration 참고
- Obsidian terminal plugin 계열: vault cwd 기반 terminal UX 참고

---

**문서 버전:** v0.3
**작성일:** 2026-04-25
**최근 업데이트:** 2026-05-01
**상태:** ADR-033 Accepted — native `libghostty` runtime 전환 예정
