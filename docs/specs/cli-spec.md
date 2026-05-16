# CLI + URI scheme 상세 설계 — Munix

> 상태: **accepted**. [ADR-024](../decisions.md#adr-024-cli--uri-scheme-munix)에 따른 실행 스펙.
> Obsidian 1.12.7+ 공식 CLI 모델을 기준으로, Munix는 별도 `munix-cli` 바이너리와 local IPC를 둔다.

---

## 1. 목적

- 터미널/스크립트에서 Munix vault와 note를 제어한다.
- 브라우저, 문서, 외부 앱에서는 `munix://` URI scheme으로 Munix를 호출한다.
- Obsidian 사용자에게 익숙한 `command key=value flag` 문법을 제공한다.
- 앱이 실행 중이면 CLI 명령을 기존 GUI 인스턴스로 전달하고, 앱이 꺼져 있으면 후속 단계에서 앱을 기동한 뒤 재전달한다.

---

## 2. 참고 모델: Obsidian CLI

2026-05-16 조사 기준, Obsidian은 공식 CLI를 제공한다.

- CLI는 설정에서 활성화한 뒤 PATH에 등록한다.
- 명령 문법은 `obsidian <command> key=value flag` 형태다.
- `vault=<name|id>`는 command 앞에 둔다.
- `file=<name>`은 wikilink처럼 이름 기반 resolution, `path=<path>`는 vault root 기준 정확한 경로다.
- `content`는 `\n`, `\t` escape를 지원하고 `append`/`prepend`는 `inline` flag로 줄바꿈 보정을 끌 수 있다.
- macOS는 앱 번들 안 CLI에 `/usr/local/bin/obsidian` symlink를 만들고, Linux는 `~/.local/bin`에 복사하며, Windows는 GUI stdout 제약 때문에 `.com` redirector를 제공한다.
- 지원 명령군은 `open`, `create`, `read`, `append`, `prepend`, `search`, `daily:*`, `vaults`, `files`, `folders`, `tags`, `backlinks`, `properties`, `templates`, `workspace`, `tabs`, `history`, `plugins`, `themes`, `dev:*` 등이다.
- URI scheme은 CLI와 별개로 `obsidian://open`, `new`, `daily`, `search`, `choose-vault` 등을 처리한다.

Munix는 이 구조 중 CLI 문법, 별도 CLI 엔트리포인트, URI와 CLI의 역할 분리를 채택한다. Obsidian Sync/Publish/plugin marketplace 같은 제품 고유 명령은 Munix 기능이 생기기 전까지 제외한다.

---

## 3. 기능 요구사항

### 3.1 계층 0 — 스캐폴드 (현재 구현)

| ID     | 요구사항                                                                            |
| ------ | ----------------------------------------------------------------------------------- |
| CLI-00 | Rust 공유 모듈에 CLI command model과 parser를 둔다.                                 |
| CLI-01 | `src-tauri/src/bin/munix-cli.rs` 별도 바이너리를 추가한다.                          |
| CLI-02 | `munix vault=Work open path="daily/today.md" newtab` 형태를 파싱한다.               |
| CLI-03 | 실행 중인 GUI 앱으로 command envelope를 보낼 local IPC 클라이언트/서버 골격을 둔다. |
| CLI-04 | GUI는 local IPC로 받은 command를 Tauri event로 frontend에 전달한다.                 |

### 3.2 계층 1 — v1.0 후반 P0

| ID     | 요구사항                                                                    |
| ------ | --------------------------------------------------------------------------- |
| CLI-10 | `munix open path=... [line=...] [newtab]`                                   |
| CLI-11 | `munix create path=... [content=...] [open] [overwrite]`                    |
| CLI-12 | `munix read path=... [format=text\|json\|md]`                               |
| CLI-13 | `munix append path=... content=...`, `munix prepend path=... content=...`   |
| CLI-14 | `munix search query=... [open] [format=text\|json]`                         |
| CLI-15 | `munix daily`, `daily:read`, `daily:append`, `daily:prepend`                |
| CLI-16 | `munix vaults`, `munix files`, `munix folders`                              |
| CLI-17 | `munix://open`, `munix://new`, `munix://daily`, `munix://search` 처리       |
| CLI-18 | CLI 설치/등록: macOS symlink, Linux `~/.local/bin`, Windows redirector 설계 |

### 3.3 계층 2 — v1.1 P1

| ID     | 요구사항                                                                 |
| ------ | ------------------------------------------------------------------------ |
| CLI-20 | `tags`, `tag`, `backlinks`, `links`, `unresolved`, `orphans`, `deadends` |
| CLI-21 | `outline`, `recents`, `tabs`, `tab:open`                                 |
| CLI-22 | `property:set`, `property:remove`, `property:read`                       |
| CLI-23 | `templates`, `template:read`, `template:insert`                          |
| CLI-24 | shell completion (`zsh`, `bash`, `fish`)                                 |
| CLI-25 | `munix` TUI 모드: history, autocomplete, reverse search                  |

### 3.4 계층 3 — v1.2+ P2

| ID     | 요구사항                                      |
| ------ | --------------------------------------------- |
| CLI-30 | `workspace:*`, `history:*`, `diff`            |
| CLI-31 | plugin/theme/snippet 명령군                   |
| CLI-32 | JSON-RPC local API 안정화 및 외부 도구 문서화 |
| CLI-33 | x-callback-url (`x-success`, `x-error`)       |
| CLI-34 | macOS Quick Action / Windows Send To 통합     |

---

## 4. 명령 문법

### 4.1 기본 문법

```bash
munix [global] <command> [key=value ...] [flag ...]
```

- `key=value`: shell quoting으로 공백 포함 값을 전달한다.
- `flag`: 값 없는 boolean. 예: `newtab`, `open`, `overwrite`, `inline`.
- `content` 값의 `\n`, `\t`, `\\`는 각각 newline, tab, backslash로 해석한다.

전역 인자:

```bash
vault=<name|id|absolute-path>
```

호환 alias:

```bash
munix --vault <name|id|absolute-path> open path="note.md"
munix --version
munix --help
```

### 4.2 파일 지정

```bash
path="folder/note.md"   # vault root 기준 정확한 상대 경로
file="Note title"       # 이름 기반 resolution, wikilink와 유사
name="Note title"       # create 전용 파일명
```

규칙:

- `path`와 `file`을 동시에 지정하면 오류다.
- `path`는 vault root 기준 정확한 상대 경로다. 기존 파일을 여는 명령에서는 확장자를 자동 보정하지 않는다.
- `file`은 `.md` 확장자 생략을 허용한다. 경로가 포함되면 path exact match, 파일명만 있으면 basename match를 사용한다.
- `file` basename이 여러 파일에 매칭되면 첫 번째를 임의로 고르지 않고 ambiguous 오류로 처리한다.
- `create name=<name>`은 root에 `<name>.md`를 만든다. 폴더 포함 경로는 `path=`를 사용한다.
- `create`에 대상이 없으면 `Untitled.md`, `Untitled 1.md`, ... 중 비어 있는 이름을 사용한다.

### 4.3 출력 포맷

```bash
format=text
format=json
format=md
format=tsv
format=csv
format=yaml
```

`--json`은 `format=json` alias로 취급한다.

---

## 5. P0 명령 예시

```bash
munix vault=Work open path="daily/2026-05-16.md"
munix vault=Work open path="daily/2026-05-16.md" line=42 newtab

munix vault=Work create name="Trip to Paris" content="# Trip\n\nNotes" open
munix vault=Work create path="inbox/idea.md" content="first draft" open
munix vault=Work append path="daily/2026-05-16.md" content="- [ ] Follow up"
munix vault=Work append path="daily/2026-05-16.md" content=" trailing text" inline
munix vault=Work prepend path="inbox.md" content="# Inbox"
munix vault=Work read path="README.md" format=md

munix vault=Work search query="tauri ipc" format=json
munix vault=Work search:open query="tauri ipc"

munix vault=Work daily
munix vault=Work daily:append content="- [ ] Review CLI spec"

munix vaults format=json
munix vault=Work files format=json
munix vault=Work folders
```

`open`은 Obsidian CLI와 같이 기존 파일을 여는 명령이다. 대상 파일이 없으면 새 탭을 만들지 않는다. 새 파일을 만들고 바로 열려면 `create path="..." open` 또는 `create name="..." open`을 사용한다. `daily`는 예외적으로 해당 날짜 파일을 create-or-open 한다.

`prepend`는 Obsidian처럼 YAML frontmatter가 있으면 frontmatter 블록 뒤에 내용을 삽입한다. `inline` flag가 없으면 기존 본문과 새 content 사이에 줄바꿈을 보정한다.

---

## 6. URI scheme

URI는 터미널 CLI의 내부 구현 수단이 아니라, 외부 앱/문서 링크용 public surface다.

```text
munix://open?vault=Work&path=daily/2026-05-16.md&line=42
munix://new?vault=Work&path=inbox/idea.md&content=hello
munix://daily?vault=Work
munix://search?vault=Work&query=tauri%20ipc
```

URI 파라미터:

| Action   | 필수                        | 옵션                           |
| -------- | --------------------------- | ------------------------------ |
| `open`   | `vault`, `path` 또는 `file` | `line`, `column`, `newtab`     |
| `new`    | `vault`, `path`             | `content`, `open`, `overwrite` |
| `daily`  | `vault`                     | `append`, `prepend`, `read`    |
| `search` | `vault`, `query`            | `open`, `format`               |

보안:

- URI는 외부 입력으로 간주한다.
- path traversal은 Rust vault validation에서 차단한다.
- `delete`, `overwrite`, plugin/theme 설치 같은 파괴적 작업은 URI에서 기본 비활성화한다.
- 첫 외부 호출 또는 새 vault 접근은 사용자 확인을 요구한다.

---

## 7. 아키텍처

### 7.1 모듈 구성

```text
munix/src-tauri/
  src/
    main.rs                 # Tauri GUI entry
    lib.rs                  # GUI runtime + shared module export
    cli.rs                  # command model + parser
    cli_ipc.rs              # local IPC server/client
    bin/
      munix-cli.rs          # terminal CLI entry
```

### 7.2 흐름

```text
[terminal]
  munix vault=Work open path=note.md
        ↓
[munix-cli]
  parse_args -> CliInvocation
        ↓
[local IPC]
  Unix domain socket / Windows named pipe
        ↓
[Munix GUI]
  Tauri event: munix-cli-command
        ↓
[frontend command handler]
  vault resolve -> tab/editor/search action
```

앱이 실행 중이지 않을 때:

```text
munix-cli
  ├─ 앱 실행 시도 (macOS open / Windows ShellExecute / Linux xdg-open or executable path)
  ├─ IPC readiness 대기
  └─ command 재전송
```

이 자동 기동은 P0 후반 작업이다. 현재 스캐폴드는 실행 중인 앱으로 보내는 경로를 먼저 고정한다.

### 7.3 IPC envelope

```rust
struct CliInvocation {
  vault: Option<String>,
  command: CliCommand,
}
```

Frontend event name:

```text
munix-cli-command
```

초기 응답:

```json
{ "ok": true, "message": "accepted" }
```

P1부터는 `read`, `search format=json`처럼 stdout이 중요한 명령에 대해 request id 기반 응답을 돌려준다.

---

## 8. 에러 처리

| 케이스                    | 처리                                           |
| ------------------------- | ---------------------------------------------- |
| 알 수 없는 명령           | CLI stderr + exit code 64                      |
| 알 수 없는 key/flag       | CLI stderr + exit code 64                      |
| `path`와 `file` 동시 지정 | CLI stderr + exit code 64                      |
| 앱 미실행, IPC 연결 실패  | CLI stderr + exit code 69, 후속 자동 기동 구현 |
| vault 미지정              | active vault fallback, 없으면 오류             |
| vault 이름 중복           | prompt 또는 `vault=<id>` 요구                  |
| path traversal            | Rust vault validation에서 거부                 |
| URI parsing 실패          | 사용자 알림 없이 warn 로그                     |
| 외부 URI 위험 작업        | 확인 prompt 또는 거부                          |

---

## 9. 테스트 케이스

- `vault=Work open path=a.md line=42 newtab` 파싱
- `--vault Work open path=a.md` alias 파싱
- `create path=a.md content=hello open overwrite` 파싱
- `append path=a.md content=hello` 파싱
- `search:open query=tauri format=json` 파싱
- `daily:append content=hello` 파싱
- `path`와 `file` 동시 지정 오류
- 알 수 없는 key/flag 오류
- 실행 중인 GUI로 IPC envelope 전송
- GUI가 `munix-cli-command` event를 frontend에 emit
- URI `munix://open?...`를 `CliInvocation`으로 변환
- path traversal 시도 거부

---

## 10. 오픈 이슈

- [x] macOS 앱 번들 안 `munix-cli` 포함 및 `/usr/local/bin/munix` symlink 생성 UX
- [ ] Windows `.com` redirector 또는 console subsystem CLI 패키징
- [ ] Linux `~/.local/bin/munix` 설치 경로
- [ ] 앱 미실행 시 자동 기동 경로
- [ ] `read`/`search format=json`의 request-response IPC
- [ ] `daily` 기준일: 자정 vs 4am cutoff
- [ ] 데일리 노트 경로: `daily/YYYY-MM-DD.md` vs 사용자 설정
- [ ] `file=` resolution의 title property / aliases 지원
- [ ] CLI TUI에 넣을 명령 범위

---

## 11. 의존 관계

- [ADR-024](../decisions.md#adr-024-cli--uri-scheme-munix)
- [vault-spec.md](./vault-spec.md): path validation, vault sandbox
- [search-spec.md](./search-spec.md): search/open routing
- [multi-vault-spec.md](./multi-vault-spec.md): vault id/name/path resolution
- Tauri plugin 후보:
  - `tauri-plugin-deep-link`: `munix://` 처리
  - `tauri-plugin-single-instance`: GUI 중복 실행 방지

---

**문서 버전:** v0.2
**작성일:** 2026-04-25
**최근 업데이트:** 2026-05-16 — Obsidian 공식 CLI 조사 반영, 별도 `munix-cli` + local IPC 구조로 갱신
