# Terminal 상세 설계 — Munix

> 상태: **초안 (proposed)**. [ADR-023](../decisions.md#adr-023-터미널-플러그인-1호) 채택 후 확정.
> 플러그인 시스템 위 1호 reference 플러그인 (코어 기능 X).

---

## 1. 목적

- vault 안에서 git/build/grep 등 셸 명령 실행 — 노트 ↔ 코드 워크플로우 결합
- 플러그인 시스템 ([plugin-spec.md](./plugin-spec.md))의 reference 구현 — capability 모델 검증
- 옵시디언 Terminal 플러그인 사용자 멘탈 모델과 일치

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| TRM-01 | 사이드/하단 패널에 터미널 띄우기 | P0 |
| TRM-02 | PTY spawn (vault 디렉터리 cwd) | P0 |
| TRM-03 | 키 입력 → PTY → 출력 표시 (xterm.js) | P0 |
| TRM-04 | 리사이즈 → PTY size 동기 | P0 |
| TRM-05 | 다중 터미널 탭 | P1 |
| TRM-06 | 셸 선택 (zsh/bash/fish/pwsh) | P1 |
| TRM-07 | 출력에서 파일 경로 클릭 → 노트로 열기 | P2 |
| TRM-08 | 색상 테마 Munix 토큰 연동 | P1 |
| TRM-09 | Windows ConPTY 호환 | P0 |
| TRM-10 | macOS / Linux PTY 호환 | P0 |
| TRM-11 | 검색 (xterm-addon-search) | P2 |
| TRM-12 | 분할 (split) | P2 |

### 2.2 비기능 요구사항

- 입력 → 출력 지연 < 16ms
- 터미널 1개당 메모리 < 50MB
- 100k 라인 스크롤백 부드러움 (xterm-addon-canvas 또는 webgl)

---

## 3. 데이터 모델

### 3.1 Plugin manifest

```json
{
  "name": "terminal",
  "version": "0.1.0",
  "displayName": "Terminal",
  "munixApiVersion": "1.0",
  "capabilities": {
    "required": ["pty", "fs:vault", "ui:panel"],
    "optional": ["net"]
  },
  "ui": {
    "panel": {
      "position": "bottom",
      "title": "Terminal",
      "icon": "terminal"
    }
  },
  "commands": [
    { "id": "terminal.open", "title": "Terminal: Open New", "shortcut": "Ctrl+`" },
    { "id": "terminal.split", "title": "Terminal: Split" }
  ]
}
```

### 3.2 PTY 세션 (Rust 측)

```rust
struct PtySession {
  id: SessionId,                   // UUID
  shell: String,                    // /bin/zsh, /bin/bash, ...
  cwd: PathBuf,                     // vault root 또는 사용자 지정
  env: HashMap<String, String>,
  master: Box<dyn MasterPty>,       // portable-pty
  child: Box<dyn Child>,
  reader_handle: JoinHandle<()>,    // 출력 → 플러그인으로 stream
}
```

### 3.3 플러그인 측 (WASM)

```rust
struct TerminalState {
  sessions: HashMap<SessionId, SessionInfo>,
  active: Option<SessionId>,
}

struct SessionInfo {
  id: SessionId,
  title: String,
  cwd: String,
  exited: Option<i32>,
}
```

---

## 4. API/인터페이스

### 4.1 Host function (Munix 코어 → 플러그인이 호출)

```rust
host_fn!(pty_spawn(shell: String, cwd: String, env: Vec<(String, String)>) -> SessionId);
host_fn!(pty_write(id: SessionId, data: Vec<u8>));
host_fn!(pty_resize(id: SessionId, cols: u16, rows: u16));
host_fn!(pty_kill(id: SessionId));
host_fn!(pty_list() -> Vec<SessionId>);
```

### 4.2 Plugin event (Munix → 플러그인)

```rust
#[plugin_fn]
pub fn on_pty_output(id: SessionId, data: Vec<u8>) -> FnResult<()>;

