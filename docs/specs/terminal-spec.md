# Terminal 상세 설계 — Munix

> 상태: **부분 구현 / 확장 스펙 정리 중**.
> 현재 구현은 코어 기능으로 `ghostty-web` 렌더러와 Rust `portable-pty`를 사용한다.
> 터미널은 별도 하단 토글 패널이 아니라 workspace pane 안의 **tab kind** 중 하나로 동작한다.

---

## 1. 목적

- vault 안에서 git/build/grep/test 같은 셸 작업을 노트 작성 흐름과 같은 workspace에서 처리한다.
- 문서 탭, 이미지 탭과 같은 방식으로 터미널을 열고 닫고 이동하고 split 할 수 있게 한다.
- Obsidian/VS Code/cmux에 가까운 “파일 작업 + 터미널” 멘탈 모델을 제공한다.
- 추후 플러그인 시스템이 들어오더라도 현재 코어 PTY 모델을 capability 기반 host API로 옮길 수 있게 경계를 유지한다.

## 2. 현재 구현 요약

| 영역 | 현재 선택 |
|---|---|
| Renderer | `ghostty-web` |
| PTY backend | Rust `portable-pty` |
| IPC | Tauri command + event |
| Workspace 통합 | `Tab.kind = "terminal"` |
| 기본 cwd | active vault root |
| 세션 생명주기 | terminal tab id 기준 registry 관리 |
| Split 지원 | 기존 workspace split/pane 시스템 재사용 |

현재 터미널은 `workspace-header`의 터미널 버튼으로 새 terminal tab을 만들고, active tab이 terminal이면 `TerminalView`를 렌더한다. split pane의 비활성 pane도 active tab이 terminal이면 같은 `TerminalView` 렌더 경로를 사용한다.

## 3. 요구사항

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 상태 |
|---|---|---|---|
| TRM-01 | 터미널은 현재 active vault root를 cwd로 열려야 한다 | P0 | 구현 |
| TRM-02 | 터미널은 workspace tab의 한 종류여야 한다 | P0 | 구현 |
| TRM-03 | 여러 터미널 탭을 열 수 있어야 한다 | P0 | 부분 구현 |
| TRM-04 | workspace split 기능으로 터미널 탭을 분할 배치할 수 있어야 한다 | P0 | 구현 경로 연결 |
| TRM-05 | 키 입력, 제어키, 조합키가 PTY로 전달되어 shell completion이 동작해야 한다 | P0 | 검증 필요 |
| TRM-06 | 터미널 폰트는 JetBrainsMono Nerd Font 계열을 우선 사용해 glyph가 깨지지 않아야 한다 | P0 | 필요 |
| TRM-07 | `Ctrl` + `+`, `Ctrl` + `-`로 터미널 폰트 크기를 조절할 수 있어야 한다 | P0 | 필요 |
| TRM-08 | container resize 시 terminal cols/rows와 PTY size가 동기화되어야 한다 | P0 | 구현 |
| TRM-09 | 터미널 탭을 닫으면 연결된 PTY session도 종료해야 한다 | P0 | 구현 |
| TRM-10 | 터미널 탭 전환 시 session이 즉시 죽지 않아야 한다 | P0 | 구현 |
| TRM-11 | shell exit 시 탭은 유지하고 종료 상태를 표시해야 한다 | P1 | 구현 |
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

### 5.2 Renderer session registry

```ts
const terminalSessionsByTabId = new Map<string, string>();

function getTerminalSessionId(tabId: string): string | null;
function setTerminalSessionId(tabId: string, sessionId: string): void;
function closeTerminalSessionForTab(tabId: string): void;
function closeTerminalSessionsForTabs(tabs: { id: string; kind?: string }[]): void;
```

역할:

- React component mount/unmount와 PTY session 생명주기를 분리한다.
- terminal tab을 닫는 액션에서만 PTY를 kill한다.
- tab switch로 `TerminalView`가 unmount되어도 session id는 유지한다.

### 5.3 Rust PTY session

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

### 6.1 Tauri commands

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

### 6.2 Tauri events

| Event | Payload | 설명 |
|---|---|---|
| `terminal:data` | `{ id, data }` | PTY stdout/stderr stream |
| `terminal:exit` | `{ id }` | child process 종료 |

### 6.3 Store actions

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
- terminal viewport: `ghostty-web` mount 영역
- error state: spawn/init 실패 표시
- exit state: session exit 메시지 출력

Renderer 옵션:

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
- inactive pane content도 같은 기준으로 terminal을 렌더할 수 있어야 한다.
- split tab clone 시 terminal tab은 새 id를 가져야 한다. 새 id는 새 PTY session으로 이어진다.

## 8. 에러 처리

| 케이스 | 처리 |
|---|---|
| vault 없음 | 터미널 버튼 no-op 또는 disabled |
| PTY spawn 실패 | terminal surface에 error state 표시 |
| shell 경로 없음 | OS 기본 shell fallback 후 실패 시 error |
| write 실패 | session 종료로 간주하고 exit 메시지 |
| resize 실패 | 무시 가능하나 dev mode에서 warn |
| terminal init 실패 | error state 표시, tab은 유지 |
| tab close 중 kill 실패 | dev mode warn, UI는 닫기 지속 |

## 9. 엣지 케이스

- GUI 앱으로 실행한 macOS Tauri는 `$PATH`가 interactive shell과 다를 수 있다.
- `Ctrl+S`는 shell flow control에 걸릴 수 있다. 기본적으로 shell에 전달하되 문서 저장 단축키와 충돌하지 않게 terminal focus를 우선한다.
- `Ctrl+Space`는 IME/OS 단축키와 충돌할 수 있다.
- terminal tab이 workspace persist에 저장되면 앱 재시작 시 shell을 자동 복원할지 결정해야 한다. v1 기본은 tab만 복원하거나 terminal tab을 drop하는 정책 중 하나를 선택해야 한다.
- tab switch 동안 출력된 내용은 renderer buffer 복원 문제가 있다. session은 유지되지만 화면 scrollback 재연결 정책은 별도 설계가 필요하다.
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
- terminal tab split right/down → 새 pane에서 terminal 표시
- terminal tab close → backend session kill

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

현재는 코어 기능으로 구현하지만, 추후 plugin system 도입 시 다음 경계로 옮길 수 있다.

- Rust PTY command → plugin host function
- terminal UI → plugin panel/tab contribution
- session capability → `pty`, `fs:vault`
- keyboard/focus policy는 core workspace가 계속 관리

## 12. 의존 관계

- [workspace-split-spec.md](./workspace-split-spec.md): pane/tab/split 구조
- [keymap-spec.md](./keymap-spec.md): terminal focus 중 keymap 우선순위
- [theme-spec.md](./theme-spec.md): terminal theme/font token
- [vault-spec.md](./vault-spec.md): active vault root와 path validation
- [vault-trust-spec.md](./vault-trust-spec.md): shell/PTY 권한 모델

## 13. 참고 구현

- cmux: terminal tab/split UX, Ghostty 계열 렌더링 참고
- VS Code integrated terminal: key event/focus 정책, terminal profiles, shell integration 참고
- Obsidian terminal plugin 계열: vault cwd 기반 terminal UX 참고

---

**문서 버전:** v0.2
**작성일:** 2026-04-25
**최근 업데이트:** 2026-04-29
**상태:** Partial Implementation — P0 기본 동작 정의 완료