#[plugin_fn]
pub fn on_pty_exit(id: SessionId, code: i32) -> FnResult<()>;
```

### 4.3 Plugin → UI (postMessage)

```ts
// iframe → host
type ToHost =
  | { type: 'spawn'; shell: string; cwd: string }
  | { type: 'input'; sessionId: string; data: Uint8Array }
  | { type: 'resize'; sessionId: string; cols: number; rows: number };

// host → iframe
type FromHost =
  | { type: 'output'; sessionId: string; data: Uint8Array }
  | { type: 'exit'; sessionId: string; code: number };
```

### 4.4 Renderer

- **xterm.js 5.x**
- `xterm-addon-fit` (리사이즈 자동 계산)
- `xterm-addon-web-links` (URL 클릭)
- `xterm-addon-search` (검색 P2)
- `xterm-addon-canvas` 또는 `xterm-addon-webgl` (성능)
- Munix 토큰 → xterm 테마 매핑:
  ```ts
  const xtermTheme = {
    background: 'var(--color-bg-primary)',
    foreground: 'var(--color-fg-primary)',
    cursor: 'var(--color-accent)',
    // ANSI 16색은 별도 토큰 (--color-ansi-*)
  };
  ```

---

## 5. UI/UX 플로우

### 5.1 첫 활성화

1. 플러그인 설치 → capability 승인 모달:
   ```
   Terminal v0.1.0
   필요한 권한:
   🔴 pty — 셸/PTY를 spawn합니다
   🟡 fs:vault — vault 디렉터리를 cwd로 사용
   🟢 ui:panel — 하단 패널 등록
   ```
2. 사용자 승인 → 패널 등록 + `Ctrl+`` 단축키 등록

### 5.2 새 터미널 열기

- Command palette: "Terminal: Open New"
- 단축키: `` Ctrl+` `` (커스터마이징 가능)
- 기본 셸: `$SHELL` 환경 변수, 없으면 `/bin/sh` (Win: `pwsh.exe` → `cmd.exe` 폴백)
- cwd: 현재 vault root

### 5.3 패널 동작

- **탭**: 다중 터미널, 우클릭 → 이름 변경/닫기
- **분할** (P2): 가로/세로 분할
- **검색** (P2): `Ctrl+F`로 스크롤백 검색
- **닫기**: 셸 종료 시 "exited (code N)" 표시 후 탭 자동 닫기 옵션

### 5.4 vault 이동 시

- 활성 터미널 있을 때 vault 전환 → prompt: "터미널을 종료할까요? 유지할까요?"
- 유지 선택 시 cwd는 그대로, 패널은 새 vault로 따라감

---

## 6. 에러 처리

| 케이스 | 처리 |
|---|---|
| PTY spawn 실패 (셸 경로 잘못) | 알림 + 셸 경로 재선택 prompt |
| 자식 프로세스 죽음 | 패널에 "exited (code N)" 표시, 탭 유지 (재시작 버튼) |
| `pty` capability 거부 | 셸 실행 차단 + 사유 표시 ("이 vault는 PTY를 허용하지 않습니다") |
| Windows ConPTY 미지원 (Win10 1809 미만) | 알림 + 플러그인 비활성화 |
| WSL 경로 혼동 | 사용자가 `wsl.exe` 셸 직접 설정 |

---

## 7. 엣지 케이스

- **vault 이동 시 PTY**: 기본 동작은 prompt — 종료/유지 선택
- **macOS dev 모드 sandbox**: portable-pty가 child spawn 가능한지 검증 (entitlement 필요할 수도)
- **Windows ConPTY**: Win10 1809+ 필수. 그 이전은 미지원 명시
- **WSL 사용자**: 자동 감지 어려움. 사용자가 `wsl.exe -d Ubuntu` 형태로 셸 직접 설정
- **알트 스크린 (vim, htop)**: xterm.js가 alt screen mode 정상 처리하는지 검증
- **거대 출력 (cat 거대 파일)**: xterm 스크롤백 한도(기본 1000) 초과 시 truncate. 사용자가 한도 조절
- **bracketed paste**: 활성화되어야 vim 등에서 자동 들여쓰기 비활성

---

## 8. 테스트 케이스

- `echo hello` → 출력 표시
- `vim` 같은 alt screen 앱 → mouse/키 정상
- `htop` → 갱신 부드러움
- 큰 출력 (`cat 100k_lines.txt`) → 스크롤 부드러움 (16ms 지연 이내)
- 리사이즈 시 줄바꿈 정상 (`stty size` 확인)
- Windows ConPTY 동일 시나리오 검증
- starship/p10k prompt 글리프 표시 (너드 폰트 의존)
- ANSI 컬러 256색 + truecolor 정확
- vault 외부 경로 cwd 시도 → 거부

---

## 9. 오픈 이슈

- [ ] **xterm.js vs ghostty-web** — v1.2에 재평가 (libghostty API 안정화 후)
- [ ] 셸 검색 PATH (사용자 PATH vs 앱 PATH 차이 — Tauri는 보통 GUI 앱 PATH가 줄어있음)
- [ ] starship/p10k 같은 prompt 호환성 — 너드 폰트 글리프 의존도 (Phase 6 폰트 번들과 연결)
- [ ] 터미널 출력을 .md 파일에 캡처 기능 (P2)
- [ ] 백그라운드 잡 알림 통합 (cmux의 OSC 9/99/777 패턴)
- [ ] 분할 레이아웃 저장/복원 (workspace state)
- [ ] 셸 통합 (zsh/bash hook) — directory tracking, command 종료 알림
- [ ] tmux 연동 — vault attach 시 자동 attach?

---

## 10. 의존 관계

- **선행 ADR**: [ADR-022](../decisions.md#adr-022-플러그인-시스템-extism-wasm) (플러그인 시스템 자체)
- **연관 ADR**: [ADR-023](../decisions.md#adr-023-터미널-플러그인-1호) (이 spec의 결정 근거)
- **연관 spec**: [plugin-spec.md](./plugin-spec.md) (host function 모델), [theme-spec.md](./theme-spec.md) (xterm 테마 매핑)
- **외부 의존**:
  - [portable-pty](https://github.com/wez/wezterm/tree/main/pty) (Rust, MIT)
  - [xterm.js](https://xtermjs.org) (TS, MIT)
  - JBMono Nerd Font Mono (폰트 번들 — implementation-plan.md Phase 6)

---

## 11. 참고 구현 (Prior Art)

구현 시 다음 프로젝트들을 적극 참조:

- **[lavs9/obsidian-ghostty-terminal](https://github.com/lavs9/obsidian-ghostty-terminal)** ⭐ 핵심 참조
  - **옵시디언 + Ghostty 통합 플러그인** — 우리의 모델과 가장 유사 (vault 컨텍스트 + 터미널)
  - 참고 포인트: 사이드 패널 UI 패턴, vault cwd 동기, 키 바인딩, 셸 spawn 흐름, 옵시디언 라이프사이클과 PTY 정리
  - 차이점: 옵시디언은 JS 플러그인 (Munix는 WASM), Ghostty 직접 (Munix는 v1.1에 xterm.js)
- **[cmux](https://github.com/manaflow-ai/cmux)** — macOS 네이티브 + libghostty 직접 임베드
  - 참고 포인트: vertical tabs, split, OSC 9/99/777 알림 패턴, Unix socket API
  - Munix는 다른 길(WebView)을 가지지만 UX 패턴은 차용 가능
- **[VS Code integrated terminal](https://github.com/microsoft/vscode/tree/main/src/vs/workbench/contrib/terminal)** — xterm.js 통합의 정전
  - 참고 포인트: addon 통합, 검색, 분할, profile 시스템, shell integration (zsh/bash hook), 알림

---

**문서 버전:** v0.1 (초안)
**작성일:** 2026-04-25
**상태:** Proposed — 다음 세션 정식 채택 + 플러그인 시스템 구현 후 v0.2로 업데이트
